/* Inicialização, navegação, faixa de alertas e distribuição de eventos. Carregado por último. */
(function (A) {
  const S = A.S, P = A.P;
  const GRUPOS = [
    ['Rotina', ['inicio','agenda','notificacoes']],
    ['Jurídico', ['processos','publicacoes','clientes','documentos','modelos']],
    ['Financeiro', ['fin','fin-receber','fin-pagar','fin-custas','fin-fluxo','fin-centros']],
    ['Gestão', ['relatorios','usuarios','equipe','config']],
  ];
  const ICONES_NAV = {
    inicio: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    notificacoes: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    processos: '<path d="M4 4h6l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M2 9h20"/>',
    publicacoes: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 7h10M7 11h10M7 15h6"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.8a4 4 0 0 1 0 7.6M22 21v-2a4 4 0 0 0-3-3.87"/>',
    documentos: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 13h8M8 17h8"/>',
    modelos: '<rect x="4" y="4" width="14" height="16" rx="2"/><path d="M8 2h10a2 2 0 0 1 2 2v14M8 9h6M8 13h6"/>',
    fin: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 3h10M7 15h3"/>',
    'fin-receber': '<path d="M12 3v13m0 0 5-5m-5 5-5-5"/><path d="M5 21h14"/>',
    'fin-pagar': '<path d="M12 21V8m0 0 5 5m-5-5-5 5"/><path d="M5 3h14"/>',
    'fin-custas': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2"/>',
    'fin-fluxo': '<path d="M3 3v18h18M7 14l4-4 4 3 6-7"/>',
    'fin-centros': '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1m-5 7v-4h4v4"/>',
    relatorios: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.8a4 4 0 0 1 0 7.6M22 21v-2a4 4 0 0 0-3-3.87"/>',
    equipe: '<circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-10a4 4 0 0 0 0-8m2 10a6 6 0 0 1 3 5v1"/>',
    config: '<path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54A.49.49 0 0 0 13.88 2h-3.76a.49.49 0 0 0-.49.42L9.27 4.96c-.59.23-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.95s.02.63.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.61.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.76c.24 0 .45-.18.49-.42l.36-2.54c.59-.23 1.13-.55 1.63-.94l2.39.96c.24.09.49-.01.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/>',
  };

  A.on('sim-perfil', el => {
    if (!A.podeAdministrarReal()) return;
    const permitido = ['admin', 'advogado', 'assistente', 'consulta'];
    if (!permitido.includes(el.value)) return;
    S.visualizarComo = el.value === 'admin' ? '' : el.value; A.render();
  });

  /* ---------- quem está usando ---------- */
  function resolverUsuario() {
    if (S.mode === 'local') { const id = A.sessaoId(); const m = A.membro(id); S.meId = m && m.ativo !== false ? id : ''; return; }
    const m = S.contaId ? A.col('equipe').find(x => x.contaId === S.contaId) : null;
    S.meId = m ? m.id : '';
  }

  /* ---------- render principal ---------- */
  let mudouCampo = false; // true quando o redesenho vem de uma escolha feita num campo (evento change)
  A.renderNow = function () {
    resolverUsuario();
    if (A.renderLogin()) return; // modo local sem ninguém identificado: tela de acesso (js/login.js)
    let rota = (location.hash || '#inicio').slice(1);
    if (A.aliases && A.aliases[rota]) { A.aliases[rota](); rota = 'agenda'; history.replaceState(null, '', '#agenda'); }
    if (!A.routes[rota]) rota = 'inicio';
    S.rota = rota;
    renderNav(rota); renderTopo(); renderAlertas(); renderAviso(); A.renderSino && A.renderSino(); A.renderBusca && A.renderBusca();
    const r = A.routes[rota], main = document.getElementById('main');
    if (r.mod && !A.pode(r.mod, 'ver')) { main.className = 'single'; main.innerHTML = `<section class="panel lock"><h2>Acesso restrito</h2><p>Seu papel (${A.esc(A.PAPEL_LABEL[A.papel()] || 'sem vínculo')}) não tem acesso a ${A.esc(r.label)}. Fale com o administrador do escritório.</p></section>`; return; }
    // Lista suspensa (select) em uso: redesenhar agora a fecharia na mão da pessoa. Adia até ela escolher ou sair do campo.
    const ativo = document.activeElement;
    if (!mudouCampo && ativo && ativo.tagName === 'SELECT' && main.contains(ativo)) {
      if (!ativo._adiado) { ativo._adiado = true; ativo.addEventListener('blur', () => { ativo._adiado = false; A.render(); }, {once: true}); }
      return; }
    mudouCampo = false;
    const lado = r.lado ? r.lado() : '';
    main.className = lado ? '' : 'single';
    const foco = document.activeElement && document.activeElement.id && main.contains(document.activeElement) ? [document.activeElement.id, document.activeElement.selectionStart] : null;
    const finTabs = ['fin','fin-receber','fin-pagar','fin-custas','fin-fluxo','fin-centros']
      .filter(id => A.routes[id] && A.pode(A.routes[id].mod, 'ver'));
    const barraFin = finTabs.includes(rota)
      ? `<nav class="fin-tabs" aria-label="Navegação do financeiro">${finTabs.map(id => `<a href="#${id}"${id === rota ? ' aria-current="page"' : ''}>${A.esc(A.routes[id].label)}</a>`).join('')}</nav>`
      : '';
    main.innerHTML = barraFin + r.render() + lado;
    if (foco) { const el = document.getElementById(foco[0]); if (el) { el.focus(); try { if (foco[1] != null) el.setSelectionRange(foco[1], foco[1]); } catch (_) {} } }
    if (r.depois) r.depois();
  };

  function renderNav(rota) {
    const nav = document.getElementById('nav');
    const grupos = GRUPOS.map(([g, ids]) => { const itens = ids.filter(id => A.routes[id] && (!A.routes[id].mod || A.pode(A.routes[id].mod, 'ver')));
      return itens.length ? `<div class="grp"><b>${g}</b>${itens.map(id => { const r = A.routes[id]; const n = r.badge ? r.badge() : 0;
        return `<a href="#${id}" ${id === rota ? 'aria-current="page"' : ''}><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_NAV[id] || ICONES_NAV.documentos}</svg></span><span class="nav-label">${A.esc(r.label)}</span>${n ? `<span class="tabbadge">${n}</span>` : ''}</a>`; }).join('')}</div>` : ''; }).join('');
    const saiu = S.mode === 'local' ? '<div class="side-logout"><button type="button" data-action="sair" title="Sair do sistema"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg><span>Sair</span></button></div>' : '';
    nav.innerHTML = `<div class="side-brand"><img src="logo.png" alt=""><span class="side-brand-copy"><strong>GOMES</strong><small>SISTEMA JURÍDICO</small></span></div>${grupos}${saiu}`;
  }

  function renderTopo() {
    const ml = document.getElementById('modeline');
    ml.textContent = S.mode === 'db' ? 'Sistema compartilhado da equipe · atualiza em tempo real' + (S.canWrite ? '' : ' · somente leitura')
      : S.mode === 'local' ? 'Modo local: os dados ficam só neste navegador' : S.mode === 'slow' ? 'Os dados ainda não chegaram; o que aparece pode estar desatualizado'
      : S.mode === 'erro' ? 'Não foi possível carregar os dados compartilhados' : 'Carregando…';
    const chip = document.getElementById('mechip'), me = A.me();
    if (S.mode === 'local') {
      chip.innerHTML = me ? `${A.avatar(me)}<div><div>${A.esc(me.nome)}</div><div class="role">${A.esc(A.PAPEL_LABEL[me.papel] || '')}</div></div>` : `<span class="role">Administrador</span>`;
    } else if (me) {
      chip.innerHTML = `${A.avatar(me)}<div><div>${A.esc(me.nome)}</div><div class="role">${A.esc(A.PAPEL_LABEL[me.papel] || '')}${S.isOwner ? ' · dono' : ''}</div></div>`;
    } else {
      const pend = S.contaId && A.col('equipe').find(x => x.contaPendente && x.contaPendente.id === S.contaId);
      chip.innerHTML = S.isOwner && !A.col('equipe').length ? '<span class="role">Administrador</span>'
        : pend ? `<span class="role">Vínculo com ${A.esc(pend.nome)} aguardando aprovação</span>`
        : S.contaId ? `<button class="btn small" data-action="vincular-conta">${S.isOwner ? 'Vincular minha conta' : 'Identificar-me na equipe'}</button>` : '';
    }
    const sim = document.getElementById('simControl');
    if (A.podeAdministrarReal()) {
      sim.innerHTML = `<label class="sim-select"><span>Visualizar como</span><select aria-label="Visualizar como perfil" data-onchange="sim-perfil"><option value="admin"${S.visualizarComo === 'admin' ? ' selected' : ''}>Administrador</option><option value="advogado"${S.visualizarComo === 'advogado' ? ' selected' : ''}>Advogado</option><option value="assistente"${S.visualizarComo === 'assistente' ? ' selected' : ''}>Assistente</option><option value="consulta"${S.visualizarComo === 'consulta' ? ' selected' : ''}>Consulta</option></select></label>`;
    } else sim.innerHTML = '';
    const n = document.querySelector('[data-action="novo-prazo"]'); if (n) n.hidden = !A.pode('prazos', 'editar');
  }

  function renderAlertas() {
    const el = document.getElementById('alerts');
    if (S.rota !== 'inicio') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (S.mode === 'loading') { el.className = 'alerts'; el.innerHTML = '<span class="muted">Verificando prazos…</span>'; return; }
    const h = A.hoje(), ant = Number(S.config.antecedencia) || 5, filtro = A.ui('agenda', {resp: 'todos'}).resp;
    const chips = []; const g = {vencido: [], hoje: [], critico: [], atencao: []};
    if (A.pode('prazos', 'ver')) A.col('prazos').filter(p => p.status !== 'concluido' && (filtro === 'todos' || p.responsavelId === filtro)).forEach(p => { const s = P.situacao(p, h, ant); if (g[s]) g[s].push(p); });
    const urg = [...g.vencido, ...g.hoje, ...g.critico, ...g.atencao].sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    const quente = g.vencido.length + g.hoje.length + g.critico.length;
    const c = (k, txt) => g[k].length ? `<span class="count s-${k}">${g[k].length} ${txt}</span>` : '';
    if (A.pode('prazos', 'ver')) { const n = A.col('compromissos').filter(c => c.data === h && c.status !== 'concluido' && (filtro === 'todos' || c.responsavelId === filtro || (c.participantes || []).includes(filtro))).length; if (n) chips.push(`<button class="achip" data-action="ag-ver-dia" data-dia="${h}" style="font-weight:600">${n} compromisso(s) hoje</button>`); }
    if (A.pode('publicacoes', 'ver')) { const n = A.col('publicacoes').filter(p => p.status === 'nova').length; if (n) chips.push(`<a class="achip" href="#publicacoes" style="border-color:var(--accent);color:var(--accent);font-weight:600;text-decoration:none">${n} publicação(ões) nova(s) para tratar</a>`); }
    if (A.pode('clientes', 'ver')) { const n = A.aguardando ? A.aguardando().length : 0; if (n) chips.push(`<a class="achip" href="#clientes" style="border-color:var(--accent);color:var(--accent);font-weight:600;text-decoration:none">${n} caso(s) novo(s) aguardando análise</a>`); }
    if (A.pode('financeiro', 'ver')) { const v = A.col('fin_lancamentos').filter(f => f.status === 'pendente' && f.vencimento <= h);
      const pg = v.filter(f => f.tipo === 'pagar').length, rc = v.filter(f => f.tipo === 'receber').length;
      if (pg) chips.push(`<a class="achip s-critico" href="#fin-pagar" style="text-decoration:none;color:var(--warn);font-weight:600">${pg} conta(s) a pagar vencida(s) ou vencendo hoje</a>`);
      if (rc) chips.push(`<a class="achip" href="#fin-receber" style="text-decoration:none;font-weight:600">${rc} recebimento(s) em atraso</a>`); }
    el.className = 'alerts ' + (quente ? 'hot' : (urg.length || chips.length) ? '' : 'calm');
    const inicio = urg.length ? `<span class="pulse" aria-hidden="true"></span><strong>Atenção aos prazos</strong><span class="counts">${c('vencido','vencido(s)')}${c('hoje','vence(m) hoje')}${c('critico','em até 2 dias úteis')}${c('atencao','em até ' + ant + ' dias úteis')}</span>`
      : `<span class="pulse" aria-hidden="true"></span><strong>Nenhum prazo nos próximos ${ant} dias úteis.</strong>`;
    el.innerHTML = inicio + `<span class="chips">${urg.slice(0, 5).map(p => `<button class="achip s-${P.situacao(p, h, ant)}" data-action="editar-prazo" data-id="${A.esc(p.id)}"><span class="pill">${A.esc(A.fmt(p.vencimento).slice(0, 5))}</span><span>${A.esc(p.tipo)} · ${A.esc(A.cliente(p.clienteId)?.nome || p.cliente || p.processo)}</span>${A.avatar(A.membro(p.responsavelId))}</button>`).join('')}${urg.length > 5 ? `<a class="achip" href="#prazos">+${urg.length - 5} outros</a>` : ''}${chips.join('')}</span>`;
    document.title = (quente ? '(' + quente + ') ' : '') + 'Gomes · Sistema Jurídico';
  }

  function renderAviso() {
    const el = document.getElementById('notice');
    const tem = A.COLS.some(c => A.col(c).some(x => x.exemplo));
    el.innerHTML = tem && A.pode('equipe', 'editar') ? `<div class="notice"><span>O sistema está com <strong>dados de exemplo</strong> para testes. Quando for usar de verdade, remova-os.</span><button class="btn small" data-action="limpar-exemplos">Remover exemplos</button></div>` : '';
  }
  A.on('limpar-exemplos', () => A.confirm('Remover dados de exemplo', 'Todos os registros de exemplo (equipe, clientes, processos, publicações, prazos, compromissos e financeiro) serão apagados. O que vocês cadastraram continua.', 'Remover exemplos', async () => {
    for (const c of A.COLS) for (const x of A.col(c).filter(x => x.exemplo)) await A.remove(c, x.id);
    A.toast('Exemplos removidos.');
  }));

  /* ---------- vínculo da conta com a equipe ---------- */
  A.on('vincular-conta', () => {
    const livres = A.col('equipe').filter(m => !m.contaId);
    A.modal(`${A.modalHead('Quem é você na equipe?')}<div style="padding:14px 18px;display:flex;flex-direction:column;gap:8px">
      <p class="muted" style="margin:0">${S.isOwner ? 'Como dono do sistema, o vínculo é imediato.' : 'O administrador precisa aprovar o vínculo. Até lá, você só consegue visualizar.'}</p>
      ${livres.map(m => `<button class="pcard" data-action="pedir-vinculo" data-id="${A.esc(m.id)}" style="--c:${A.esc(m.cor)}"><span class="t">${A.esc(m.nome)}</span><span class="meta">${A.esc(m.cargo)} · ${A.esc(A.PAPEL_LABEL[m.papel] || '')}</span></button>`).join('') || '<span class="muted">Todos os membros já têm conta vinculada. Peça ao administrador para cadastrar você em Equipe.</span>'}
    </div>`);
  });
  A.on('pedir-vinculo', async el => {
    const m = A.membro(el.dataset.id); if (!m) return;
    const novo = Object.assign({}, m, S.isOwner ? {contaId: S.contaId, contaPendente: null} : {contaPendente: {id: S.contaId, em: new Date().toISOString()}});
    if (await A.save('equipe', novo)) { A.closeModal(); A.toast(S.isOwner ? 'Conta vinculada.' : 'Pedido enviado ao administrador.'); }
  });

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    if (A.ui('notif').aberto && !e.target.closest('#notif')) A.actions['notif-fechar']();
    if (A.ui('busca').aberto && !e.target.closest('#gsearch')) A.actions['busca-fechar']();
    const t = e.target.closest('[data-action]'); if (!t) return;
    const a = t.dataset.action;
    if (a === 'modal-fundo') { if (e.target === t && !document.querySelector('.modal.wide')) A.closeModal(); return; }
    if (a === 'modal-fechar') { A.closeModal(); return; }
    const f = A.actions[a]; if (f) { e.stopPropagation(); f(t, e); }
  });
  document.addEventListener('change', e => {
    const t = e.target; mudouCampo = true;
    if (t.dataset && t.dataset.onchange && A.actions[t.dataset.onchange]) { A.actions[t.dataset.onchange](t, e); return; }
    if (t.dataset && t.dataset.ui && t.tagName !== 'INPUT' || (t.dataset && t.dataset.ui && (t.type === 'checkbox' || t.type === 'date' || t.type === 'month'))) setUi(t);
  });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.oninput && A.actions[t.dataset.oninput]) { A.actions[t.dataset.oninput](t, e); return; } if (t.dataset && t.dataset.ui && t.tagName === 'INPUT' && !['checkbox','date','month'].includes(t.type)) setUi(t); });
  function setUi(t) { const [mod, key] = t.dataset.ui.split('.'); A.ui(mod)[key] = t.type === 'checkbox' ? t.checked : t.value; A.render(); }
  document.addEventListener('submit', e => { const t = e.target; if (t.dataset && t.dataset.onsubmit && A.actions[t.dataset.onsubmit]) A.actions[t.dataset.onsubmit](t, e); });
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.onfocus && A.actions[t.dataset.onfocus]) A.actions[t.dataset.onfocus](t, e); });
  document.addEventListener('keydown', e => { const t = e.target;
    if (t.dataset && t.dataset.onkeydown && A.actions[t.dataset.onkeydown]) { A.actions[t.dataset.onkeydown](t, e); return; }
    // "/" ou Ctrl+K levam à busca, a menos que a pessoa esteja digitando em outro campo
    if ((e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) { const b = document.getElementById('buscaQ'); if (b && !document.querySelector('.modal')) { e.preventDefault(); b.focus(); b.select(); } return; }
    if (e.key !== 'Escape') return; if (document.querySelector('.modal')) A.closeModal(); else if (A.ui('notif').aberto) A.actions['notif-fechar'](); });
  window.addEventListener('hashchange', () => A.render());

  /* ---------- carregamento dos dados ---------- */
  /* O papel "financeiro" deixou de existir e virou "gerente": membros já salvos com ele são convertidos. */
  const papelAntigo = equipe => equipe.filter(m => m.papel === 'financeiro');
  /* Membros fixos da equipe (seed.equipeFixa) que ainda não existem, por id ou pela OAB. */
  const faltamFixos = equipe => (A.seed.equipeFixa || []).filter(f => !equipe.some(m => m.id === f.id || (m.oab && A.oabChave && A.oabChave(m.oab) === A.oabChave(f.oab))));
  /* Membros fixos já gravados: completa campos vazios (ex.: OAB incluída depois) e o "Dr./Dra." do nome.
     Não sobrescreve o que foi preenchido na tela Equipe. Devolve os membros alterados (cópias). */
  const semTitulo = n => String(n || '').replace(/^\s*dra?\.\s*/i, '').trim().toLowerCase();
  const completarFixos = equipe => (A.seed.equipeFixa || []).map(f => { const m = equipe.find(x => x.id === f.id); if (!m) return null;
    const muda = {}; ['oab', 'email', 'cargo', 'genero'].forEach(k => { if (!m[k] && f[k]) muda[k] = f[k]; });
    if (m.nome !== f.nome && semTitulo(m.nome) === semTitulo(f.nome)) muda.nome = f.nome;
    return Object.keys(muda).length ? Object.assign({}, m, muda) : null; }).filter(Boolean);
  function iniciarLocal() {
    S.mode = 'local'; let d = null;
    try { d = JSON.parse(A.lsGet('gomes-sistema-v2') || 'null'); } catch (e) {}
    if (!d) { const s = A.seed(A.hoje(), P); d = {data: s.data, config: s.config, permissoes: null}; }
    // Coleção criada depois que os dados locais foram salvos (ex.: modelos): começa com os exemplos do seed.
    const faltam = A.COLS.filter(c => !(d.data && d.data[c])); if (faltam.length && d.data) { const s = A.seed(A.hoje(), P); faltam.forEach(c => d.data[c] = s.data[c] || []); }
    A.COLS.forEach(c => S.data[c] = (d.data && d.data[c]) || []);
    const fixos = faltamFixos(S.data.equipe); if (fixos.length) S.data.equipe.unshift(...fixos.map(m => Object.assign({}, m)));
    const antigos = papelAntigo(S.data.equipe); antigos.forEach(m => m.papel = 'gerente');
    const completos = completarFixos(S.data.equipe); completos.forEach(n => Object.assign(S.data.equipe.find(m => m.id === n.id), n));
    if (fixos.length || antigos.length || completos.length) A.Store.persistLocal();
    S.config = Object.assign(S.config, d.config || {}); S.permissoes = d.permissoes || null;
    P.setLocais(S.config.feriadosLocais || []); A.render(); A.depoisDeCarregar && A.depoisDeCarregar();
  }
  async function iniciar() {
    A.render();
    if (!window.claude || typeof window.claude.use !== 'function') { iniciarLocal(); return; }
    let db = null; try { db = await window.claude.use('db'); } catch (e) {}
    if (!db) { iniciarLocal(); return; }
    S.db = db; S.mode = 'db';
    window.claude.use('user').then(async u => { if (!u) return; S.user = u;
      try { S.isOwner = await u.isOwner(); S.contaId = await u.id(); const c = await u.can('data.write'); if (c === false) S.canWrite = false; } catch (e) {} A.render(); });
    window.claude.use('assets').then(a => { S.assets = A.protegerAssets(a || null); A.render(); }).catch(() => {});
    window.claude.use('downloads').then(d => { S.downloads = d || null; }).catch(() => {});
    const timer = setTimeout(() => { if (!S.loaded.prazos) { S.mode = 'slow'; A.render(); } }, 10000);
    const err = e => { clearTimeout(timer); S.mode = 'erro'; A.render(); };
    let avisou = false;
    const pronto = () => { if (['equipe','prazos'].every(c => S.loaded[c]) && !avisou) { avisou = true; clearTimeout(timer); if (S.mode === 'slow') S.mode = 'db';
      if (S.canWrite !== false) { faltamFixos(S.data.equipe).forEach(m => A.save('equipe', Object.assign({}, m))); papelAntigo(S.data.equipe).forEach(m => A.save('equipe', Object.assign({}, m, {papel: 'gerente'}))); completarFixos(S.data.equipe).forEach(m => A.save('equipe', m)); } A.depoisDeCarregar && A.depoisDeCarregar(); } };
    A.COLS.forEach(c => db.collection(A.Store.path(c)).onSnapshot(snap => {
      S.data[c] = snap.docs.map(d => Object.assign({id: d.id}, d.data()));
      if (!snap.metadata.fromCache) S.loaded[c] = true; A.render(); pronto(); A.aoAtualizar && A.aoAtualizar(c);
    }, c === 'prazos' ? err : () => {}));
    db.doc('config/geral').onSnapshot(s => { if (s.exists) S.config = Object.assign({antecedencia: 5, feriadosLocais: [], contas: ['Caixa', 'Conta corrente'], saldosIniciais: {}, escritorioNome: 'Gomes Assessoria Jurídica', escritorioCidade: 'Araguari/MG'}, s.data()); P.setLocais(S.config.feriadosLocais || []); A.render(); }, () => {});
    db.doc('config/permissoes').onSnapshot(s => { S.permissoes = s.exists ? s.data() : null; A.render(); }, () => {});
  }
  setInterval(() => { renderAlertas(); A.renderSino && A.renderSino(); }, 60000);
  iniciar();
})(window.App);
