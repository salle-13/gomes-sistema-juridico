/* Importação de clientes a partir da planilha "Pessoas em planilha" do Projuris (CSV ou XLS/XLSX).
   O arquivo é lido no próprio navegador: os dados não saem do computador/tablet de quem importa.
   Fluxo: escolher arquivo → análise e resumo → confirmar → gravar em lote (A.saveLote). */
(function (A) {
  const S = A.S, esc = A.esc;
  const ORIGEM = 'projuris';
  let analise = null, analisePastas = null;

  /* ---------- leitura do arquivo ---------- */
  function decodificar(buf) {
    try { return new TextDecoder('utf-8', {fatal: true}).decode(buf).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
  }
  function parseCSV(txt) {
    const prim = txt.split(/\r?\n/, 1)[0], sep = (prim.match(/;/g) || []).length >= (prim.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cel = '', q = false;
    for (let i = 0; i < txt.length; i++) { const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += ch; continue; }
      if (ch === '"') q = true; else if (ch === sep) { row.push(cel); cel = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cel); rows.push(row); row = []; cel = ''; }
      else cel += ch; }
    if (cel !== '' || row.length) { row.push(cel); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  async function lerArquivo(file) {
    const buf = await file.arrayBuffer();
    if (/\.xlsx?$/i.test(file.name)) { await A.carregarLib('xlsx'); const wb = XLSX.read(buf, {type: 'array', cellDates: false, raw: false});
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: false, defval: ''}).map(r => r.map(c => String(c ?? ''))).filter(r => r.some(c => c.trim() !== '')); }
    return parseCSV(decodificar(buf));
  }


  /* Leitor de .zip sem biblioteca: usa o DecompressionStream do navegador (Chrome/Android, Safari 16.4+). */
  async function lerZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('O arquivo .zip parece corrompido.');
    let off = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true), arqs = [];
    for (let k = 0; k < n; k++) {
      const metodo = dv.getUint16(off + 10, true), tam = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), loc = dv.getUint32(off + 42, true);
      const nome = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl)); off += 46 + nl + el + cl;
      if (nome.endsWith('/')) continue;
      const ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), dados = u8.subarray(ini, ini + tam);
      let conteudo;
      if (metodo === 0) conteudo = dados.slice().buffer;
      else if (metodo === 8) { if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não abre .zip. Descompacte e escolha os arquivos .csv.');
        conteudo = await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer(); }
      else throw new Error('Formato de compactação não suportado no arquivo ' + nome + '.');
      arqs.push({nome: nome.split('/').pop(), buf: conteudo});
    }
    return arqs;
  }
  /* Lê vários arquivos (CSV, XLS, XLSX ou ZIP com CSVs) e identifica cada um pelo cabeçalho. */
  async function lerVarios(files) {
    const tabelas = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) { for (const a of await lerZip(await f.arrayBuffer())) if (/\.(csv|txt)$/i.test(a.nome)) tabelas.push({nome: a.nome, rows: parseCSV(decodificar(a.buf))}); }
      else tabelas.push({nome: f.name, rows: await lerArquivo(f)});
    }
    for (const t of tabelas) { const cab = (t.rows[0] || []).map(chave);
      t.tipo = cab.includes('nomeourazaosocial') ? 'pessoas' : cab.includes('adverso') || (cab.includes('pasta') && cab.includes('cliente')) ? 'pastas'
        : cab.includes('descricao') && cab.includes('pasta') ? 'movimentacao' : cab.includes('pasta') && cab.includes('numero') ? 'processos' : 'desconhecido'; }
    return tabelas;
  }

  /* ---------- normalização ---------- */
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const chave = s => semAcento(s).replace(/[^a-z0-9]/g, '');
  const digitos = s => String(s || '').replace(/\D/g, '');
  const limpa = s => String(s || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  function cpfOk(d) { if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if ((s * 10) % 11 % 10 !== +d[t]) return false; } return true; }
  function cnpjOk(d) { if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false; for (const t of [12, 13]) { const w = t === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < t; i++) s += +d[i] * w[i]; const r = s % 11 < 2 ? 0 : 11 - s % 11; if (r !== +d[t]) return false; } return true; }
  const fmtDoc = d => d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : d;
  /* Gênero inferido só para concordância (brasileiro/brasileira); null quando não dá para saber. */
  function genero(...vals) { for (const v of vals) { const s = semAcento(v); if (!s) continue;
    if (/^(feminino|solteira|casada|divorciada|viuva|separada|brasil\w*a|venezuelana)$/.test(s)) return 'f';
    if (/^(masculino|solteiro|casado|divorciado|viuvo|separado|brasil\w*o|venezuelano)$/.test(s)) return 'm'; } return null; }
  const flex = (g, m, f) => g === 'f' ? f : g === 'm' ? m : m + '(a)';
  function estadoCivil(v, g, rev) { const s = semAcento(v); if (!s) return '';
    if (/^solteir/.test(s)) return /a$/.test(s) ? 'solteira' : 'solteiro';
    if (/^casad/.test(s)) return /a$/.test(s) ? 'casada' : /o$/.test(s) ? 'casado' : flex(g, 'casado', 'casada');
    if (/^divorciad/.test(s)) return /a$/.test(s) ? 'divorciada' : 'divorciado';
    if (/^viuv/.test(s)) return /a$/.test(s) ? 'viúva' : 'viúvo';
    if (/^separad/.test(s)) return /a$/.test(s) ? 'separada' : flex(g, 'separado', 'separada');
    if (/uniao estavel|amasiad/.test(s)) return 'em união estável';
    rev.push(`estado civil "${limpa(v)}" no Projuris`); return ''; }
  function nacionalidade(v, g, rev, extra) { const s = semAcento(v); if (!s) return '';
    if (/^bra[sz]i|^braisl/.test(s)) return s === 'brasil' ? flex(g, 'brasileiro', 'brasileira') : /a$/.test(s) ? 'brasileira' : 'brasileiro';
    if (/^venezuel/.test(s)) return /a$/.test(s) && s !== 'venezuela' ? 'venezuelana' : s === 'venezuela' ? flex(g, 'venezuelano', 'venezuelana') : 'venezuelano';
    rev.push(`nacionalidade "${limpa(v)}" no Projuris`); extra.naturalidadeSugerida = limpa(v); return ''; }
  function data(v, rev) { const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) { if (String(v || '').trim()) rev.push(`data de nascimento "${limpa(v)}"`); return ''; }
    const ymd = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (m[3] < 1900 || ymd > A.hoje()) { rev.push(`data de nascimento "${limpa(v)}"`); return ''; } return ymd; }

  /* Cadastros marcados como "Cliente" no Projuris que provavelmente não são clientes. */
  const RE_ORGAO = /\b(INSS|INSTITUTO NACIONAL DO SEGURO|T\.? ?R\.? ?T\.?|TRT|TURMA|VARA|TRIBUNAL|JUIZO|JUIZADO|MINISTERIO|MUNICIPIO|PREFEITURA|ESTADO DE MINAS|UNIAO FEDERAL|FAZENDA PUBLICA|RECEITA FEDERAL|DEFENSORIA|PROCURADORIA)\b/;
  const RE_EMPRESA = /\b(LTDA|S[;.]?\/A|S\.A\.?|EIRELI|EPP|MEI|ME|CIA|COMERCIO|INDUSTRIA|CONDOMINIO|ASSOCIACAO|SINDICATO|COOPERATIVA|FUNDACAO|BANCO|CAIXA ECONOMICA|IGREJA|CLINICA|TRANSPORTES|CONSORCIO|SERVICOS|DISTRIBUIDORA|ENGENHARIA|CONSTRUTORA|INCORPORADORA|AGROPECUARIA|FARMACIA|SUPERMERCADO|SECURITIZADORA|FINANCIAMENTO)\b/;
  const RE_INICIAIS = /^([A-Z]\.\s*){2,}$/;
  const maiusc = s => semAcento(s).toUpperCase();

  /* Mapeia as colunas pelo nome (sem acento/maiúsculas), para aceitar pequenas variações do Projuris. */
  const COLS = {nome: ['nomeourazaosocial','nome','razaosocial'], doc: ['cpfoucnpj','cpfcnpj','cpf','cnpj'], tipo: ['tipodepessoa'], categoria: ['categoria'], tel: ['telefone','celular'], email: ['email'],
    end: ['endereco'], qualif: ['qualificacao'], nasc: ['datadenascimento'], ec: ['estadocivil'], natur: ['naturalidade'], nac: ['nacionalidade'], empresa: ['empresa'], prof: ['profissao'],
    mae: ['nomedamae'], pai: ['nomedopai'], rg: ['rg'], ctps: ['ctps'], pis: ['pispasep','pis'], titulo: ['titulodeeleitor'], cnh: ['cnh'], passaporte: ['passaporte'], reservista: ['certidaodereservista'],
    rep: ['representantelegal'], ie: ['inscricaoestadual'], im: ['inscricaomunicipal'], regime: ['regimetributario']};

  function analisar(rows, arquivo) {
    const cab = rows[0].map(chave), idx = {}; for (const [k, nomes] of Object.entries(COLS)) idx[k] = cab.findIndex(c => nomes.includes(c));
    if (idx.nome < 0) throw new Error('Não encontrei a coluna "Nome ou Razão Social". Confira se é a planilha "Pessoas em planilha" do Projuris.');
    const get = (r, k) => idx[k] >= 0 ? limpa(r[idx[k]]) : '';
    const porDocSistema = new Map(A.col('clientes').filter(c => digitos(c.documento)).map(c => [digitos(c.documento), c]));
    const porNomeSistema = new Map(A.col('clientes').map(c => [chave(c.nome), c]));
    const vistosDoc = new Map(), vistosNome = new Map(), novos = [], conferir = [], ignorados = {}; let revisar = 0;
    const agora = new Date().toISOString(), hojeBR = A.fmt(A.hoje());
    rows.slice(1).forEach((r, n) => {
      const linha = n + 2, cat = get(r, 'categoria') || 'Cliente';
      if (idx.categoria >= 0 && semAcento(cat) !== 'cliente') { ignorados[cat] = (ignorados[cat] || 0) + 1; return; }
      const nome = get(r, 'nome').replace(/^[\s.\-_*,;]+/, '').trim();
      if (!nome) { conferir.push({linha, nome: '(sem nome)', motivo: 'linha sem nome'}); return; }
      const d = digitos(get(r, 'doc')), rev = [], extra = {};
      if (RE_ORGAO.test(maiusc(nome)) && d.length !== 11) { conferir.push({linha, nome, doc: d ? fmtDoc(d) : '', motivo: 'parece órgão público ou do tribunal, não cliente'}); return; }
      let tipo = /jur/i.test(get(r, 'tipo')) ? 'PJ' : /f[ií]s/i.test(get(r, 'tipo')) ? 'PF' : (d.length === 14 ? 'PJ' : 'PF');
      if (d && !(cpfOk(d) || cnpjOk(d))) rev.push(`CPF/CNPJ "${get(r, 'doc')}" inválido`);
      if (d.length === 14 && tipo === 'PF') { tipo = 'PJ'; rev.push('marcado como pessoa física, mas tem CNPJ'); }
      if (tipo === 'PF' && d.length !== 11 && RE_EMPRESA.test(maiusc(nome))) { tipo = 'PJ'; rev.push('parece empresa (estava como pessoa física); confira se é cliente ou parte contrária'); }
      if (RE_INICIAIS.test(maiusc(nome))) rev.push('nome só com iniciais; complete o nome para usar em documentos');
      /* duplicidades */
      if (d) { const ja = porDocSistema.get(d); if (ja) { conferir.push({linha, nome, doc: fmtDoc(d), motivo: 'já cadastrado no sistema (' + ja.nome + ')'}); return; }
        const rep = vistosDoc.get(d); if (rep) { conferir.push({linha, nome, doc: fmtDoc(d), motivo: 'CPF/CNPJ repetido na planilha (linha ' + rep + ')'}); return; } vistosDoc.set(d, linha); }
      else { const k = chave(nome), ja = porNomeSistema.get(k), rep = vistosNome.get(k);
        if (ja) { conferir.push({linha, nome, motivo: 'sem CPF/CNPJ e já existe cliente com o mesmo nome'}); return; }
        if (rep) { conferir.push({linha, nome, motivo: 'sem CPF/CNPJ e nome repetido na planilha (linha ' + rep + ')'}); return; } }
      vistosNome.set(chave(nome), vistosNome.get(chave(nome)) || linha);
      const g = genero(get(r, 'ec'), get(r, 'nac'));
      const ecTxt = get(r, 'ec'), ecEhSexo = /^(masculino|feminino)$/i.test(ecTxt), ecMenor = /^crian/i.test(semAcento(ecTxt));
      const ec = ecEhSexo || ecMenor ? '' : estadoCivil(ecTxt, g, rev);
      if (ecEhSexo) rev.push(`estado civil "${ecTxt}" no Projuris (é o sexo, não o estado civil)`);
      const nac = nacionalidade(get(r, 'nac'), g, rev, extra), nasc = data(get(r, 'nasc'), rev);
      const obs = [];
      if (ecMenor || /^crian/i.test(semAcento(get(r, 'qualif')))) obs.push('Menor de idade (marcado como "criança" no Projuris): conferir representação.');
      if (get(r, 'qualif') && !/^crian/i.test(semAcento(get(r, 'qualif')))) obs.push('Qualificação (Projuris): ' + get(r, 'qualif'));
      for (const [k, rot] of [['cnh','CNH'],['titulo','Título de eleitor'],['passaporte','Passaporte'],['reservista','Certidão de reservista'],['ie','Inscrição estadual'],['im','Inscrição municipal'],['regime','Regime tributário']]) if (get(r, k)) obs.push(rot + ': ' + get(r, k));
      if (rev.length) { obs.push('REVISAR após importação: ' + rev.join('; ') + '.'); revisar++; }
      const naturalidade = get(r, 'natur') || extra.naturalidadeSugerida || '';
      novos.push({id: A.uid(), nome, tipoPessoa: tipo, documento: d ? fmtDoc(d) : '', telefone: get(r, 'tel'), email: get(r, 'email').toLowerCase(), endereco: get(r, 'end'),
        origem: 'Projuris (importação)', area: '', urgencia: 'normal', historia: '', status: 'ativo', encaminhadoPara: [], responsavelId: '', cadastradoPor: S.meId || null,
        nacionalidade: tipo === 'PF' ? nac : '', estadoCivil: tipo === 'PF' ? ec : '', profissao: get(r, 'prof'), rg: get(r, 'rg'),
        dataNascimento: nasc, naturalidade, nomeMae: get(r, 'mae'), nomePai: get(r, 'pai'), empresa: get(r, 'empresa'), ctps: get(r, 'ctps'), pis: get(r, 'pis'),
        representanteNome: tipo === 'PJ' ? get(r, 'rep') : '', representanteCpf: '', representanteCargo: '', obs: obs.join('\n'),
        importado: ORIGEM, revisar: rev.length > 0, historico: [{em: agora, por: S.meId || null, texto: `Importado do Projuris em ${hojeBR} (arquivo ${arquivo}, linha ${linha}).`}]});
    });
    return {arquivo, total: rows.length - 1, novos, conferir, ignorados, revisar, semDoc: novos.filter(c => !c.documento).length};
  }


  /* ---------- pastas e processos ---------- */
  const UF_TJ = ['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO'];
  const COMARCA_TJMG = {'0035': 'Araguari', '0702': 'Uberlândia', '0000': '2ª instância'};
  const CNJ = /^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})$/;
  function tribunalDoCNJ(num) { const m = String(num || '').trim().match(CNJ); if (!m) return {};
    const j = m[4], tr = +m[5], o = m[6];
    if (j === '8') return {tribunal: 'TJ' + (UF_TJ[tr] || tr), comarca: tr === 13 ? (COMARCA_TJMG[o] || '') : ''};
    if (j === '5') return {tribunal: 'TRT' + tr}; if (j === '4') return {tribunal: 'TRF' + tr};
    if (j === '3') return {tribunal: 'STJ'}; if (j === '1') return {tribunal: 'STF'}; if (j === '6') return {tribunal: 'TRE'}; return {}; }
  const AREA_DE = {civel: 'Direito Civil', processualcivil: 'Direito Civil', contrato: 'Direito Civil', propriedade: 'Direito Civil', trabalhista: 'Direito Trabalhista',
    cobranca: 'Cobrança', consumidor: 'Consumidor', familia: 'Família e Sucessões', criminal: 'Direito Criminal', previdenciario: 'Direito Previdenciário', bancario: 'Direito Bancário',
    administrativo: 'Direito Administrativo', tributario: 'Direito Tributário', imobiliario: 'Direito Imobiliário', empresarial: 'Direito Empresarial'};
  const ymdBR = v => { const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  /* No modo local o navegador guarda ~5 MB; ali o texto de cada andamento é encurtado. O histórico completo virá do DataJud. */
  const maxTxt = () => S.mode === 'local' ? 400 : 1500;

  function analisarPastas(tabelas, nAnd) {
    const T = tipo => tabelas.find(t => t.tipo === tipo), tp = T('pastas');
    if (!tp) throw new Error('Não encontrei o arquivo de pastas (pastas.csv, com as colunas Pasta, Cliente e Adverso).');
    const idx = (t, ...nomes) => { const cab = t.rows[0].map(chave); return cab.findIndex(c => nomes.includes(c)); };
    const g = (r, i) => i >= 0 ? limpa(r[i]) : '';
    const P = {pasta: idx(tp, 'pasta'), enc: idx(tp, 'encerrado'), tipo: idx(tp, 'tipo'), num: idx(tp, 'distribuicao', 'numero'), cli: idx(tp, 'cliente'), adv: idx(tp, 'adverso'), nat: idx(tp, 'natureza'),
      advg: idx(tp, 'advogadoprincipal', 'advogado'), classe: idx(tp, 'classe'), pret: idx(tp, 'pretensoesdocliente'), fund: idx(tp, 'fundamentacaojuridica'), fatos: idx(tp, 'fatos'), estr: idx(tp, 'estrategia')};
    /* processos.csv: data de distribuição, instância, observações e números extras da mesma pasta */
    const extra = new Map(), tq = T('processos');
    if (tq) { const Q = {pasta: idx(tq, 'pasta'), num: idx(tq, 'numero'), data: idx(tq, 'datadodesdobramento', 'datadedistribuicao'), inst: idx(tq, 'instancia'), obs: idx(tq, 'observacoes')};
      for (const r of tq.rows.slice(1)) { const k = g(r, Q.pasta); if (!k) continue; const e = extra.get(k) || {nums: []};
        const num = g(r, Q.num); if (num) e.nums.push(num); if (!e.data) e.data = ymdBR(g(r, Q.data)); if (!e.inst) e.inst = g(r, Q.inst);
        const o = g(r, Q.obs); if (o && !/^Processo criado a partir de publica/i.test(o)) e.obs = (e.obs ? e.obs + '\n' : '') + o; extra.set(k, e); } }
    /* movimentacao.csv: as N mais recentes de cada pasta viram andamentos */
    const movs = new Map(), tm = T('movimentacao'); let totalMov = 0;
    if (tm && nAnd > 0) { const M = {data: idx(tm, 'data'), desc: idx(tm, 'descricao'), pasta: idx(tm, 'pasta')};
      for (const r of tm.rows.slice(1)) { const k = g(r, M.pasta); if (!k) continue; totalMov++; const d = ymdBR(g(r, M.data)); let t = g(r, M.desc); if (!t) continue;
        const mx = maxTxt(); if (t.length > mx) t = t.slice(0, mx) + '…'; (movs.get(k) || movs.set(k, []).get(k)).push({data: d, texto: t, por: null, origem: 'projuris'}); }
      for (const [k, a] of movs) movs.set(k, a.sort((x, y) => y.data.localeCompare(x.data)).slice(0, nAnd)); }
    /* clientes e equipe já cadastrados */
    const cliPorNome = new Map(); for (const c of A.col('clientes')) { const k = chave(c.nome); cliPorNome.set(k, (cliPorNome.get(k) || []).concat(c)); }
    const eqPorNome = new Map(A.col('equipe').map(m => [chave(m.nome.replace(/^(dra?|sr|sra)\.?\s+/i, '')), m]));
    const procPorPasta = new Map(A.col('processos').filter(p => p.pasta).map(p => [Number(p.pasta), p]));
    const novos = [], conferir = [], novosClientes = new Map(), novaEquipe = new Map(), renumerar = []; let revisar = 0, comAnd = 0, semCliente = 0;
    const agora = new Date().toISOString(), hojeBR = A.fmt(A.hoje());
    let proxExemplo = Math.max(9000, ...A.col('processos').map(p => Number(p.pasta) || 0)) + 1;
    for (const [n, r] of tp.rows.slice(1).entries()) {
      const linha = n + 2, pasta = parseInt(g(r, P.pasta), 10);
      if (!pasta) { conferir.push({linha, nome: g(r, P.cli), motivo: 'sem número de pasta'}); continue; }
      const ja = procPorPasta.get(pasta);
      if (ja) { if (ja.exemplo) renumerar.push({id: ja.id, de: pasta, para: proxExemplo++}); else { conferir.push({linha, pasta, nome: g(r, P.cli), motivo: ja.importado === ORIGEM ? 'pasta já importada' : 'número de pasta já usado por outro processo do sistema'}); continue; } }
      const rev = [], obs = [], e = extra.get(String(pasta)) || extra.get(g(r, P.pasta)) || {nums: []};
      let numero = g(r, P.num) || e.nums[0] || ''; if (!CNJ.test(numero.replace(/\s/g, ''))) { if (numero && numero.replace(/\D/g, '').length > 3) obs.push('Número no Projuris: ' + numero); numero = ''; }
      const outros = [...new Set(e.nums.filter(x => x.replace(/\D/g, '') !== numero.replace(/\D/g, '') && x.replace(/\D/g, '').length > 3))]; if (outros.length) obs.push('Outros números nesta pasta: ' + outros.join(', '));
      /* cliente */
      const nomeCli = g(r, P.cli).replace(/^[\s.\-_*,;]+/, ''); let clienteId = '';
      if (nomeCli) { const k = chave(nomeCli), achados = cliPorNome.get(k) || [];
        if (achados.length === 1) clienteId = achados[0].id;
        else if (achados.length > 1) { rev.push('há ' + achados.length + ' clientes com o nome "' + nomeCli + '"; vincule o certo'); obs.push('Cliente no Projuris: ' + nomeCli); semCliente++; }
        else { let c = novosClientes.get(k); if (!c) { c = {id: A.uid(), nome: nomeCli, tipoPessoa: RE_EMPRESA.test(maiusc(nomeCli)) ? 'PJ' : 'PF', documento: '', telefone: '', email: '', endereco: '', origem: 'Projuris (importação)', area: '', urgencia: 'normal', historia: '',
            status: 'ativo', criadoPelaPasta: true, encaminhadoPara: [], responsavelId: '', cadastradoPor: S.meId || null, obs: 'REVISAR após importação: criado a partir da pasta ' + pasta + ' (não estava como Cliente na planilha de Pessoas); complete o cadastro.', importado: ORIGEM, revisar: true,
            historico: [{em: agora, por: S.meId || null, texto: `Criado na importação das pastas do Projuris em ${hojeBR}.`}]}; novosClientes.set(k, c); } clienteId = c.id; } }
      else { rev.push('pasta sem cliente'); semCliente++; }
      /* responsável */
      let responsavelId = ''; const nomeAdv = g(r, P.advg);
      if (nomeAdv) { const k = chave(nomeAdv.replace(/^(dra?|sr|sra)\.?\s+/i, '')); let m = eqPorNome.get(k) || novaEquipe.get(k);
        if (!m) { const qtd = A.col('equipe').length + novaEquipe.size; m = {id: A.uid(), nome: nomeAdv.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()), cargo: '', papel: 'advogado', oab: '', email: '', cor: A.CORES[qtd % A.CORES.length], ativo: true, importado: ORIGEM}; novaEquipe.set(k, m); }
        responsavelId = m.id; }
      /* área, tribunal, demais campos */
      const nat = g(r, P.nat), area = AREA_DE[chave(nat)] || (nat ? 'Outras' : ''); if (area === 'Outras') obs.push('Natureza no Projuris: ' + nat);
      const trib = tribunalDoCNJ(numero), adm = /administrativ/i.test(g(r, P.tipo));
      for (const [i, rot] of [[P.pret, 'Pretensões do cliente'], [P.fund, 'Fundamentação jurídica'], [P.fatos, 'Fatos'], [P.estr, 'Estratégia']]) { const v = g(r, i).replace(/&nbsp;/g, ' '); if (v) obs.push(rot + ' (Projuris): ' + v); }
      if (e.obs) obs.push(e.obs);
      if (rev.length) { obs.push('REVISAR após importação: ' + rev.join('; ') + '.'); revisar++; }
      const adverso = g(r, P.adv), poloPassivo = false; // o Projuris não exporta Autor/Réu nesta planilha
      const and = movs.get(String(pasta)) || movs.get(g(r, P.pasta)) || []; if (and.length) comAnd++;
      novos.push({id: A.uid(), pasta, numero, clienteId, parteContraria: adverso.replace(/\s*\((\/?R.{0,2}U?\/?R.?|\/R.)\)\s*$/i, '').trim(), polo: poloPassivo ? 'passivo' : 'ativo',
        tribunal: trib.tribunal || '', comarca: trib.comarca || '', vara: e.inst || '', classe: g(r, P.classe) || (adm ? 'Processo administrativo' : ''), area,
        valorCausa: 0, responsavelId, status: /^sim/i.test(g(r, P.enc)) ? 'encerrado' : 'ativo', distribuidoEm: e.data || '', obs: obs.join('\n'), andamentos: and,
        importado: ORIGEM, revisar: rev.length > 0});
    }
    return {total: tp.rows.length - 1, novos, conferir, novosClientes: [...novosClientes.values()], novaEquipe: [...novaEquipe.values()], renumerar, revisar, comAnd, semCliente, totalMov,
      temProc: !!tq, temMov: !!tm, nAnd, admin: novos.filter(p => /administrativo/i.test(p.classe)).length, semNumero: novos.filter(p => !p.numero).length,
      tribunais: Object.entries(novos.reduce((o, p) => (o[p.tribunal || 'sem número'] = (o[p.tribunal || 'sem número'] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1])};
  }

  /* ---------- telas ---------- */
  function telaInicial() {
    const jaCli = A.col('clientes').filter(c => c.importado === ORIGEM).length, jaProc = A.col('processos').filter(p => p.importado === ORIGEM).length;
    const temCli = A.col('clientes').some(c => c.importado === ORIGEM);
    A.modal(`${A.modalHead('Importar do Projuris')}<div class="body" style="display:block">
      <p class="muted" style="margin-top:0">Os arquivos são lidos <b>neste aparelho</b>; nada é enviado para fora. Antes de gravar, o sistema mostra um resumo para você conferir.</p>
      ${S.mode !== 'local' ? '<p class="aviso-imp">Atenção: este é o sistema publicado, compartilhado e ainda sem login individual nem backup. Para dados reais de clientes, prefira esperar o servidor definitivo ou usar uma cópia só sua.</p>' : ''}
      <div class="imp-etapas">
        <div class="imp-etapa"><h4>1. Clientes</h4><p class="muted">Projuris: <b>engrenagem → Relatórios → Pessoas → "Pessoas em planilha"</b>. Só a categoria Cliente entra, na Carteira.</p>
          <label class="drop"><input type="file" id="impArq" accept=".csv,.xls,.xlsx,text/csv" style="display:none" data-onchange="imp-arquivo"><b>Escolher Pessoas.csv</b><br><span class="muted">CSV, XLS ou XLSX</span></label>
          ${jaCli ? `<p class="muted">${jaCli} cliente(s) importados. <button type="button" class="linkbtn" data-action="imp-desfazer">Desfazer</button></p>` : ''}</div>
        <div class="imp-etapa"><h4>2. Pastas e processos</h4><p class="muted">Projuris: <b>Casos → selecionar todos → ícone do Excel → Detalhado</b>. Pode escolher o <b>.zip</b> inteiro ou os arquivos pastas, processos e movimentação juntos.</p>
          <label style="display:block;margin-bottom:8px">Movimentações por pasta <select id="impNAnd">${A.opts([['5','As 5 mais recentes (recomendado)'],['20','As 20 mais recentes'],['0','Nenhuma']], '5')}</select></label>
          <label class="drop${temCli ? '' : ' off'}"><input type="file" id="impPastas" multiple accept=".zip,.csv,.xls,.xlsx" style="display:none" data-onchange="imp-pastas" ${temCli ? '' : 'disabled'}><b>Escolher pastas.zip</b><br><span class="muted">${temCli ? 'ou os arquivos .csv' : 'Importe os clientes primeiro, para ligar cada pasta ao cliente'}</span></label>
          ${jaProc ? `<p class="muted">${jaProc} pasta(s) importadas. <button type="button" class="linkbtn" data-action="imp-desfazer-pastas">Desfazer</button></p>` : ''}</div>
      </div>
    </div><footer><button type="button" class="btn" data-action="modal-fechar">Fechar</button></footer>`, {wide: true});
  }
  function telaResumoPastas() {
    const a = analisePastas, tribs = a.tribunais.slice(0, 8).map(([t, n]) => `${esc(t)} ${n}`).join(' · ');
    const amostra = a.novos.slice(0, 8).map(p => `<tr><td class="num"><b>${p.pasta}</b></td><td class="proc">${esc(p.numero || 'sem nº')}</td><td>${esc(A.cliente(p.clienteId)?.nome || a.novosClientes.find(c => c.id === p.clienteId)?.nome || '—')}</td><td>${esc(p.parteContraria || '—')}</td><td>${esc(p.area || '—')}</td><td class="num">${p.andamentos.length}</td><td>${p.revisar ? '<span class="pill s-atencao">revisar</span>' : ''}</td></tr>`).join('');
    const conf = a.conferir.slice(0, 200).map(c => `<tr><td class="num">${c.linha}</td><td>${esc(c.pasta || '')}</td><td>${esc(c.nome || '')}</td><td>${esc(c.motivo)}</td></tr>`).join('');
    A.modal(`${A.modalHead('Resumo: pastas e processos')}<div class="body" style="display:block">
      <div class="kpis imp-kpis"><div class="kpi"><span>Pastas no arquivo</span><b class="num">${a.total}</b></div><div class="kpi ok"><span>Pastas que vão entrar</span><b class="num">${a.novos.length}</b></div>
        <div class="kpi warn"><span>Para conferir (não entram)</span><b class="num">${a.conferir.length}</b></div><div class="kpi"><span>Entram com algo a revisar</span><b class="num">${a.revisar}</b></div></div>
      <ul class="imp-lista">
        <li><b>${a.novos.length - a.semCliente}</b> ligadas a um cliente já cadastrado${a.novosClientes.length ? `; <b>${a.novosClientes.length}</b> cliente(s) serão criados porque não estavam como "Cliente" em Pessoas (ficam marcados para revisar)` : ''}${a.semCliente ? `; <b>${a.semCliente}</b> sem cliente definido (nome repetido no cadastro ou vazio)` : ''}.</li>
        <li><b>${a.semNumero}</b> sem número de processo (${a.admin} processos administrativos e casos ainda não ajuizados). Tribunais: ${tribs}.</li>
        <li>${a.temMov ? `Andamentos: as <b>${a.nAnd}</b> movimentações mais recentes de cada pasta (${a.comAnd} pastas têm movimentação; o arquivo tem ${a.totalMov.toLocaleString('pt-BR')} no total).` : a.nAnd ? 'Arquivo de movimentações não encontrado: as pastas entram sem andamentos.' : 'Sem andamentos (opção "Nenhuma").'}</li>
        ${a.novaEquipe.length ? `<li><b>${a.novaEquipe.length}</b> pessoa(s) da coluna "Advogado principal" não estão na Equipe e serão cadastradas como advogado(a): ${a.novaEquipe.map(m => esc(m.nome)).join(', ')}. Ajuste o papel de cada uma em Equipe e permissões.</li>` : ''}
        ${a.renumerar.length ? `<li><b>${a.renumerar.length}</b> processo(s) de <i>exemplo</i> usam números de pasta reais e serão renumerados para 9000+.</li>` : ''}
        ${a.temProc ? '' : '<li>Arquivo de processos não encontrado: sem data de distribuição e instância.</li>'}
        <li>O Projuris não exporta se o cliente é autor ou réu nesta planilha: todas entram como <b>polo ativo</b>. Corrija nas pastas em que o cliente é réu.</li></ul>
      <h4>Amostra</h4><div class="tablewrap"><table><thead><tr><th>Pasta</th><th>Número</th><th>Cliente</th><th>Parte contrária</th><th>Área</th><th>Andam.</th><th></th></tr></thead><tbody>${amostra}</tbody></table></div>
      ${a.conferir.length ? `<h4 style="margin-top:14px">Para conferir (${a.conferir.length})</h4><div class="tablewrap" style="max-height:200px;overflow:auto"><table><thead><tr><th>Linha</th><th>Pasta</th><th>Cliente</th><th>Motivo</th></tr></thead><tbody>${conf}</tbody></table></div>` : ''}
      <div id="impProg" class="muted" style="margin-top:10px"></div>
    </div><footer><button type="button" class="btn" data-action="imp-voltar">Voltar</button>${a.novos.length && A.pode('processos', 'editar') ? `<button type="button" class="btn primary" data-action="imp-confirmar-pastas">Importar ${a.novos.length} pasta(s)</button>` : ''}</footer>`, {wide: true});
  }
  function telaResumo() {
    const a = analise, ign = Object.entries(a.ignorados).map(([k, n]) => `${n} "${esc(k)}"`).join(', ');
    const amostra = a.novos.slice(0, 8).map(c => `<tr><td>${esc(c.nome)}</td><td>${esc(c.tipoPessoa)}</td><td>${esc(c.documento || '—')}</td><td>${esc([c.estadoCivil, c.nacionalidade].filter(Boolean).join(', ') || '—')}</td><td>${c.revisar ? '<span class="pill s-atencao">revisar</span>' : ''}</td></tr>`).join('');
    const conf = a.conferir.slice(0, 200).map(c => `<tr><td class="num">${c.linha}</td><td>${esc(c.nome)}</td><td>${esc(c.doc || '—')}</td><td>${esc(c.motivo)}</td></tr>`).join('');
    A.modal(`${A.modalHead('Resumo da importação', `<span class="tag">${esc(a.arquivo)}</span>`)}<div class="body" style="display:block">
      <div class="kpis imp-kpis"><div class="kpi"><span>Linhas na planilha</span><b class="num">${a.total}</b></div><div class="kpi ok"><span>Clientes que vão entrar</span><b class="num">${a.novos.length}</b></div>
        <div class="kpi warn"><span>Para conferir (não entram)</span><b class="num">${a.conferir.length}</b></div><div class="kpi"><span>Entram com campo a revisar</span><b class="num">${a.revisar}</b></div></div>
      <p class="muted">${ign ? 'Não são clientes e ficam para a importação de processos: ' + ign + '. ' : ''}${a.semDoc} cliente(s) entram sem CPF/CNPJ. Quem tiver algo a revisar recebe uma anotação "REVISAR" nas observações (busque por <b>revisar</b> na Carteira).</p>
      <h4>Amostra do que vai entrar</h4><div class="tablewrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Estado civil / nacionalidade</th><th></th></tr></thead><tbody>${amostra || '<tr><td colspan="5" class="empty">Nada para importar.</td></tr>'}</tbody></table></div>
      ${a.conferir.length ? `<h4 style="margin-top:14px">Para conferir manualmente (${a.conferir.length}) <button type="button" class="btn small" data-action="imp-baixar-conf">Baixar lista (CSV)</button></h4>
        <div class="tablewrap" style="max-height:240px;overflow:auto"><table><thead><tr><th>Linha</th><th>Nome</th><th>CPF/CNPJ</th><th>Motivo</th></tr></thead><tbody>${conf}</tbody></table></div>` : ''}
      <div id="impProg" class="muted" style="margin-top:10px"></div>
    </div><footer><button type="button" class="btn" data-action="imp-voltar">Escolher outro arquivo</button>${a.novos.length && A.pode('clientes', 'editar') ? `<button type="button" class="btn primary" data-action="imp-confirmar">Importar ${a.novos.length} cliente(s)</button>` : ''}</footer>`, {wide: true});
  }

  A.abrirImportacaoProjuris = () => { if (!A.pode('clientes', 'editar')) return; analise = null; telaInicial(); };
  A.on('imp-abrir', () => A.abrirImportacaoProjuris());
  A.on('imp-voltar', () => telaInicial());
  A.on('imp-arquivo', async el => { const f = el.files && el.files[0]; if (!f) return;
    try { A.toast('Lendo a planilha…'); const rows = await lerArquivo(f); if (rows.length < 2) throw new Error('A planilha está vazia.'); analise = analisar(rows, f.name); telaResumo(); }
    catch (e) { console.error(e); A.toast(e.message || 'Não consegui ler o arquivo.'); } });
  A.on('imp-baixar-conf', () => A.exportar('imp-conferencia', 'csv'));
  A.exportadores['imp-conferencia'] = () => ({titulo: 'Conferência da importação do Projuris', filtros: analise ? analise.arquivo : '', linhas: analise ? analise.conferir : [],
    colunas: [{t: 'Linha da planilha', v: c => c.linha}, {t: 'Nome', v: c => c.nome}, {t: 'CPF/CNPJ', v: c => c.doc || ''}, {t: 'Motivo', v: c => c.motivo}]});
  A.on('imp-confirmar', async el => { if (!analise || !analise.novos.length) return; el.disabled = true; const prog = document.getElementById('impProg');
    const ok = await A.saveLote('clientes', analise.novos, (n, t) => { if (prog) prog.textContent = `Gravando… ${n} de ${t}`; });
    if (ok) { const n = analise.novos.length; analise = null; A.closeModal(); A.ui('clientes', {}).aba = 'carteira'; A.ui('clientes', {}).cart = 'ativo'; A.go('clientes'); A.toast(`${n} cliente(s) importados para a Carteira.`); }
    else el.disabled = false; });
  A.on('imp-desfazer', () => { const ids = A.col('clientes').filter(c => c.importado === ORIGEM).map(c => c.id);
    A.confirm('Desfazer a importação', `Os ${ids.length} clientes importados do Projuris serão apagados, inclusive o que tiver sido editado neles depois. Clientes cadastrados à mão não são afetados.`, 'Apagar importados', async () => {
      if (await A.removeLote('clientes', ids)) A.toast('Importação desfeita.'); }); });

  A.on('imp-pastas', async el => { const fs = [...(el.files || [])]; if (!fs.length) return;
    try { A.toast('Lendo os arquivos…'); const tabelas = await lerVarios(fs), nAnd = Number(document.getElementById('impNAnd')?.value || 5);
      analisePastas = analisarPastas(tabelas, nAnd); telaResumoPastas(); }
    catch (e) { console.error(e); A.toast(e.message || 'Não consegui ler os arquivos.'); } });
  A.on('imp-confirmar-pastas', async el => { const a = analisePastas; if (!a || !a.novos.length) return; el.disabled = true; const prog = document.getElementById('impProg'), msg = t => { if (prog) prog.textContent = t; };
    /* Pastas primeiro: se faltar espaço, nada mais é gravado. */
    if (a.renumerar.length) { msg('Renumerando exemplos…'); const ex = a.renumerar.map(r => Object.assign({}, A.byId('processos', r.id), {pasta: r.para})); if (!(await A.saveLote('processos', ex))) { el.disabled = false; return; } }
    let ok = await A.saveLote('processos', a.novos, (n, t) => msg(`Gravando pastas… ${n} de ${t}`));
    if (!ok && S.mode === 'local') msg('Faltou espaço neste navegador. Volte e escolha menos movimentações por pasta (ou "Nenhuma").');
    if (ok && a.novosClientes.length) { msg('Criando clientes…'); ok = await A.saveLote('clientes', a.novosClientes); }
    if (ok && a.novaEquipe.length) { msg('Cadastrando equipe…'); ok = await A.saveLote('equipe', a.novaEquipe); }
    if (ok) { const n = a.novos.length; analisePastas = null; A.closeModal(); A.go('processos'); A.toast(`${n} pasta(s) importadas.`); } else el.disabled = false; });
  A.on('imp-desfazer-pastas', () => { const procs = A.col('processos').filter(p => p.importado === ORIGEM).map(p => p.id), cls = A.col('clientes').filter(c => c.criadoPelaPasta).map(c => c.id);
    A.confirm('Desfazer a importação das pastas', `Serão apagadas ${procs.length} pasta(s) importadas${cls.length ? ' e ' + cls.length + ' cliente(s) criados a partir delas' : ''}, inclusive o que tiver sido editado nelas depois. A equipe cadastrada na importação continua (remova em Equipe, se quiser).`, 'Apagar importadas', async () => {
      if (await A.removeLote('processos', procs) && await A.removeLote('clientes', cls)) A.toast('Importação das pastas desfeita.'); }); });

  /* Exposto para testes em Node. */
  A._importacao = {parseCSV, analisar, analisarPastas, lerZip, lerVarios, tribunalDoCNJ, estadoCivil, nacionalidade, genero};
})(window.App);
