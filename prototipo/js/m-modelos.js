/* Módulo Modelos: cadastro de modelos de texto com campos {{...}} e gerador de documentos
   a partir da ficha do cliente ou do processo (prévia, kit de entrada, impressão/PDF,
   envio para Documentos e registro no histórico do cliente). */
(function (A) {
  const S = A.S, esc = A.esc;
  const ui = () => A.ui('modelos', {busca: '', tipo: '', ativos: true});
  A.TIPOS_MODELO = ['Procuração', 'Contrato', 'Declaração', 'Petição', 'Outro'];
  const CAT_DOC = {'Procuração': 'Procuração', 'Contrato': 'Contrato', 'Petição': 'Petição / peça'};
  const KIT_TIPOS = ['Procuração', 'Contrato', 'Declaração'];

  /* ---------- números por extenso ---------- */
  const UN = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const DZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const CT = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  function ate999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(CT[c]);
    if (r) p.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : ''));
    return p.join(' e ');
  }
  const extensoInteiro = A.extensoInteiro = function (n) {
    n = Math.floor(Math.abs(Number(n) || 0)); if (!n) return 'zero';
    const grupos = []; for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);
    const NOMES = [null, null, ['milhão', 'milhões'], ['bilhão', 'bilhões']];
    const partes = [];
    for (let i = grupos.length - 1; i >= 0; i--) { const v = grupos[i]; if (!v) continue;
      partes.push({i, v, t: i === 0 ? ate999(v) : i === 1 ? (v === 1 ? 'mil' : ate999(v) + ' mil') : ate999(v) + ' ' + NOMES[i][v === 1 ? 0 : 1]}); }
    return partes.reduce((s, p, k) => k === 0 ? p.t : s + (k === partes.length - 1 && (p.v < 100 || p.v % 100 === 0) ? ' e ' : p.i === 0 ? ' ' : ', ') + p.t, '');
  };
  /* Valor em centavos → "três mil reais", "um milhão de reais", "dez reais e cinquenta centavos". */
  A.extensoReais = function (cents) {
    cents = Math.round(Math.abs(Number(cents) || 0)); const r = Math.floor(cents / 100), c = cents % 100;
    const reais = r ? extensoInteiro(r) + (r === 1 ? ' real' : (r >= 1e6 && r % 1e6 === 0 ? ' de reais' : ' reais')) : '';
    const cent = c ? extensoInteiro(c) + (c === 1 ? ' centavo' : ' centavos') : '';
    return [reais, cent].filter(Boolean).join(' e ') || 'zero real';
  };
  function percentual(str) {
    const s = String(str || '').replace('%', '').trim(); if (!s) return '';
    const n = Number(s.replace(',', '.')); if (isNaN(n) || n <= 0) return '';
    const txt = String(n).replace('.', ',') + '%';
    return Number.isInteger(n) ? txt + ' (' + extensoInteiro(n) + ' por cento)' : txt;
  }

  /* ---------- campos disponíveis ---------- */
  const extensoData = s => { const [y, m, d] = s.split('-').map(Number); return (d === 1 ? '1º' : d) + ' de ' + A.MESES[m - 1] + ' de ' + y; };
  const tratamento = m => m ? (m.genero === 'F' ? 'Dra.' : m.genero === 'M' ? 'Dr.' : 'Dr(a).') : '';
  // A equipe às vezes é cadastrada como "Dra. Helena…": tira o título para não sair "Dra. Dra." com {{advogado.tratamento}}.
  const semTitulo = n => String(n || '').replace(/^\s*(Dr\(a\)|Dra|Dr)\.?\s+/i, '');
  const qualifAdv = m => m ? (m.genero === 'F' ? 'advogada' : m.genero === 'M' ? 'advogado' : 'advogado(a)') : '';
  /* Qualificação completa; cada parte sem dado vira [[cliente.campo]] e aparece no aviso. */
  function qualificacaoCliente(c) {
    if (!c) return '';
    const q = (k, v) => String(v ?? '').trim() || '[[cliente.' + k + ']]';
    if (c.tipoPessoa === 'PJ') return `${q('nome', c.nome)}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${q('cpf_cnpj', c.documento)}, com sede em ${q('endereco', c.endereco)}, neste ato representada por seu(sua) ${q('representante_cargo', c.representanteCargo)}, ${q('representante', c.representanteNome)}, inscrito(a) no CPF sob o nº ${q('representante_cpf', c.representanteCpf)}`;
    return `${q('nome', c.nome)}, ${q('nacionalidade', c.nacionalidade)}, ${q('estado_civil', c.estadoCivil)}, ${q('profissao', c.profissao)}, portador(a) do RG nº ${q('rg', c.rg)}, inscrito(a) no CPF sob o nº ${q('cpf_cnpj', c.documento)}, residente e domiciliado(a) em ${q('endereco', c.endereco)}`;
  }
  A.CAMPOS_MODELO = [
    ['Cliente', [
      ['cliente.qualificacao', 'Qualificação completa (PF ou PJ)', c => qualificacaoCliente(c.cliente)],
      ['cliente.nome', 'Nome / razão social', c => c.cliente?.nome],
      ['cliente.cpf_cnpj', 'CPF / CNPJ', c => c.cliente?.documento],
      ['cliente.endereco', 'Endereço', c => c.cliente?.endereco],
      ['cliente.nacionalidade', 'Nacionalidade (PF)', c => c.cliente?.nacionalidade],
      ['cliente.estado_civil', 'Estado civil (PF)', c => c.cliente?.estadoCivil],
      ['cliente.profissao', 'Profissão (PF)', c => c.cliente?.profissao],
      ['cliente.rg', 'RG (PF)', c => c.cliente?.rg],
      ['cliente.representante', 'Representante legal (PJ)', c => c.cliente?.representanteNome],
      ['cliente.representante_cpf', 'CPF do representante (PJ)', c => c.cliente?.representanteCpf],
      ['cliente.representante_cargo', 'Cargo do representante (PJ)', c => c.cliente?.representanteCargo],
      ['cliente.tipo_pessoa', 'Pessoa física / jurídica', c => c.cliente ? (c.cliente.tipoPessoa === 'PJ' ? 'pessoa jurídica' : 'pessoa física') : ''],
      ['cliente.email', 'E-mail', c => c.cliente?.email],
      ['cliente.telefone', 'Telefone', c => c.cliente?.telefone],
    ]],
    ['Processo', [
      ['processo.pasta', 'Nº da pasta', c => c.processo?.pasta ? String(c.processo.pasta) : ''],
      ['processo.numero', 'Número (CNJ)', c => c.processo?.numero],
      ['processo.vara', 'Vara / órgão', c => c.processo?.vara],
      ['processo.comarca', 'Comarca', c => c.processo?.comarca],
      ['processo.tribunal', 'Tribunal', c => c.processo?.tribunal],
      ['processo.classe', 'Classe / ação', c => c.processo?.classe],
      ['processo.parte_contraria', 'Parte contrária', c => c.processo?.parteContraria],
      ['processo.valor_causa', 'Valor da causa', c => c.processo?.valorCausa ? A.brl(c.processo.valorCausa) : ''],
    ]],
    ['Advogado(a)', [
      ['advogado.tratamento', 'Dr. / Dra. (pelo gênero)', c => tratamento(c.advogado)],
      ['advogado.nome', 'Nome (sem Dr./Dra.)', c => semTitulo(c.advogado?.nome)],
      ['advogado.qualificacao', 'advogado / advogada', c => qualifAdv(c.advogado)],
      ['advogado.oab', 'Inscrição na OAB', c => c.advogado?.oab],
      ['advogado.email', 'E-mail', c => c.advogado?.email],
    ]],
    ['Honorários (informados ao gerar)', [
      ['honorarios.valor', 'Valor (R$ 3.000,00)', c => c.honorarios?.valor ? A.brl(c.honorarios.valor) : ''],
      ['honorarios.valor_extenso', 'Valor por extenso', c => c.honorarios?.valor ? A.extensoReais(c.honorarios.valor) : ''],
      ['honorarios.percentual_exito', '% de êxito (30% (trinta por cento))', c => percentual(c.honorarios?.percentual)],
    ]],
    ['Escritório (Configurações)', [
      ['escritorio.nome', 'Nome do escritório', () => S.config.escritorioNome],
      ['escritorio.cidade', 'Cidade / UF', () => S.config.escritorioCidade],
    ]],
    ['Datas', [
      ['data_hoje_extenso', 'Data de hoje por extenso', () => extensoData(A.hoje())],
      ['data_hoje', 'Data de hoje (dd/mm/aaaa)', () => A.fmt(A.hoje())],
    ]],
  ];
  const CAMPOS = Object.fromEntries(A.CAMPOS_MODELO.flatMap(([, l]) => l.map(([k, , f]) => [k, f])));
  // Nomes antigos (primeira versão do módulo): continuam funcionando, mas não aparecem no painel.
  ['nome', 'oab', 'email', 'tratamento', 'qualificacao'].forEach(k => { CAMPOS['advogada.' + k] = CAMPOS['advogado.' + k]; });
  const CAMPO_RE = /\{\{\s*([\w.]+)\s*\}\}/g, FALTA_RE = /\[\[([\w.]+)\]\]/g, HON_RE = /\{\{\s*honorarios\./;
  const faltandoEm = t => [...new Set([...String(t || '').matchAll(FALTA_RE)].map(m => m[1]))];
  const desconhecidos = t => [...new Set([...String(t || '').matchAll(CAMPO_RE)].map(m => m[1]).filter(k => !CAMPOS[k]))];

  /* Preenche o texto; campo vazio ou desconhecido vira [[chave]]. "faltando" vem do texto final,
     então inclui as partes que faltam dentro da qualificação. ctx: {cliente, processo, advogado, honorarios} */
  A.preencherModelo = function (texto, ctx) {
    ctx = Object.assign({}, ctx); if (!ctx.advogado && ctx.advogada) ctx.advogado = ctx.advogada;
    const out = String(texto || '').replace(CAMPO_RE, (_, k) => { const f = CAMPOS[k]; const v = f ? String(f(ctx) ?? '').trim() : ''; return v || '[[' + k + ']]'; });
    return {texto: out, faltando: faltandoEm(out)};
  };

  /* ---------- tela Modelos ---------- */
  function lista() { const u = ui();
    return A.col('modelos').filter(m => (!u.tipo || m.tipo === u.tipo) && (!u.ativos || m.ativo !== false) && A.match(u.busca, m.nome, m.tipo, m.texto))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')); }
  A.exportadores.modelos = () => ({titulo: 'Modelos de documentos', linhas: lista(), colunas: [{t:'Modelo', v:m => m.nome}, {t:'Tipo', v:m => m.tipo},
    {t:'Ativo', v:m => m.ativo === false ? 'Não' : 'Sim'}, {t:'Atualizado em', v:m => String(m.atualizadoEm || '').slice(0, 10), tipo:'date'}]});

  function vModelos() {
    const u = ui(), arr = lista(), ed = A.pode('modelos', 'editar');
    const rows = arr.map(m => { const n = (String(m.texto || '').match(CAMPO_RE) || []).length, t = String(m.texto || '').replace(/\s+/g, ' ');
      return `<tr class="row-click" data-action="abrir-modelo" data-id="${esc(m.id)}"><td><b>${esc(m.nome)}</b>${m.exemplo ? ' <span class="tag">exemplo</span>' : ''}<br><span class="muted" style="font-size:12px">${esc(t.slice(0, 110))}${t.length > 110 ? '…' : ''}</span></td>
        <td><span class="tag">${esc(m.tipo || 'Outro')}</span></td><td class="num">${n}</td><td>${m.ativo === false ? 'Inativo' : 'Ativo'}</td>
        <td>${esc(A.fmt(String(m.atualizadoEm || m.criadoEm || '').slice(0, 10)))}</td>
        <td style="white-space:nowrap"><button class="btn small" data-action="gerar-de-modelo" data-id="${esc(m.id)}">Gerar</button>${ed ? ` <button class="btn small" data-action="mod-duplicar" data-id="${esc(m.id)}">Duplicar</button>` : ''}</td></tr>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Modelos de documentos</h2><span class="muted num">${arr.length} modelo(s)</span>${A.botoesExport('modelos')}${ed ? '<button class="btn primary" data-action="novo-modelo">+ Novo modelo</button>' : ''}</div>
      <div class="filters"><input id="moBusca" type="search" data-ui="modelos.busca" placeholder="Buscar modelo ou trecho do texto…" value="${esc(u.busca)}" style="flex:1 1 260px">
        <select id="moTipo" data-ui="modelos.tipo">${A.opts(A.TIPOS_MODELO, u.tipo, 'Todos os tipos')}</select>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="moAtivos" data-ui="modelos.ativos" ${u.ativos ? 'checked' : ''}> Só ativos</label></div>
      <div class="tablewrap"><table><thead><tr><th>Modelo</th><th>Tipo</th><th>Campos</th><th>Situação</th><th>Atualizado</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty" style="padding:16px">Nenhum modelo encontrado.${!A.col('modelos').length && ed ? ' <button class="btn small" data-action="mod-exemplos">Carregar os 3 modelos de exemplo</button>' : ''}</td></tr>`}</tbody></table></div>
      <div class="legend">Para gerar um documento, abra a ficha de um cliente ou de um processo e use “Gerar documento” (ou “Kit de entrada”, na ficha do cliente), ou clique em “Gerar” aqui e escolha o cliente.</div></section>`;
  }
  A.route('modelos', {label: 'Modelos de documentos', mod: 'modelos', render: vModelos});

  /* ---------- editor do modelo ---------- */
  let mod = null;
  A.on('novo-modelo', () => abrirModelo(null));
  A.on('abrir-modelo', el => { const m = A.byId('modelos', el.dataset.id); if (m) abrirModelo(m); });
  function painelCampos(ed) {
    return `<div class="box"><h4>Campos disponíveis</h4><p class="muted" style="margin:0;font-size:12px">${ed ? 'Clique para inserir no ponto do cursor.' : 'Campos que o texto pode usar.'} Campo sem dado aparece destacado na prévia.</p>
      ${A.CAMPOS_MODELO.map(([g, l]) => `<div class="campos"><b>${esc(g)}</b>${l.map(([k, r]) => `<button type="button" class="campo" ${ed ? `data-action="mod-inserir" data-k="${esc(k)}"` : 'disabled'} title="${esc(r)}"><code>{{${esc(k)}}}</code><span>${esc(r)}</span></button>`).join('')}</div>`).join('')}</div>`;
  }
  function abrirModelo(m, copia) {
    const ed = A.pode('modelos', 'editar'), ro = ed ? '' : 'disabled';
    mod = m ? JSON.parse(JSON.stringify(m)) : {id: A.uid(), _novo: true, nome: '', tipo: 'Procuração', texto: '', ativo: true};
    A.modal(`${A.modalHead(mod._novo ? (copia ? 'Novo modelo (cópia)' : 'Novo modelo') : mod.nome)}
      <form id="fModelo"><div class="cgrid"><div>
        <div class="two">${A.inp('moNome', 'Nome do modelo', mod.nome, `required ${ro}`)}${A.sel('moTipoM', 'Tipo', A.opts(A.TIPOS_MODELO, mod.tipo), '', ro)}</div>
        ${A.area('moTexto', 'Texto do modelo', mod.texto, 22, `${ro} spellcheck="true" style="font-family:var(--font-display);font-size:14px;line-height:1.55"`)}
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="moAtivo" ${mod.ativo !== false ? 'checked' : ''} ${ro}> Modelo ativo (aparece em “Gerar documento” e no kit de entrada)</label>
      </div><div>${painelCampos(ed)}</div></div>
      <footer>${!mod._novo && ed ? '<button type="button" class="btn danger left" data-action="mod-excluir">Excluir modelo</button><button type="button" class="btn" data-action="mod-duplicar">Duplicar</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`, {wide: true});
    document.getElementById('fModelo').addEventListener('submit', async e => { e.preventDefault(); if (await salvarModelo()) { A.closeModal(); A.toast('Modelo salvo.'); } });
  }
  async function salvarModelo() {
    const obj = Object.assign({}, mod, {nome: A.v('moNome'), tipo: A.v('moTipoM'), texto: document.getElementById('moTexto').value, ativo: A.v('moAtivo')});
    if (!obj.nome) { A.toast('Informe o nome do modelo.'); return null; }
    if (!obj.texto.trim()) { A.toast('Escreva o texto do modelo.'); return null; }
    if (A.col('modelos').some(m => m.id !== obj.id && A.norm(m.nome) === A.norm(obj.nome))) { A.toast('Já existe um modelo com esse nome.'); return null; }
    const dx = desconhecidos(obj.texto);
    if (dx.length) A.toast('Atenção: campo(s) desconhecido(s) no texto: ' + dx.map(k => '{{' + k + '}}').join(', ') + '. Eles vão aparecer como “sem dado”.');
    delete obj._novo; return A.save('modelos', obj);
  }
  A.on('mod-inserir', el => {
    const ta = document.getElementById('moTexto'); if (!ta) return;
    const ins = '{{' + el.dataset.k + '}}', i = ta.selectionStart ?? ta.value.length, j = ta.selectionEnd ?? i;
    ta.value = ta.value.slice(0, i) + ins + ta.value.slice(j); ta.focus(); ta.setSelectionRange(i + ins.length, i + ins.length);
  });
  /* Duplicar: na lista (data-id) ou no editor aberto (usa o texto que está na tela). */
  A.on('mod-duplicar', el => {
    let base = el.dataset.id ? A.byId('modelos', el.dataset.id) : mod; if (!base) return;
    if (!el.dataset.id && document.getElementById('moTexto')) base = Object.assign({}, base, {nome: A.v('moNome'), tipo: A.v('moTipoM'), texto: document.getElementById('moTexto').value});
    let nome = base.nome + ' (cópia)', n = 2; while (A.col('modelos').some(m => A.norm(m.nome) === A.norm(nome))) nome = base.nome + ' (cópia ' + n++ + ')';
    abrirModelo({id: A.uid(), _novo: true, nome, tipo: base.tipo, texto: base.texto, ativo: true}, true);
  });
  A.on('mod-exemplos', async () => { // base compartilhada nova: a coleção não vem do seed automaticamente
    let n = 0; for (const m of A.seed(A.hoje(), A.P).data.modelos || []) if (!A.byId('modelos', m.id) && await A.save('modelos', m)) n++;
    A.toast(n + ' modelo(s) de exemplo carregado(s).');
  });
  A.on('mod-excluir', () => { const id = mod.id; A.confirm('Excluir modelo', 'O modelo será apagado. Os documentos já gerados a partir dele continuam em Documentos.', 'Excluir', async () => { if (await A.remove('modelos', id)) A.toast('Modelo excluído.'); }); });

  /* ---------- gerador (um documento ou kit de entrada) ---------- */
  /* g = {clienteId, processoId, advId, hon:{valor, percentual}, kit, ids:[modeloId], itens:[{modeloId, nome, texto}], editando, registrados:Set} */
  let g = null;
  const advogados = () => A.col('equipe').filter(m => ['advogado', 'admin'].includes(m.papel) && m.ativo !== false);
  const ativos = () => A.col('modelos').filter(m => m.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  function advPadrao(clienteId, processoId) {
    const cand = [A.processo(processoId)?.responsavelId, A.cliente(clienteId)?.responsavelId, S.meId];
    return cand.find(id => id && A.membro(id)) || advogados()[0]?.id || '';
  }
  const kitPadrao = () => KIT_TIPOS.map(t => ativos().find(m => m.tipo === t)?.id).filter(Boolean);
  function preencher() {
    const ctx = {cliente: A.cliente(g.clienteId), processo: A.processo(g.processoId), advogado: A.membro(g.advId), honorarios: g.hon};
    g.itens = g.ids.map(id => A.byId('modelos', id)).filter(Boolean).map(m => ({modeloId: m.id, nome: m.nome, tipo: m.tipo, texto: A.preencherModelo(m.texto, ctx).texto}));
    g.editando = false;
  }
  A.abrirGerador = function (alvo) {
    if (!A.pode('modelos', 'ver')) { A.toast('Seu papel não tem acesso a Modelos de documentos.'); return; }
    const clienteId = alvo.clienteId || A.processo(alvo.processoId)?.clienteId || '';
    // Cliente com um único processo ativo: já vem selecionado (o contrato usa os dados do processo).
    const unico = !alvo.processoId && clienteId ? A.col('processos').filter(p => p.clienteId === clienteId && p.status === 'ativo') : [];
    const processoId = alvo.processoId || (unico.length === 1 ? unico[0].id : '');
    const ids = alvo.kit ? kitPadrao() : [(alvo.modeloId && A.byId('modelos', alvo.modeloId)) ? alvo.modeloId : ativos()[0]?.id].filter(Boolean);
    g = {clienteId, processoId, advId: advPadrao(clienteId, processoId), hon: {valor: 0, percentual: ''}, kit: !!alvo.kit, ids, itens: [], editando: false, registrados: new Set()};
    S.ui._modalCtx = {tipo: 'gerador'};
    preencher(); desenharGerador();
  };
  const usaHonorarios = () => g.ids.some(id => HON_RE.test(A.byId('modelos', id)?.texto || ''));
  const previaHtml = t => esc(t).replace(/\[\[([\w.]+)\]\]/g, '<mark title="Campo sem dado">[[$1]]</mark>');
  function aviso() {
    const linhas = g.itens.map(it => [it.nome, faltandoEm(it.texto)]).filter(([, f]) => f.length);
    if (!linhas.length) return '';
    return `<div class="aviso-campos" role="alert"><b>Campos sem dado</b> — complete o cadastro (cliente, processo, equipe ou configurações) e gere de novo, ou edite o texto antes de imprimir:
      ${linhas.map(([n, f]) => `<div>${g.itens.length > 1 ? esc(n) + ': ' : ''}${f.map(k => `<code>${esc(k)}</code>`).join(', ')}</div>`).join('')}</div>`;
  }
  function lerTextos() { g.itens.forEach((it, i) => { const ta = document.getElementById('gerTexto-' + i); if (ta) it.texto = ta.value; }); }
  function desenharGerador() {
    const lst = ativos(), podeSalvar = A.pode('documentos', 'editar'), tem = g.itens.length > 0;
    const procs = A.col('processos').filter(p => !g.clienteId || p.clienteId === g.clienteId);
    const motivo = !podeSalvar ? 'Seu papel não pode enviar documentos.' : S.mode === 'local' ? 'No modo local não é possível anexar arquivos. Abra o sistema compartilhado para salvar em Documentos.' : !S.assets ? 'Seu acesso não permite enviar arquivos.' : '';
    const docs = g.itens.map((it, i) => g.editando
      ? `<div class="previa-ed"><h5>${esc(it.nome)}</h5><textarea id="gerTexto-${i}" rows="${g.itens.length > 1 ? 14 : 24}" aria-label="Texto de ${esc(it.nome)}" style="font-family:var(--font-display);font-size:14px;line-height:1.55">${esc(it.texto)}</textarea></div>`
      : `<div class="previa">${g.itens.length > 1 ? `<h5>${esc(it.nome)}</h5>` : ''}${previaHtml(it.texto)}</div>`).join('');
    const seletor = g.kit
      ? `<div class="field"><label>Documentos do kit</label><div class="checks">${lst.map(m => `<label><input type="checkbox" value="${esc(m.id)}" data-onchange="ger-kit" ${g.ids.includes(m.id) ? 'checked' : ''}> ${esc(m.nome)} <span class="muted">· ${esc(m.tipo)}</span></label>`).join('') || '<span class="muted">Nenhum modelo ativo.</span>'}</div></div>`
      : A.sel('gerModelo', 'Modelo', lst.length ? A.opts(lst.map(m => [m.id, m.nome]), g.ids[0]) : '<option value="">Nenhum modelo ativo</option>', '', 'data-onchange="ger-campo"');
    const hon = usaHonorarios() ? `<div class="two">${A.inp('gerHonValor', 'Honorários (R$)', g.hon.valor ? A.num(g.hon.valor) : '', 'inputmode="decimal" placeholder="3.000,00" data-onchange="ger-campo"')}${A.inp('gerHonPerc', '% de êxito', g.hon.percentual, 'inputmode="decimal" placeholder="30" data-onchange="ger-campo"')}</div>
      <p class="muted" style="margin:0;font-size:12px">Usados só neste documento; não ficam salvos no cliente.</p>` : '';
    A.modal(`${A.modalHead(g.kit ? 'Kit de entrada' : 'Gerar documento', g.kit ? `<span class="tag">${g.itens.length} documento(s)</span>` : '')}
      <div class="cgrid"><div>
        <div id="gerAviso">${aviso()}</div>
        <div class="vhead" style="padding:0"><b style="font-size:13px">Prévia</b><button type="button" class="btn small" data-action="ger-editar" ${tem ? '' : 'disabled'}>${g.editando ? 'Ver prévia' : 'Editar texto'}</button></div>
        ${docs || '<div class="previa"><span class="muted">Escolha um modelo.</span></div>'}
      </div><div>
        <div class="box"><h4>Dados</h4>
          ${seletor}
          ${A.sel('gerCli', 'Cliente', A.opts(A.col('clientes').slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(c => [c.id, c.nome]), g.clienteId, 'Nenhum'), '', 'data-onchange="ger-campo"')}
          ${A.sel('gerProc', 'Processo', A.opts(procs.map(p => [p.id, A.rotuloProcesso(p)]), g.processoId, 'Nenhum'), '', 'data-onchange="ger-campo"')}
          ${A.sel('gerAdv', 'Advogado(a) que assina', A.opts(advogados().map(m => [m.id, m.nome + (m.oab ? ' · ' + m.oab : '')]), g.advId, 'Nenhum(a)'), '', 'data-onchange="ger-campo"')}
          ${hon}
          <p class="muted" style="margin:0;font-size:12px">Trocar um dado gera o texto de novo a partir do modelo (edições manuais são descartadas).</p>
        </div>
        <div class="box"><h4>Concluir</h4>
          <button type="button" class="btn" data-action="ger-imprimir" ${tem ? '' : 'disabled'}>${g.itens.length > 1 ? 'Imprimir tudo / salvar como PDF' : 'Imprimir / salvar como PDF'}</button>
          <button type="button" class="btn primary" data-action="ger-salvar" ${tem && !motivo ? '' : 'disabled'}>Salvar em Documentos (${g.itens.length > 1 ? g.itens.length + ' PDFs' : 'PDF'})</button>
          ${motivo ? `<span class="muted" style="font-size:12px">${esc(motivo)}</span>` : `<span class="muted" style="font-size:12px">O PDF fica vinculado ${g.processoId ? 'ao processo e ao cliente' : g.clienteId ? 'ao cliente' : 'aos documentos gerais do escritório'}.</span>`}
          ${g.clienteId ? '<span class="muted" style="font-size:12px">Ao imprimir ou salvar, o histórico do cliente registra “Documento gerado”.</span>' : ''}
        </div>
      </div></div>
      <footer><button type="button" class="btn" data-action="modal-fechar">Fechar</button></footer>`, {wide: true, nofocus: true});
    g.itens.forEach((it, i) => { const ta = document.getElementById('gerTexto-' + i);
      if (ta) ta.addEventListener('input', () => { it.texto = ta.value; document.getElementById('gerAviso').innerHTML = aviso(); }); });
  }
  A.on('ger-campo', el => {
    if (el.id === 'gerModelo') g.ids = el.value ? [el.value] : [];
    if (el.id === 'gerAdv') g.advId = el.value;
    if (el.id === 'gerCli') { g.clienteId = el.value; if (g.processoId && A.processo(g.processoId)?.clienteId !== g.clienteId) g.processoId = ''; }
    if (el.id === 'gerProc') { g.processoId = el.value; const p = A.processo(g.processoId); if (p && p.clienteId) g.clienteId = p.clienteId; }
    if (el.id === 'gerHonValor') g.hon.valor = A.cents(el.value);
    if (el.id === 'gerHonPerc') g.hon.percentual = el.value.trim();
    preencher(); desenharGerador();
  });
  A.on('ger-kit', el => {
    const ordem = ativos().map(m => m.id), sel = new Set(g.ids); if (el.checked) sel.add(el.value); else sel.delete(el.value);
    // Ordem do kit: procuração, contrato, declaração e depois os demais por nome.
    const peso = id => { const i = KIT_TIPOS.indexOf(A.byId('modelos', id)?.tipo); return i < 0 ? 99 : i; };
    g.ids = ordem.filter(id => sel.has(id)).sort((a, b) => peso(a) - peso(b));
    preencher(); desenharGerador();
  });
  A.on('ger-editar', () => { lerTextos(); g.editando = !g.editando; desenharGerador(); });

  /* Ação com campos faltando: pede um segundo clique (mesmo padrão de doc-excluir). */
  function confirmarFaltando(el) {
    if (!g.itens.some(it => faltandoEm(it.texto).length) || el.dataset.armed) return true;
    const orig = el.textContent; el.dataset.armed = '1'; el.textContent = 'Há campos sem dado. Clique de novo para continuar';
    setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = orig; } }, 5000); return false;
  }
  const nomeArquivo = it => [it.nome || 'Documento', A.cliente(g.clienteId)?.nome].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '').slice(0, 120) + ' - ' + A.hoje() + '.pdf';
  const cabecalhoTxt = () => [S.config.escritorioNome || 'Gomes Assessoria Jurídica', S.config.escritorioCidade].filter(Boolean).join(' — ');

  /* Histórico do cliente: uma entrada por documento, uma vez por abertura do gerador, numa única gravação. */
  async function registrarHistorico(itens) {
    const c = A.cliente(g.clienteId); if (!c) return;
    const novos = itens.filter(it => !g.registrados.has(it.modeloId)); if (!novos.length) return;
    const em = new Date().toISOString();
    const hist = [...(c.historico || []), ...novos.map(it => ({em, por: S.meId || null, tipo: 'documento', texto: 'Documento gerado: ' + it.nome + (g.processoId ? ' (' + A.rotuloProcId(g.processoId) + ')' : '') + '.'}))];
    if (await A.save('clientes', Object.assign({}, c, {historico: hist}))) novos.forEach(it => g.registrados.add(it.modeloId));
  }

  A.on('ger-imprimir', el => {
    lerTextos(); if (!g.itens.length || !confirmarFaltando(el)) return;
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
    const d = fr.contentDocument, titulo = g.itens.length > 1 ? 'Kit de entrada - ' + (A.cliente(g.clienteId)?.nome || '') : nomeArquivo(g.itens[0]).replace(/\.pdf$/, '');
    d.open(); d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
      @page{size:A4;margin:25mm 22mm}body{font-family:"Times New Roman",Georgia,serif;font-size:12pt;line-height:1.6;color:#000;margin:0}
      header{font-family:Arial,sans-serif;font-size:9pt;color:#273884;border-bottom:1px solid #273884;padding-bottom:4pt;margin-bottom:18pt}
      section + section{page-break-before:always;break-before:page}
      .t{white-space:pre-wrap;text-align:justify}mark{background:#ffe08a}</style></head>
      <body>${g.itens.map(it => `<section><header>${esc(cabecalhoTxt())}</header><div class="t">${previaHtml(it.texto)}</div></section>`).join('')}</body></html>`);
    d.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast('Não foi possível abrir a impressão.'); } setTimeout(() => fr.remove(), 60000); }, 250);
    registrarHistorico(g.itens);
  });

  async function gerarPdf(texto) {
    await A.carregarLib('pdf');
    const {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'pt', format: 'a4'});
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), mx = 64, top = 84, base = H - 64, lh = 17;
    const cabecalho = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(39, 56, 132);
      doc.text(cabecalhoTxt(), mx, 46); doc.setDrawColor(39, 56, 132); doc.line(mx, 52, W - mx, 52);
      doc.setFont('times', 'normal'); doc.setFontSize(12); doc.setTextColor(0); };
    cabecalho(); let y = top;
    for (const par of String(texto).split('\n')) {
      const linhas = par.trim() ? doc.splitTextToSize(par, W - 2 * mx) : [''];
      for (const l of linhas) { if (y > base) { doc.addPage(); cabecalho(); y = top; } doc.text(l, mx, y); y += lh; }
    }
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text('Página ' + i + ' de ' + n, W - mx, H - 30, {align: 'right'}); }
    return doc.output('blob');
  }
  A.on('ger-salvar', async el => {
    lerTextos();
    if (!S.assets || !A.pode('documentos', 'editar')) { A.toast('Envio de arquivos indisponível para seu acesso.'); return; }
    if (!g.itens.length || !confirmarFaltando(el)) return;
    const orig = el.textContent; el.disabled = true; const salvos = [];
    try {
      for (const it of g.itens) {
        el.textContent = 'Gerando ' + it.nome + '…';
        const nome = nomeArquivo(it), blob = await gerarPdf(it.texto);
        const r = await S.assets.upload(new File([blob], nome, {type: 'application/pdf'}), {type: 'application/pdf'});
        const ok = await A.save('documentos', {nome, categoria: CAT_DOC[it.tipo] || 'Modelo do escritório', assetId: r.id, contentType: r.contentType, sizeBytes: r.sizeBytes,
          clienteId: g.clienteId || null, processoId: g.processoId || null, enviadoPor: S.meId || null, enviadoEm: new Date().toISOString()});
        if (ok) salvos.push(it);
      }
    } catch (e) { const c = e && e.code; A.toast(c === 'quota_or_state' ? 'O espaço de armazenamento acabou.' : 'Não foi possível salvar o documento. Verifique a conexão e tente de novo.'); }
    if (salvos.length) { await registrarHistorico(salvos); A.toast(salvos.length + ' documento(s) salvo(s) em Documentos.'); }
    if (el.isConnected) { el.disabled = false; el.textContent = orig; }
  });

  /* ---------- botões nas fichas de cliente e processo ---------- */
  A.on('gerar-de-modelo', el => A.abrirGerador({modeloId: el.dataset.id}));
  async function deFicha(kit) {
    const ctx = S.ui._modalCtx || {};
    if (ctx.tipo === 'cliente') {
      if (!A.cliente(ctx.id) && !(await A.salvarClienteAberto())) return;
      A.closeModal(); A.abrirGerador({clienteId: ctx.id, kit});
    } else if (ctx.tipo === 'processo') {
      if (!A.processo(ctx.id)) { A.toast('Salve o processo antes de gerar documentos.'); return; }
      A.closeModal(); A.abrirGerador({processoId: ctx.id, kit});
    } else A.abrirGerador({kit});
  }
  A.on('gerar-documento', () => deFicha(false));
  A.on('kit-entrada', () => deFicha(true));
  A.blocoGerarDocumento = tipo => A.pode('modelos', 'ver') ? `<div class="box"><h4>Gerar documento</h4><span class="muted" style="font-size:12px">Procuração, contrato, declaração e outros modelos, já preenchidos com os dados desta ficha.</span>
    <div class="statusbar"><button type="button" class="btn small" data-action="gerar-documento">Gerar documento a partir de modelo</button>${tipo === 'cliente' ? '<button type="button" class="btn small primary" data-action="kit-entrada">Kit de entrada</button>' : ''}</div></div>` : '';
})(window.App);
