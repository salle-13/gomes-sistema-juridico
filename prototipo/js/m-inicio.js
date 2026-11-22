/* Início (painel inicial): ponto de entrada do sistema.
   Estrutura modular: cada quadro (widget) se registra com A.widget(id, def) em m-inicio-widgets.js.
   Este arquivo cuida da rota, do cabeçalho, do layout, das permissões, dos atalhos e da personalização por pessoa.
   Nada aqui grava dados: os quadros só leem as coleções e usam as ações que os módulos já registram. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;

  /* ---------- ícones (traço único, mesmo estilo do sino) ---------- */
  const ICONES = {
    processo: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    arquivo: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    tarefa: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    prazo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    audiencia: '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M5 7h14"/><path d="m5 7-3 6a3 3 0 0 0 6 0z"/><path d="m19 7-3 6a3 3 0 0 0 6 0z"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bolo: '<path d="M4 21v-9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9"/><path d="M2 21h20"/><path d="M4 15c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0"/><path d="M12 10V7"/><path d="M12 4.5c.8-.7.8-1.8 0-2.5-.8.7-.8 1.8 0 2.5"/>',
    raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6"/>',
    atividade: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    telefone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    equipe: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    jornal: '<path d="M4 4h13a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    ajustes: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    mensagem: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    modelo: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  };
  A.ico = (nome, tam) => `<svg class="ico" width="${tam || 18}" height="${tam || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

  /* ---------- registro de quadros ---------- */
  // def: {titulo, icone, tam: 'g' (linha inteira) | 'm' (meia linha), visivel(): bool (permissões), render(ctx): html, acoes?(ctx): html}
  A.WIDGETS = [];
  A.widget = (id, def) => { A.WIDGETS.push(Object.assign({id, tam: 'm'}, def)); };

  /* ---------- atalhos (todos usam formulários e telas que já existem) ---------- */
  // pode(): permissão; run(): o que o atalho faz.
  A.ATALHOS = [
    {id: 'novo-processo', rotulo: 'Nova pasta / processo', icone: 'processo', pode: () => A.pode('processos', 'editar'), run: () => A.actions['novo-processo']()},
    {id: 'novo-cliente', rotulo: 'Novo cliente', icone: 'clientes', pode: () => A.pode('clientes', 'editar'), run: () => A.actions['novo-cliente']()},
    {id: 'nova-tarefa', rotulo: 'Nova tarefa', icone: 'tarefa', pode: () => A.pode('prazos', 'editar'), run: () => A.formComp(null, {tipo: 'Tarefa interna'})},
    {id: 'novo-comp', rotulo: 'Novo compromisso', icone: 'calendario', pode: () => A.pode('prazos', 'editar'), run: () => A.formComp(null)},
    {id: 'novo-prazo', rotulo: 'Novo prazo', icone: 'prazo', pode: () => A.pode('prazos', 'editar'), run: () => A.formPrazo(null)},
    {id: 'novo-doc', rotulo: 'Enviar documento', icone: 'doc', pode: () => A.pode('documentos', 'editar'), run: () => A.go('documentos')},
    {id: 'agenda', rotulo: 'Abrir agenda', icone: 'calendario', pode: () => A.pode('prazos', 'ver'), run: () => A.go('agenda')},
    {id: 'processos', rotulo: 'Consultar processos', icone: 'busca', pode: () => A.pode('processos', 'ver'), run: () => A.go('processos')},
    {id: 'publicacoes', rotulo: 'Publicações', icone: 'jornal', pode: () => A.pode('publicacoes', 'ver'), run: () => A.go('publicacoes')},
    {id: 'djen', rotulo: 'Buscar no DJEN', icone: 'jornal', pode: () => A.pode('publicacoes', 'editar'), run: () => { A.go('publicacoes'); A.actions['pub-djen'](); }},
    {id: 'modelos', rotulo: 'Gerar documento de modelo', icone: 'modelo', pode: () => A.pode('modelos', 'ver'), run: () => A.go('modelos')},
    {id: 'relatorios', rotulo: 'Relatórios', icone: 'equipe', pode: () => A.pode('relatorios', 'ver'), run: () => A.go('relatorios')},
  ];
  const ATALHOS_PADRAO = ['novo-processo', 'novo-cliente', 'nova-tarefa', 'novo-comp', 'novo-prazo', 'novo-doc', 'agenda', 'processos'];

  /* ---------- personalização (por pessoa, neste navegador) ---------- */
  const chavePrefs = () => 'gomes-inicio-' + (S.meId || (S.contaId ? 'conta-' + S.contaId : 'admin'));
  const padrao = () => ({ordem: A.WIDGETS.map(w => w.id), ocultos: [], atalhos: ATALHOS_PADRAO.slice(), escopo: S.meId ? 'meu' : 'equipe'});
  function prefs() {
    let p = null; try { p = JSON.parse(A.lsGet(chavePrefs()) || 'null'); } catch (e) {}
    const d = padrao(); if (!p || typeof p !== 'object') return d;
    const ids = A.WIDGETS.map(w => w.id), ordem = (Array.isArray(p.ordem) ? p.ordem : []).filter(id => ids.includes(id));
    ids.forEach(id => { if (!ordem.includes(id)) ordem.push(id); }); // quadro novo entra no fim
    return {ordem, ocultos: Array.isArray(p.ocultos) ? p.ocultos : [], atalhos: Array.isArray(p.atalhos) ? p.atalhos : d.atalhos, escopo: p.escopo === 'meu' && S.meId ? 'meu' : 'equipe'};
  }
  const gravarPrefs = p => A.lsSet(chavePrefs(), JSON.stringify(p));
  A.inicioPrefs = prefs;

  /* ---------- contexto passado aos quadros ---------- */
  function contexto(pr) {
    const h = A.hoje(), meu = pr.escopo === 'meu' && S.meId;
    return {
      h, ant: Number(S.config.antecedencia) || 5, escopo: meu ? 'meu' : 'equipe', prefs: pr,
      // item pertence à visão atual? (minha: responsável ou participante; equipe: tudo)
      meu: (resp, participantes) => !meu || resp === S.meId || (participantes || []).includes(S.meId),
      sit: p => P.situacao(p, h, Number(S.config.antecedencia) || 5),
      ui: A.ui('inicio', {dia: '', radar: '', mon: ''}),
    };
  }
  A.inicioCtx = () => contexto(prefs());

  /* ---------- cabeçalho ---------- */
  function saudacao() { const hr = new Date().getHours(); return hr < 5 ? 'Boa noite' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; }
  function dataExtenso() { const d = new Date(), dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${A.MESES[d.getMonth()]} de ${d.getFullYear()}`; }
  function cabecalho(pr) {
    const me = A.me(), nome = me ? me.nome : (S.mode === 'local' ? 'Administrador' : '');
    const util = P.diaUtil(A.hoje());
    return `<div class="dash-hero">
      <div class="dash-hero-txt"><p class="dash-data">${esc(dataExtenso())}${util ? '' : ' · <span>dia não útil</span>'}</p>
        <h2>${esc(saudacao())}${nome ? ', ' + esc(nome) : ''}</h2>
        <p class="muted">${esc(S.config.escritorioNome || 'Gomes Assessoria Jurídica')} · ${pr.escopo === 'meu' ? 'mostrando o que é seu' : 'mostrando toda a equipe'}</p></div>
      <div class="dash-hero-acts">
        ${S.meId ? `<div class="seg" role="group" aria-label="Visão do painel"><button data-action="ini-escopo" data-v="meu" aria-pressed="${pr.escopo === 'meu'}">Minha visão</button><button data-action="ini-escopo" data-v="equipe" aria-pressed="${pr.escopo === 'equipe'}">Equipe</button></div>` : ''}
        <button class="btn" data-action="ini-personalizar">${A.ico('ajustes', 16)} Personalizar</button></div></div>`;
  }

  /* ---------- quadros ---------- */
  function caixa(w, ctx) {
    let corpo, acoes = '';
    try { corpo = w.render(ctx); acoes = w.acoes ? w.acoes(ctx) : ''; }
    catch (e) { console.error('Início: erro no quadro', w.id, e); corpo = A.vazio('alerta', 'Não foi possível montar este quadro.', 'Os demais continuam funcionando. Recarregue a página; se persistir, avise o suporte.'); }
    return `<section class="dw dw-${w.tam}" aria-labelledby="dw-${w.id}"><header class="dw-head"><span class="dw-ic">${A.ico(w.icone)}</span><h3 id="dw-${w.id}">${esc(w.titulo)}</h3>${acoes ? `<span class="dw-acts">${acoes}</span>` : ''}</header><div class="dw-body">${corpo}</div></section>`;
  }
  // Estado vazio padrão dos quadros
  A.vazio = (icone, titulo, texto) => `<div class="dw-vazio">${A.ico(icone, 26)}<b>${esc(titulo)}</b>${texto ? `<span>${esc(texto)}</span>` : ''}</div>`;
  const visiveis = pr => pr.ordem.map(id => A.WIDGETS.find(w => w.id === id)).filter(w => w && (!w.visivel || w.visivel()));

  function vInicio() {
    const pr = prefs();
    if (S.mode === 'loading') return `<div class="dash">${cabecalho(pr)}<div class="dash-grid">${'<section class="dw dw-m dw-sk" aria-hidden="true"><span></span><span></span><span></span></section>'.repeat(4)}</div><p class="sr-only" role="status">Carregando o painel…</p></div>`;
    const ctx = contexto(pr), ws = visiveis(pr).filter(w => !pr.ocultos.includes(w.id));
    const aviso = S.mode === 'slow' ? '<div class="notice" style="margin:0"><span>Os dados ainda estão chegando; os números podem mudar em instantes.</span></div>' : '';
    return `<div class="dash">${cabecalho(pr)}${aviso}<div class="dash-grid">${ws.map(w => caixa(w, ctx)).join('') ||
      `<section class="dw dw-g"><div class="dw-body">${A.vazio('ajustes', 'Todos os quadros estão ocultos.', 'Use Personalizar para escolher o que aparece aqui.')}</div></section>`}</div></div>`;
  }
  A.route('inicio', {label: 'Início', mod: null, render: vInicio});

  /* ---------- navegação a partir do painel (com filtros) ---------- */
  // data-ir: processos | clientes | agenda | notificacoes | publicacoes; demais data-* viram filtros.
  A.on('ini-ir', el => {
    const d = el.dataset, ctx = A.inicioCtx();
    if (d.ir === 'processos') { Object.assign(A.ui('processos'), {status: d.status ?? 'ativo', busca: '', area: '', resp: d.resp || ''}); A.go('processos'); }
    else if (d.ir === 'clientes') { Object.assign(A.ui('clientes'), {aba: 'carteira', cart: d.cart || 'ativo', busca: ''}); A.go('clientes'); }
    else if (d.ir === 'agenda') {
      Object.assign(A.ui('agenda'), {visao: d.visao || 'lista', status: 'abertos', busca: d.busca || '', mostrar: d.mostrar || 'tudo',
        resp: d.resp || (ctx.escopo === 'meu' ? S.meId : 'todos')});
      if (d.dia) { const a = A.ui('agenda'), dt = P.parse(d.dia); a.dia = d.dia; a.ano = dt.getFullYear(); a.mes = dt.getMonth(); }
      A.go('agenda'); }
    else if (d.ir === 'publicacoes') { Object.assign(A.ui('publicacoes'), {status: d.status ?? 'nova', resp: d.resp || ''}); A.go('publicacoes'); }
    else A.go(d.ir || 'inicio');
  });
  // Abre um registro na tela do módulo (mesma lógica da Central de Notificações)
  A.on('ini-abrir', el => { const d = el.dataset;
    if (d.a === 'editar-prazo' || d.a === 'editar-comp') { const reg = A.byId(d.a === 'editar-prazo' ? 'prazos' : 'compromissos', d.id), dia = reg && (reg.vencimento || reg.data);
      if (dia) { const a = A.ui('agenda'), dt = P.parse(dia); a.dia = dia; a.ano = dt.getFullYear(); a.mes = dt.getMonth(); } }
    if (d.rota) A.go(d.rota);
    if (d.a && A.actions[d.a]) A.actions[d.a]({dataset: {id: d.id}});
  });
  A.on('ini-atalho', el => { const a = A.ATALHOS.find(x => x.id === el.dataset.id); if (a && a.pode()) a.run(); });
  A.on('ini-escopo', el => { const p = prefs(); p.escopo = el.dataset.v === 'meu' && S.meId ? 'meu' : 'equipe'; gravarPrefs(p); A.render(); });
  A.on('ini-aba', el => { A.ui('inicio')[el.dataset.k] = el.dataset.v; A.render(); });

  /* ---------- personalizar ---------- */
  function modalPersonalizar() {
    const pr = prefs(), ws = visiveis(pr), ats = A.ATALHOS.filter(a => a.pode());
    A.modal(`${A.modalHead('Personalizar o início')}<div class="dash-pers">
      <p class="muted" style="margin:0">As escolhas valem só para você, neste navegador.</p>
      <h4>Quadros</h4><ol class="dash-pers-lista">${ws.map((w, i) => `<li><label><input type="checkbox" data-onchange="ini-mostrar" data-id="${esc(w.id)}" ${pr.ocultos.includes(w.id) ? '' : 'checked'}> ${A.ico(w.icone, 16)} ${esc(w.titulo)}</label>
        <span><button class="iconbtn" data-action="ini-mover" data-id="${esc(w.id)}" data-d="-1" aria-label="Subir ${esc(w.titulo)}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="iconbtn" data-action="ini-mover" data-id="${esc(w.id)}" data-d="1" aria-label="Descer ${esc(w.titulo)}" ${i === ws.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('')}</ol>
      <h4>Atalhos</h4><div class="dash-pers-atalhos">${ats.map(a => `<label><input type="checkbox" data-onchange="ini-atalho-tg" data-id="${esc(a.id)}" ${pr.atalhos.includes(a.id) ? 'checked' : ''}> ${esc(a.rotulo)}</label>`).join('')}</div>
      </div><footer><button class="btn" data-action="ini-padrao">Restaurar padrão</button><button class="btn primary" data-action="modal-fechar">Concluir</button></footer>`, {nofocus: true});
  }
  const mudar = fn => { const p = prefs(); fn(p); gravarPrefs(p); modalPersonalizar(); A.render(); };
  A.on('ini-personalizar', modalPersonalizar);
  A.on('ini-mostrar', el => mudar(p => { p.ocultos = p.ocultos.filter(id => id !== el.dataset.id); if (!el.checked) p.ocultos.push(el.dataset.id); }));
  A.on('ini-atalho-tg', el => mudar(p => { p.atalhos = p.atalhos.filter(id => id !== el.dataset.id); if (el.checked) p.atalhos.push(el.dataset.id); }));
  A.on('ini-mover', el => mudar(p => {
    // move entre os quadros que a pessoa pode ver (os sem permissão ficam onde estão)
    const vis = visiveis(p).map(w => w.id), i = vis.indexOf(el.dataset.id), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= vis.length) return;
    const a = p.ordem.indexOf(vis[i]), b = p.ordem.indexOf(vis[j]); [p.ordem[a], p.ordem[b]] = [p.ordem[b], p.ordem[a]]; }));
  A.on('ini-padrao', () => { try { localStorage.removeItem(chavePrefs()); } catch (e) {} modalPersonalizar(); A.render(); A.toast('Layout padrão restaurado.'); });
})(window.App);
