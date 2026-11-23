/* Central de notificações.
   As notificações NÃO são cópias dos registros: são geradas a cada renderização a partir dos dados
   dos módulos (prazos, compromissos, publicações, processos, financeiro, clientes, documentos, equipe).
   Cada uma tem uma chave estável (ex.: "prazo:<id>:vencido:<vencimento>"), o que impede duplicatas e faz
   a notificação reaparecer como nova quando a situação muda (prazo que passa de "atenção" para "vence hoje").
   Por pessoa, a coleção notif_estado guarda quando cada chave foi vista, lida ou dispensada.
   No banco definitivo, isso corresponde à tabela avisos (canal 'sistema'), ver docs/modelo-fisico.md. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const PRIO = {urgente: 0, atencao: 1, info: 2};
  const PRIO_LABEL = {urgente: 'Urgente', atencao: 'Atenção', info: 'Informativo'};
  const CATS = [['agenda','Agenda e prazos'],['publicacoes','Publicações'],['processos','Processos'],['financeiro','Financeiro'],['clientes','Clientes'],['documentos','Documentos'],['equipe','Equipe']];
  const CAT_LABEL = Object.fromEntries(CATS);
  const RECENTE = 3;      // dias em que um registro novo (andamento, documento, pagamento) vira notificação informativa
  const PARADO = 90;      // dias sem andamento para sinalizar processo parado
  const ATRASO_GRAVE = 30; // dias de atraso de recebimento que tornam a cobrança urgente
  const ui = () => A.ui('notif', {aberto: false, painel: 'naolidas', cat: '', sit: 'naolidas', prio: '', ordem: 'prioridade'});

  /* ---------- destinatário ---------- */
  // Quem não está identificado na equipe (modo local "Administrador") e o papel admin veem tudo;
  // as demais pessoas recebem o que é delas ou não tem responsável.
  const visaoGeral = () => !S.meId || A.papel() === 'admin';
  const paraMim = (resp, extras) => visaoGeral() || !resp || resp === S.meId || (extras || []).includes(S.meId);
  const deOutro = autor => !S.meId || autor !== S.meId;
  const dias = (de, ate) => Math.round((P.parse(ate) - P.parse(de)) / 86400000);
  const hora = c => c.diaInteiro ? 'dia inteiro' : (c.horaInicio || '') + (c.horaFim ? '–' + c.horaFim : '');
  const resumo = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

  /* ---------- regras de geração ---------- */
  A.gerarNotificacoes = function () {
    const h = A.hoje(), out = [], add = n => out.push(n);
    const ant = Number(S.config.antecedencia) || 5;

    if (A.pode('prazos', 'ver')) {
      const T = {vencido: 'Prazo vencido', hoje: 'Prazo vence hoje', critico: 'Prazo em até 2 dias úteis', atencao: 'Prazo se aproximando'};
      A.col('prazos').forEach(p => {
        if (p.status === 'concluido' || !p.vencimento || !paraMim(p.responsavelId)) return;
        const s = P.situacao(p, h, ant); if (!T[s]) return;
        add({chave: `prazo:${p.id}:${s}:${p.vencimento}`, cat: 'agenda', prio: s === 'atencao' ? 'atencao' : 'urgente',
          titulo: `${T[s]} · ${p.tipo || 'Prazo'}`, texto: [A.cliente(p.clienteId)?.nome || p.cliente, p.processo].filter(Boolean).join(' · ') || p.descricao,
          ref: p.vencimento, refTxt: (s === 'vencido' ? 'Venceu ' : 'Vence ') + A.fmt(p.vencimento), origem: p.criadoEm,
          resp: p.responsavelId, acao: {rota: 'agenda', a: 'editar-prazo', id: p.id}, dispensavel: false});
      });
      const ate7 = P.addDays(h, 7);
      A.col('compromissos').forEach(c => {
        if (c.status === 'concluido' || !c.data || !paraMim(c.responsavelId, c.participantes)) return;
        const base = {cat: 'agenda', ref: c.data, origem: c.criadoEm, resp: c.responsavelId, acao: {rota: 'agenda', a: 'editar-comp', id: c.id},
          texto: [A.cliente(c.clienteId)?.nome, A.processo(c.processoId)?.numero, c.local].filter(Boolean).join(' · ')};
        if (c.tipo === 'Audiência' && c.data >= h && c.data <= ate7)
          add(Object.assign({}, base, {chave: `comp:${c.id}:aud:${c.data === h ? 'hoje' : 'prox'}:${c.data}`, prio: c.data === h ? 'urgente' : 'atencao',
            titulo: `Audiência ${c.data === h ? 'hoje' : 'em ' + A.fmtCurto(c.data)} · ${c.titulo || ''}`, refTxt: `${A.fmt(c.data)} · ${hora(c)}`, dispensavel: c.data !== h}));
        else if (c.tipo === 'Tarefa interna' && c.data < h)
          add(Object.assign({}, base, {chave: `comp:${c.id}:tarefa-atrasada:${c.data}`, prio: 'atencao', titulo: `Tarefa pendente · ${c.titulo || ''}`,
            refTxt: 'Era para ' + A.fmt(c.data), dispensavel: true}));
        else if (c.data === h)
          add(Object.assign({}, base, {chave: `comp:${c.id}:hoje:${c.data}`, prio: 'info', titulo: `${c.tipo || 'Compromisso'} hoje · ${c.titulo || ''}`,
            refTxt: 'Hoje · ' + hora(c), dispensavel: true}));
      });
    }

    if (A.pode('publicacoes', 'ver'))
      A.col('publicacoes').forEach(p => {
        if (p.status !== 'nova' || !paraMim(p.responsavelId)) return;
        add({chave: `pub:${p.id}:nova`, cat: 'publicacoes', prio: 'atencao', titulo: `Publicação para tratar · ${p.tipo || 'Publicação'}`,
          texto: [p.numeroProcesso, A.cliente(A.processo(p.processoId)?.clienteId)?.nome, resumo(p.texto, 90)].filter(Boolean).join(' · '),
          ref: p.disponibilizacao || p.publicacao, refTxt: 'Disponibilizada ' + A.fmt(p.disponibilizacao || p.publicacao), origem: p.criadoEm,
          resp: A.respPub ? (A.respPub(p)?.id || '') : p.responsavelId, acao: {rota: 'publicacoes', a: 'abrir-pub', id: p.id}, dispensavel: false});
      });

    if (A.pode('processos', 'ver'))
      A.col('processos').forEach(pr => {
        if (!paraMim(pr.responsavelId)) return;
        const cli = A.cliente(pr.clienteId)?.nome, and = pr.andamentos || [];
        const base = {cat: 'processos', resp: pr.responsavelId, acao: {rota: 'processos', a: 'abrir-processo', id: pr.id}};
        and.forEach((a, i) => { if (!a.data || dias(a.data, h) > RECENTE || a.data > h || !deOutro(a.por)) return;
          add(Object.assign({}, base, {chave: `proc:${pr.id}:and:${i}:${a.data}`, prio: 'info', titulo: `Novo andamento · ${pr.numero}`,
            texto: [cli, resumo(a.texto, 110)].filter(Boolean).join(' · '), ref: a.data, refTxt: 'Registrado ' + A.fmt(a.data) + (a.por ? ' por ' + A.nomeDe(a.por) : ''), origem: a.data, dispensavel: true})); });
        if (pr.status !== 'ativo') return;
        if (!pr.responsavelId && (visaoGeral() || A.pode('processos', 'editar')))
          add(Object.assign({}, base, {chave: `proc:${pr.id}:sem-resp`, prio: 'atencao', titulo: `Processo sem responsável · ${A.rotuloProcesso(pr) || 'sem número'}`,
            texto: [cli, 'defina quem acompanha este processo'].filter(Boolean).join(' · '), ref: null, refTxt: 'Processo ativo', origem: pr.criadoEm, dispensavel: true}));
        const ultimo = and.map(a => a.data).filter(Boolean).sort().pop() || pr.distribuidoEm;
        const pend = A.col('prazos').some(p => p.processoId === pr.id && p.status !== 'concluido');
        if (ultimo && !pend && dias(ultimo, h) > PARADO)
          add(Object.assign({}, base, {chave: `proc:${pr.id}:parado:${ultimo}`, prio: 'info', titulo: `Processo sem movimentação · ${pr.numero}`,
            texto: [cli, `nenhum andamento há ${dias(ultimo, h)} dias e nenhum prazo em aberto`].filter(Boolean).join(' · '), ref: ultimo,
            refTxt: 'Último registro ' + A.fmt(ultimo), origem: null, dispensavel: true}));
      });

    if (A.pode('financeiro', 'ver')) {
      const ate3 = P.addDays(h, 3);
      // Quem edita o financeiro (ou tem a visão geral) recebe tudo; quem só visualiza recebe o que é dos seus clientes/processos.
      const finTodos = visaoGeral() || A.pode('financeiro', 'editar');
      const finMeu = f => finTodos || [A.cliente(f.clienteId)?.responsavelId, A.processo(f.processoId)?.responsavelId].includes(S.meId);
      A.col('fin_lancamentos').forEach(f => {
        if (!finMeu(f)) return;
        const rec = f.tipo === 'receber', hon = f.natureza === 'honorarios';
        const nome = rec ? (hon ? 'Honorários' : 'Recebimento') : 'Conta a pagar';
        const parc = f.parcela && f.parcela.total > 1 && !/parcela/i.test(f.descricao || '') ? ` (parcela ${f.parcela.n}/${f.parcela.total})` : '';
        const texto = [f.descricao + parc, A.cliente(f.clienteId)?.nome, A.brl(f.valor)].filter(Boolean).join(' · ');
        const base = {cat: 'financeiro', texto, origem: f.criadoEm, acao: {rota: rec ? 'fin-receber' : 'fin-pagar', a: 'fin-editar', id: f.id}};
        if (f.status === 'pago') {
          if (rec && f.pagoEm && f.pagoEm <= h && dias(f.pagoEm, h) <= RECENTE && deOutro(f.atualizadoPor))
            add(Object.assign({}, base, {chave: `fin:${f.id}:pago:${f.pagoEm}`, prio: 'info', titulo: `${hon ? 'Honorários recebidos' : 'Pagamento recebido'}`,
              texto: [f.descricao + parc, A.cliente(f.clienteId)?.nome, A.brl(f.valorPago || f.valor), f.conta].filter(Boolean).join(' · '),
              ref: f.pagoEm, refTxt: 'Baixa em ' + A.fmt(f.pagoEm), origem: f.atualizadoEm, dispensavel: true}));
          return;
        }
        if (f.status !== 'pendente' || !f.vencimento) return;
        const atraso = dias(f.vencimento, h);
        let k = '', prio = '', titulo = '';
        if (f.vencimento < h) { k = 'vencido'; prio = rec ? (atraso > ATRASO_GRAVE ? 'urgente' : 'atencao') : 'urgente'; titulo = rec ? `${nome} em atraso · cobrar` : `${nome} vencida`; }
        else if (f.vencimento === h) { k = 'hoje'; prio = rec ? 'atencao' : 'urgente'; titulo = `${nome} vence hoje`; }
        else if (f.vencimento <= ate3) { k = 'prox'; prio = rec ? 'info' : 'atencao'; titulo = `${nome} vence em ${A.fmtCurto(f.vencimento)}`; }
        if (!k) return;
        add(Object.assign({}, base, {chave: `fin:${f.id}:${k}:${f.vencimento}`, prio, titulo, ref: f.vencimento,
          refTxt: k === 'vencido' ? `Venceu ${A.fmt(f.vencimento)} · ${atraso} dia(s) de atraso` : 'Vence ' + A.fmt(f.vencimento), dispensavel: prio !== 'urgente'}));
      });
    }

    if (A.pode('clientes', 'ver')) {
      // Caso encaminhado: vai para quem foi indicado na análise (e para a visão geral), não para a equipe toda.
      const aguard = c => (c.status === 'encaminhado') && (visaoGeral() || (c.encaminhadoPara || []).includes(S.meId));
      A.col('clientes').forEach(c => {
        const st = c.status === 'aceito' ? 'ativo' : (c.status || 'novo');
        const base = {cat: 'clientes', origem: c.criadoEm, acao: {rota: 'clientes', a: 'abrir-cliente', id: c.id}};
        if (aguard(c))
          add(Object.assign({}, base, {chave: `cli:${c.id}:encaminhado`, prio: c.urgencia === 'alta' ? 'urgente' : 'atencao', titulo: `Caso aguardando análise · ${c.nome}`,
            texto: [c.area, resumo(c.historia, 110)].filter(Boolean).join(' · '), ref: A.hoje(), refTxt: 'Encaminhado para ' + (c.encaminhadoPara || []).map(A.nomeDe).join(', '), dispensavel: false}));
        else if (st === 'novo' && A.pode('clientes', 'editar'))
          add(Object.assign({}, base, {chave: `cli:${c.id}:novo`, prio: c.urgencia === 'alta' ? 'atencao' : 'info', titulo: `Novo caso cadastrado · ${c.nome}`,
            texto: [c.area, c.origem && 'origem: ' + c.origem, 'ainda não encaminhado'].filter(Boolean).join(' · '), ref: (c.criadoEm || '').slice(0, 10) || h,
            refTxt: c.criadoEm ? 'Cadastrado ' + A.fmt(c.criadoEm) : 'Aguardando encaminhamento', dispensavel: true}));
        else if (st === 'ativo' && paraMim(c.responsavelId)) {
          const falta = [!c.documento && (c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'), !c.telefone && !c.email && 'telefone ou e-mail', !c.endereco && 'endereço'].filter(Boolean);
          if (falta.length) add(Object.assign({}, base, {chave: `cli:${c.id}:incompleto:${falta.join(',')}`, prio: 'info', titulo: `Cadastro incompleto · ${c.nome}`,
            texto: 'Falta: ' + falta.join(', ') + ' (usado na qualificação dos modelos)', ref: null, refTxt: 'Cliente ativo', resp: c.responsavelId, dispensavel: true}));
        }
      });
    }

    if (A.pode('documentos', 'ver'))
      A.col('documentos').forEach(d => {
        const em = (d.enviadoEm || d.criadoEm || '').slice(0, 10);
        if (!em || em > h || dias(em, h) > RECENTE || !deOutro(d.enviadoPor || d.criadoPor)) return;
        add({chave: `doc:${d.id}:novo`, cat: 'documentos', prio: 'info', titulo: `Novo documento · ${d.nome}`,
          texto: [d.categoria, A.cliente(d.clienteId)?.nome, A.processo(d.processoId)?.numero].filter(Boolean).join(' · '),
          ref: em, refTxt: 'Enviado ' + A.fmt(em) + (d.enviadoPor ? ' por ' + A.nomeDe(d.enviadoPor) : ''), origem: d.enviadoEm || d.criadoEm,
          acao: {rota: 'documentos'}, dispensavel: true});
      });

    if (A.pode('equipe', 'editar'))
      A.col('equipe').filter(m => m.contaPendente).forEach(m =>
        add({chave: `eq:${m.id}:vinculo:${m.contaPendente.id}`, cat: 'equipe', prio: 'atencao', titulo: `Pedido de acesso · ${m.nome}`,
          texto: 'Uma conta pediu vínculo com este membro da equipe. Aprove ou recuse em Equipe.', ref: (m.contaPendente.em || '').slice(0, 10) || h,
          refTxt: m.contaPendente.em ? 'Pedido em ' + A.quando(m.contaPendente.em) : 'Pendente', origem: m.contaPendente.em, acao: {rota: 'equipe'}, dispensavel: false}));

    return out;
  };

  /* ---------- estado por pessoa (visto / lido / dispensado) ---------- */
  const docId = () => S.meId || (S.contaId ? 'conta-' + String(S.contaId).replace(/[^A-Za-z0-9_-]/g, '') : 'administrador');
  const estado = () => { const e = A.byId('notif_estado', docId()) || {};
    return {id: docId(), usuarioId: S.meId || null, vistas: e.vistas || {}, lidas: e.lidas || {}, dispensadas: e.dispensadas || {}}; };
  const carregado = () => S.mode === 'local' || A.COLS.every(c => S.loaded[c]);

  A.notificacoes = function () {
    const e = estado();
    return A.gerarNotificacoes().map(n => Object.assign(n, {
      criada: e.vistas[n.chave] || n.origem || null, lida: !!e.lidas[n.chave], dispensada: !!e.dispensadas[n.chave]}));
  };
  const ordenar = (arr, ordem) => arr.sort(ordem === 'recentes'
    ? (a, b) => String(b.criada || '').localeCompare(String(a.criada || '')) || PRIO[a.prio] - PRIO[b.prio]
    : (a, b) => PRIO[a.prio] - PRIO[b.prio] || (a.lida - b.lida) || String(a.ref || '9').localeCompare(String(b.ref || '9')));

  // Grava o estado da pessoa. Só limpa chaves que deixaram de existir quando todos os dados já chegaram,
  // para não apagar o histórico de leitura com base num carregamento parcial.
  async function gravar(mudar) {
    if (!S.canWrite) { A.toast('Sem permissão para salvar. Peça ao administrador acesso de Colaborador ou Editor.'); return; }
    const e = estado(), atuais = A.gerarNotificacoes().map(n => n.chave); mudar(e);
    if (carregado()) { const vivo = new Set(atuais); ['vistas','lidas','dispensadas'].forEach(k => { for (const c in e[k]) if (!vivo.has(c)) delete e[k][c]; }); }
    const antes = A.byId('notif_estado', e.id);
    await A.save('notif_estado', Object.assign({}, antes || {}, e));
  }
  // Registra a primeira vez que a pessoa recebeu cada notificação (é a "data de criação" exibida).
  let tVista = null;
  function registrarVistas(lista) {
    if (!carregado() || !S.canWrite || tVista) return;
    const e = estado(); if (!lista.some(n => !e.vistas[n.chave])) return;
    tVista = setTimeout(() => { tVista = null; const agora = new Date().toISOString();
      const novas = A.notificacoes().filter(n => !estado().vistas[n.chave]); if (!novas.length) return;
      gravar(x => novas.forEach(n => { x.vistas[n.chave] = agora; })); }, 1500);
  }

  /* ---------- sino e painel ---------- */
  const SINO = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const quando = n => n.criada ? (String(n.criada).length > 10 ? A.haDias(n.criada) : A.haDias(n.criada + 'T12:00:00')) : '';

  function item(n, completo) {
    const acoes = `<span class="notif-acts">
      <button class="notif-act" data-action="notif-lida" data-chave="${esc(n.chave)}" title="${n.lida ? 'Marcar como não lida' : 'Marcar como lida'}" aria-label="${n.lida ? 'Marcar como não lida' : 'Marcar como lida'}">${n.lida ? '○' : '✓'}</button>
      ${n.dispensavel ? `<button class="notif-act" data-action="notif-dispensar" data-chave="${esc(n.chave)}" title="${n.dispensada ? 'Restaurar' : 'Dispensar'}" aria-label="${n.dispensada ? 'Restaurar' : 'Dispensar'}">${n.dispensada ? '↺' : '×'}</button>` : ''}</span>`;
    return `<div class="notification-item p-${n.prio}${n.lida ? ' is-read' : ''}${n.prio === 'urgente' ? ' is-urgent' : ''}">
      <span class="notification-dot" title="${PRIO_LABEL[n.prio]}"></span>
      <button class="notification-copy" data-action="notif-abrir" data-chave="${esc(n.chave)}">
        <strong>${esc(n.titulo)}</strong>${n.texto ? `<span>${esc(n.texto)}</span>` : ''}
        <small><b class="ntag">${esc(CAT_LABEL[n.cat])}</b>${completo ? ` <b class="ntag np-${n.prio}">${PRIO_LABEL[n.prio]}</b>` : ''} ${esc(n.refTxt || '')}${n.criada ? ` · ${esc(completo ? 'recebida ' : '')}${esc(quando(n))}` : ''}${completo && n.resp ? ' · ' + esc(A.nomeDe(n.resp)) : ''}</small>
      </button>${acoes}</div>`;
  }

  A.renderSino = function () {
    const el = document.getElementById('notif'); if (!el) return;
    if (S.mode === 'loading') { el.innerHTML = ''; return; }
    const u = ui(), todas = A.notificacoes(), ativas = todas.filter(n => !n.dispensada);
    registrarVistas(todas);
    const naoLidas = ativas.filter(n => !n.lida), urg = naoLidas.filter(n => n.prio === 'urgente').length;
    const lista = ordenar(u.painel === 'todas' ? ativas : naoLidas, 'prioridade');
    const scroll = el.querySelector('.notification-list')?.scrollTop || 0;
    el.innerHTML = `<div class="notification-wrap">
      <button class="notification-trigger${urg ? ' has-urgent' : naoLidas.length ? ' has-new' : ''}" data-action="notif-toggle" aria-expanded="${u.aberto}" aria-label="Notificações: ${naoLidas.length} não lida(s)">${SINO}<i${naoLidas.length ? '' : ' hidden'}>${naoLidas.length > 99 ? '99+' : naoLidas.length}</i></button>
      <div class="notification-popover" role="dialog" aria-label="Notificações"${u.aberto ? '' : ' hidden'}>
        <div class="notification-head"><div><strong>Notificações</strong><small>${naoLidas.length ? `${naoLidas.length} não lida(s)${urg ? ` · <b style="color:var(--danger)">${urg} urgente(s)</b>` : ''}` : 'Tudo em dia'}</small></div>
          <div class="notif-headacts">${naoLidas.length ? '<button class="text-button" data-action="notif-todas-lidas" data-escopo="painel">Marcar todas como lidas</button>' : ''}<button class="iconbtn" data-action="notif-toggle" aria-label="Fechar">×</button></div></div>
        <div class="notif-tabs" role="tablist"><button data-action="notif-painel" data-v="naolidas" aria-pressed="${u.painel !== 'todas'}">Não lidas <span class="num">${naoLidas.length}</span></button><button data-action="notif-painel" data-v="todas" aria-pressed="${u.painel === 'todas'}">Todas <span class="num">${ativas.length}</span></button></div>
        <div class="notification-list">${lista.slice(0, 40).map(n => item(n, false)).join('') ||
          `<div class="notification-empty"><strong>${u.painel === 'todas' ? 'Nenhuma notificação' : 'Nenhuma notificação não lida'}</strong><span>Prazos, audiências, publicações, cobranças e novos casos aparecem aqui.</span></div>`}
          ${lista.length > 40 ? `<div class="notification-empty"><span>+${lista.length - 40} na página de notificações</span></div>` : ''}</div>
        <a class="notification-footer" href="#notificacoes" data-action="notif-ver-todas">Ver todas as notificações →</a>
      </div></div>`;
    const ls = el.querySelector('.notification-list'); if (ls && scroll) ls.scrollTop = scroll;
  };

  /* ---------- página completa ---------- */
  function filtradas() { const u = ui();
    return ordenar(A.notificacoes().filter(n => (!u.cat || n.cat === u.cat) && (!u.prio || n.prio === u.prio) &&
      (u.sit === 'dispensadas' ? n.dispensada : !n.dispensada && (u.sit === 'todas' || (u.sit === 'lidas' ? n.lida : !n.lida)))), u.ordem); }
  function vPagina() {
    const u = ui(), arr = filtradas(), todas = A.notificacoes().filter(n => !n.dispensada && !n.lida);
    const cont = p => todas.filter(n => n.prio === p).length;
    const cats = CATS.filter(([k]) => A.notificacoes().some(n => n.cat === k));
    return `<section class="panel"><div class="vhead"><h2>Notificações</h2>${arr.some(n => !n.lida && !n.dispensada) ? '<button class="btn" data-action="notif-todas-lidas" data-escopo="pagina">Marcar exibidas como lidas</button>' : ''}</div>
      <div class="kpis"><div class="kpi" style="--c:var(--danger)"><span>Urgentes não lidas</span><strong>${cont('urgente')}</strong></div><div class="kpi" style="--c:var(--warn)"><span>Atenção</span><strong>${cont('atencao')}</strong></div><div class="kpi" style="--c:var(--accent)"><span>Informativas</span><strong>${cont('info')}</strong></div></div>
      <div class="filters">
        <select id="ntSit" data-ui="notif.sit" aria-label="Situação">${A.opts([['naolidas','Não lidas'],['lidas','Lidas'],['todas','Todas'],['dispensadas','Dispensadas']], u.sit)}</select>
        <select id="ntCat" data-ui="notif.cat" aria-label="Categoria">${A.opts(cats, u.cat, 'Todas as categorias')}</select>
        <select id="ntPrio" data-ui="notif.prio" aria-label="Prioridade">${A.opts([['urgente','Urgente'],['atencao','Atenção'],['info','Informativo']], u.prio, 'Todas as prioridades')}</select>
        <select id="ntOrd" data-ui="notif.ordem" aria-label="Ordenação">${A.opts([['prioridade','Ordenar por prioridade'],['recentes','Mais recentes primeiro']], u.ordem)}</select>
      </div>
      <div class="notif-page">${arr.map(n => item(n, true)).join('') || '<div class="empty">Nenhuma notificação com esses filtros.</div>'}</div>
      <p class="muted" style="font-size:12px;padding:0 14px 14px;margin:0">As notificações são geradas a partir dos dados do sistema e somem sozinhas quando a pendência é resolvida (prazo concluído, conta paga, publicação tratada…). Urgentes e pendências que exigem providência não podem ser dispensadas. Datas calculadas são auxiliares: a data oficial é a do DJEN ou do tribunal.</p></section>`;
  }
  A.route('notificacoes', {label: 'Notificações', mod: null, render: vPagina,
    badge: () => A.notificacoes().filter(n => !n.lida && !n.dispensada && n.prio === 'urgente').length});

  /* ---------- ações ---------- */
  const achar = ch => A.notificacoes().find(n => n.chave === ch);
  A.on('notif-toggle', () => { const u = ui(); u.aberto = !u.aberto; A.render(); });
  A.on('notif-fechar', () => { if (ui().aberto) { ui().aberto = false; A.render(); } });
  A.on('notif-painel', el => { ui().painel = el.dataset.v; A.render(); });
  A.on('notif-ver-todas', () => { ui().aberto = false; A.go('notificacoes'); });
  A.on('notif-lida', el => { const n = achar(el.dataset.chave); if (!n) return;
    gravar(e => { if (n.lida) delete e.lidas[n.chave]; else e.lidas[n.chave] = new Date().toISOString(); }); });
  A.on('notif-dispensar', el => { const n = achar(el.dataset.chave); if (!n || !n.dispensavel) return;
    gravar(e => { if (n.dispensada) delete e.dispensadas[n.chave]; else { const t = new Date().toISOString(); e.dispensadas[n.chave] = t; e.lidas[n.chave] = e.lidas[n.chave] || t; } })
      .then(() => A.toast(n.dispensada ? 'Notificação restaurada.' : 'Notificação dispensada. Ela fica em Notificações › Dispensadas.')); });
  A.on('notif-todas-lidas', el => {
    const alvo = el.dataset.escopo === 'pagina' ? filtradas() : A.notificacoes().filter(n => !n.dispensada);
    const t = new Date().toISOString(); gravar(e => alvo.forEach(n => { if (!n.dispensada) e.lidas[n.chave] = e.lidas[n.chave] || t; }));
  });
  A.on('notif-abrir', el => { const n = achar(el.dataset.chave); if (!n) return;
    if (!n.lida) gravar(e => { e.lidas[n.chave] = new Date().toISOString(); });
    ui().aberto = false; const ac = n.acao || {};
    if (ac.a === 'editar-prazo' || ac.a === 'editar-comp') { const reg = A.byId(ac.a === 'editar-prazo' ? 'prazos' : 'compromissos', ac.id);
      const dia = reg && (reg.vencimento || reg.data); if (dia) { A.ui('agenda').dia = dia; A.ui('agenda').ano = Number(dia.slice(0, 4)); A.ui('agenda').mes = Number(dia.slice(5, 7)) - 1; } }
    A.go(ac.rota || 'notificacoes');
    if (ac.a && A.actions[ac.a]) A.actions[ac.a]({dataset: {id: ac.id}});
  });
})(window.App);
