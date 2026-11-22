/* Inicialização, navegação, faixa de alertas e distribuição de eventos. Carregado por último. */
(function (A) {
  const S = A.S, P = A.P;
  const GRUPOS = [
    ['Rotina', ['inicio','agenda','notificacoes']],
    ['Jurídico', ['processos','publicacoes','clientes','documentos','modelos']],
    ['Financeiro', ['fin','fin-receber','fin-pagar','fin-custas','fin-fluxo','fin-centros']],
    ['Gestão', ['relatorios','equipe','config']],
  ];

  /* ---------- quem está usando ---------- */
  function resolverUsuario() {
    if (S.mode === 'local') { const id = A.lsGet('gomes-eu'); S.meId = A.membro(id) ? id : ''; return; }
    const m = S.contaId ? A.col('equipe').find(x => x.contaId === S.contaId) : null;
    S.meId = m ? m.id : '';
  }

  /* ---------- render principal ---------- */
  let mudouCampo = false; // true quando o redesenho vem de uma escolha feita num campo (evento change)
  A.renderNow = function () {
    resolverUsuario();
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
    main.innerHTML = r.render() + lado;
    if (foco) { const el = document.getElementById(foco[0]); if (el) { el.focus(); try { if (foco[1] != null) el.setSelectionRange(foco[1], foco[1]); } catch (_) {} } }
    if (r.depois) r.depois();
  };

  function renderNav(rota) {
    const nav = document.getElementById('nav');
    nav.innerHTML = GRUPOS.map(([g, ids]) => { const itens = ids.filter(id => A.routes[id] && (!A.routes[id].mod || A.pode(A.routes[id].mod, 'ver')));
      return itens.length ? `<div class="grp"><b>${g}</b>${itens.map(id => { const r = A.routes[id]; const n = r.badge ? r.badge() : 0;
        return `<a href="#${id}" ${id === rota ? 'aria-current="page"' : ''}><span>${A.esc(r.label)}</span>${n ? `<span class="tabbadge">${n}</span>` : ''}</a>`; }).join('')}</div>` : ''; }).join('');
  }

  function renderTopo() {
    const ml = document.getElementById('modeline');
    ml.textContent = S.mode === 'db' ? 'Sistema compartilhado da equipe · atualiza em tempo real' + (S.canWrite ? '' : ' · somente leitura')
      : S.mode === 'local' ? 'Modo local: os dados ficam só neste navegador' : S.mode === 'slow' ? 'Os dados ainda não chegaram; o que aparece pode estar desatualizado'
      : S.mode === 'erro' ? 'Não foi possível carregar os dados compartilhados' : 'Carregando…';
    const chip = document.getElementById('mechip'), me = A.me();
    if (S.mode === 'local') {
      chip.innerHTML = `<label for="fEu" class="muted" style="font-size:12px">Você é</label><select id="fEu" data-onchange="trocar-eu">${A.opts(A.col('equipe').map(m => [m.id, m.nome]), S.meId, 'Administrador (sem nome)')}</select>`;
    } else if (me) {
      chip.innerHTML = `${A.avatar(me)}<div><div>${A.esc(me.nome)}</div><div class="role">${A.esc(A.PAPEL_LABEL[me.papel] || '')}${S.isOwner ? ' · dono' : ''}</div></div>`;
    } else {
      const pend = S.contaId && A.col('equipe').find(x => x.contaPendente && x.contaPendente.id === S.contaId);
      chip.innerHTML = S.isOwner && !A.col('equipe').length ? '<span class="role">Administrador</span>'
        : pend ? `<span class="role">Vínculo com ${A.esc(pend.nome)} aguardando aprovação</span>`
        : S.contaId ? `<button class="btn small" data-action="vincular-conta">${S.isOwner ? 'Vincular minha conta' : 'Identificar-me na equipe'}</button>` : '';
    }
    const n = document.querySelector('[data-action="novo-prazo"]'); if (n) n.hidden = !A.pode('prazos', 'editar');
  }

  function renderAlertas() {
    const el = document.getElementById('alerts');
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
  A.on('trocar-eu', el => { A.lsSet('gomes-eu', el.value); A.render(); });

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
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.onfocus && A.actions[t.dataset.onfocus]) A.actions[t.dataset.onfocus](t, e); });
  document.addEventListener('keydown', e => { const t = e.target;
    if (t.dataset && t.dataset.onkeydown && A.actions[t.dataset.onkeydown]) { A.actions[t.dataset.onkeydown](t, e); return; }
    // "/" ou Ctrl+K levam à busca, a menos que a pessoa esteja digitando em outro campo
    if ((e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) { const b = document.getElementById('buscaQ'); if (b && !document.querySelector('.modal')) { e.preventDefault(); b.focus(); b.select(); } return; }
    if (e.key !== 'Escape') return; if (document.querySelector('.modal')) A.closeModal(); else if (A.ui('notif').aberto) A.actions['notif-fechar'](); });
  window.addEventListener('hashchange', () => A.render());

  /* ---------- carregamento dos dados ---------- */
  /* Membros fixos da equipe (seed.equipeFixa) que ainda não existem, por id ou pela OAB. */
  const faltamFixos = equipe => (A.seed.equipeFixa || []).filter(f => !equipe.some(m => m.id === f.id || (m.oab && A.oabChave && A.oabChave(m.oab) === A.oabChave(f.oab))));
  function iniciarLocal() {
    S.mode = 'local'; let d = null;
    try { d = JSON.parse(A.lsGet('gomes-sistema-v2') || 'null'); } catch (e) {}
    if (!d) { const s = A.seed(A.hoje(), P); d = {data: s.data, config: s.config, permissoes: null}; }
    // Coleção criada depois que os dados locais foram salvos (ex.: modelos): começa com os exemplos do seed.
    const faltam = A.COLS.filter(c => !(d.data && d.data[c])); if (faltam.length && d.data) { const s = A.seed(A.hoje(), P); faltam.forEach(c => d.data[c] = s.data[c] || []); }
    A.COLS.forEach(c => S.data[c] = (d.data && d.data[c]) || []);
    const fixos = faltamFixos(S.data.equipe); if (fixos.length) { S.data.equipe.unshift(...fixos.map(m => Object.assign({}, m))); A.Store.persistLocal(); }
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
    window.claude.use('assets').then(a => { S.assets = a || null; A.render(); }).catch(() => {});
    window.claude.use('downloads').then(d => { S.downloads = d || null; }).catch(() => {});
    const timer = setTimeout(() => { if (!S.loaded.prazos) { S.mode = 'slow'; A.render(); } }, 10000);
    const err = e => { clearTimeout(timer); S.mode = 'erro'; A.render(); };
    let avisou = false;
    const pronto = () => { if (['equipe','prazos'].every(c => S.loaded[c]) && !avisou) { avisou = true; clearTimeout(timer); if (S.mode === 'slow') S.mode = 'db';
      if (S.canWrite !== false) faltamFixos(S.data.equipe).forEach(m => A.save('equipe', Object.assign({}, m))); A.depoisDeCarregar && A.depoisDeCarregar(); } };
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
