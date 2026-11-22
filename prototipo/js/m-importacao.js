/* Importação de clientes a partir da planilha "Pessoas em planilha" do Projuris (CSV ou XLS/XLSX).
   O arquivo é lido no próprio navegador: os dados não saem do computador/tablet de quem importa.
   Fluxo: escolher arquivo → análise e resumo → confirmar → gravar em lote (A.saveLote). */
(function (A) {
  const S = A.S, esc = A.esc;
  const ORIGEM = 'projuris';
  let analise = null;

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

  /* ---------- telas ---------- */
  function telaInicial() {
    const ja = A.col('clientes').filter(c => c.importado === ORIGEM).length;
    A.modal(`${A.modalHead('Importar clientes do Projuris')}<div class="body" style="display:block">
      <ol class="passos"><li>No Projuris: <b>engrenagem → Relatórios → Pessoas → "Pessoas em planilha"</b>, sem filtros.</li>
      <li>Escolha o arquivo abaixo (CSV, XLS ou XLSX). Ele é lido <b>neste aparelho</b>; nada é enviado para fora.</li>
      <li>Confira o resumo e confirme. Só entram as pessoas da categoria <b>Cliente</b>, na Carteira (ativos).</li></ol>
      ${S.mode !== 'local' ? '<p class="aviso-imp">Atenção: este é o sistema publicado, compartilhado e ainda sem login individual nem backup. Para dados reais de clientes, prefira esperar o servidor definitivo ou usar uma cópia só sua.</p>' : ''}
      <label class="drop" style="display:block;margin-top:10px"><input type="file" id="impArq" accept=".csv,.xls,.xlsx,text/csv" style="display:none" data-onchange="imp-arquivo">
        <b>Escolher a planilha</b><br><span class="muted">Pessoas.csv, .xls ou .xlsx</span></label>
      ${ja ? `<p class="muted" style="margin-top:12px">${ja} cliente(s) importados do Projuris neste sistema. <button type="button" class="linkbtn" data-action="imp-desfazer">Desfazer a importação</button></p>` : ''}
    </div><footer><button type="button" class="btn" data-action="modal-fechar">Fechar</button></footer>`, {wide: true});
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

  /* Exposto para testes em Node. */
  A._importacao = {parseCSV, analisar, estadoCivil, nacionalidade, genero};
})(window.App);
