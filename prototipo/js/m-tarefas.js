/* Central de tarefas (rota #tarefas, módulo de permissão "tarefas").
   - Coleção "tarefas"; comentários em "tarefa_comentarios" (um registro por comentário).
   - Prioridade calculada por Regras.prioridadeTarefa (pesos em config/operacional); ajuste manual liga prioridadeManual.
   - Dependências (dependeDe): tarefa com dependência aberta aparece como "bloqueada".
   - Recorrência: ao concluir, cria a próxima ocorrência com id determinístico (Regras.proximaOcorrencia).
   - Migração: compromissos "Tarefa interna" viram tarefas mig-<id>; o compromisso continua na agenda.
   - A.blocoTarefas({clienteId}|{processoId}) mostra as tarefas nas fichas de cliente e processo. */
(function (A) {
  const S = A.S, P = A.P, R = A.R, esc = A.esc;
  const MOD = A.TAREFAS_MOD = 'tarefas';
  const STATUS = [['aberta', 'Aberta'], ['andamento', 'Em andamento'], ['aguardando_terceiros', 'Aguardando terceiros'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']];
  const ST = A.ST_TAREFA = Object.fromEntries(STATUS);
  const PRIO = {baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente'}, PRIO_ORD = {urgente: 0, alta: 1, normal: 2, baixa: 3};
  const ORIGEM = {manual: 'Manual', automacao: 'Automação', cliente: 'Ficha do cliente', processo: 'Ficha do processo', migracao: 'Migrada da agenda'};
  const FREQ = {diaria: 'diária', semanal: 'semanal', mensal: 'mensal'};
  const VISOES = [['minhas', 'Minhas'], ['equipe', 'Equipe'], ['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['prox7', 'Próximos 7 dias'], ['semresp', 'Sem responsável'],
    ['aguardando', 'Aguardando terceiros'], ['concluidas', 'Concluídas'], ['recorrentes', 'Recorrentes']];
  const ui = () => A.ui('tarefas', {visao: S.meId ? 'minhas' : 'equipe', resp: '', cat: '', cli: '', proc: '', busca: ''});
  const aberta = R.tarefaAberta;

  // Usados por m-notificacoes.js (gargalos) e pelos quadros do Início.
  A.tarefasRegras = () => A.col('tarefas');
  A.acaoTarefa = id => ({rota: 'tarefas', a: 'tarefa-editar', id});

  /* ---------- informação derivada (uma vez por ciclo de desenho) ---------- */
  const mapa = () => A.memo('tarefas-mapa', () => new Map(A.col('tarefas').map(t => [t.id, t])));
  const infos = () => A.memo('tarefas-info:' + A.hoje(), () => {
    const m = mapa(), h = A.hoje(), op = A.op(), out = new Map();
    const prazoProx = id => A.doIdx('prazos', 'processoId', id).some(p => p.status !== 'concluido' && p.vencimento && (p.vencimento <= h || R.uteisEscritorio(h, p.vencimento) <= 5));
    A.col('tarefas').forEach(t => {
      const bl = aberta(t) && R.bloqueada(t, m);
      const calc = R.prioridadeTarefa(t, {hoje: h, cliente: A.cliente(t.clienteId), processoComPrazoProximo: !!t.processoId && prazoProx(t.processoId), bloqueada: bl}, op);
      out.set(t.id, {bloqueada: bl, calc, prio: R.prioridadeEfetiva(t, calc), atrasada: aberta(t) && !!t.prazo && t.prazo < h});
    });
    return out;
  });
  const VAZIA = {bloqueada: false, calc: {nivel: 'normal', pontos: 0, motivos: []}, prio: 'normal', atrasada: false};
  const inf = t => infos().get(t.id) || VAZIA;
  A.infoTarefa = inf;
  const bloqueios = t => (t.dependeDe || []).map(id => mapa().get(id)).filter(o => o && aberta(o));
  const desde = t => t.statusDesde || t.atualizadoEm || t.criadoEm;
  const origemTxt = t => ORIGEM[(t.origem && t.origem.tipo) || 'manual'] || 'Manual';
  const recTxt = r => r ? (r.intervalo > 1 ? `a cada ${r.intervalo} (${FREQ[r.freq]})` : FREQ[r.freq]) : '';

  /* ---------- lista ---------- */
  function lista() {
    const u = ui(), h = A.hoje(), ate = P.addDays(h, 7);
    const V = {
      minhas: t => aberta(t) && !!S.meId && t.responsavelId === S.meId,
      equipe: aberta,
      atrasadas: t => aberta(t) && !!t.prazo && t.prazo < h,
      hoje: t => aberta(t) && t.prazo === h,
      prox7: t => aberta(t) && !!t.prazo && t.prazo > h && t.prazo <= ate,
      semresp: t => aberta(t) && !t.responsavelId,
      aguardando: t => t.status === 'aguardando_terceiros',
      concluidas: t => t.status === 'concluida' || t.status === 'cancelada',
      recorrentes: t => aberta(t) && !!t.recorrencia,
    };
    const arr = A.col('tarefas').filter(V[u.visao] || V.equipe)
      .filter(t => (!u.resp || (u.resp === '-' ? !t.responsavelId : t.responsavelId === u.resp)) && (!u.cat || t.categoria === u.cat) && (!u.cli || t.clienteId === u.cli) && (!u.proc || t.processoId === u.proc))
      .filter(t => A.match(u.busca, t.titulo, t.descricao, t.categoria, t.aguardandoQuem, A.cliente(t.clienteId)?.nome, A.rotuloProcId(t.processoId), A.membro(t.responsavelId)?.nome));
    if (u.visao === 'concluidas') return arr.sort((a, b) => String(b.concluidaEm || b.atualizadoEm || '').localeCompare(String(a.concluidaEm || a.atualizadoEm || '')));
    return arr.sort((a, b) => PRIO_ORD[inf(a).prio] - PRIO_ORD[inf(b).prio] || (a.prazo || '9').localeCompare(b.prazo || '9') || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
  }
  A.exportadores.tarefas = () => ({titulo: 'Tarefas', filtros: 'Visão: ' + (Object.fromEntries(VISOES)[ui().visao] || ''), linhas: lista(), colunas: [
    {t: 'Tarefa', v: t => t.titulo}, {t: 'Situação', v: t => ST[t.status] + (inf(t).bloqueada ? ' (bloqueada)' : '')}, {t: 'Prioridade', v: t => PRIO[inf(t).prio] + (t.prioridadeManual ? ' (manual)' : '')},
    {t: 'Prazo', v: t => t.prazo, tipo: 'date'}, {t: 'Responsável', v: t => A.membro(t.responsavelId)?.nome || ''}, {t: 'Categoria', v: t => t.categoria || ''},
    {t: 'Cliente', v: t => A.cliente(t.clienteId)?.nome || ''}, {t: 'Processo', v: t => A.rotuloProcId(t.processoId)}, {t: 'Origem', v: origemTxt},
    {t: 'Recorrência', v: t => recTxt(t.recorrencia)}, {t: 'Aguardando', v: t => t.aguardandoQuem || ''}, {t: 'Concluída em', v: t => String(t.concluidaEm || '').slice(0, 10), tipo: 'date'}]});

  const pillPrio = t => { const i = inf(t); return `<span class="tprio p-${i.prio}" title="${esc(t.prioridadeManual ? 'Ajustada manualmente' : 'Calculada: ' + (i.calc.motivos.join(', ') || 'sem fatores de urgência'))}">${PRIO[i.prio]}${t.prioridadeManual ? ' ✎' : ''}</span>`; };
  const tags = t => [inf(t).bloqueada ? '<span class="tag alta">Bloqueada</span>' : '', t.recorrencia ? `<span class="tag">Recorrente · ${esc(recTxt(t.recorrencia))}</span>` : '',
    t.categoria ? `<span class="tag">${esc(t.categoria)}</span>` : '', `<span class="ttag">${esc(origemTxt(t))}</span>`].join('');
  function linha(t) {
    const i = inf(t), m = A.membro(t.responsavelId), ed = A.pode(MOD, 'editar'), done = !aberta(t), h = A.hoje();
    const cli = A.cliente(t.clienteId), proc = t.processoId ? A.rotuloProcId(t.processoId) : '';
    const prazo = t.prazo ? `<b>${esc(A.fmt(t.prazo))}</b>${i.atrasada ? `<br><span class="late">${esc(R.uteisEscritorio(t.prazo, h) ? 'atrasada ' + R.uteisEscritorio(t.prazo, h) + ' dia(s) útil(eis)' : 'atrasada')}</span>` : t.prazo === h ? '<br><span class="muted">hoje</span>' : ''}` : '<span class="muted">Sem prazo</span>';
    return `<tr class="row-click${i.atrasada ? ' is-late' : ''}${done ? ' done' : ''}" data-action="tarefa-editar" data-id="${esc(t.id)}">
      <td style="width:34px">${ed && t.status !== 'cancelada' ? `<button class="dcheck${done ? ' is-on' : ''}" data-action="tarefa-concluir" data-id="${esc(t.id)}" aria-label="${done ? 'Reabrir' : 'Concluir'}: ${esc(t.titulo)}" title="${done ? 'Reabrir' : 'Concluir'}">${done ? '✓' : ''}</button>` : ''}</td>
      <td><b>${esc(t.titulo)}</b><div class="ttags">${tags(t)}</div></td><td>${pillPrio(t)}</td><td class="num" style="white-space:nowrap">${prazo}</td>
      <td>${esc(ST[t.status] || t.status)}${t.status === 'aguardando_terceiros' && t.aguardandoQuem ? `<br><span class="muted" style="font-size:12px">${esc(t.aguardandoQuem)}</span>` : ''}<br><span class="muted" style="font-size:12px" title="Tempo na situação atual">${esc(A.haDias(desde(t)))}</span></td>
      <td><span class="who">${A.avatar(m)}${esc(m ? m.nome : 'Sem responsável')}</span></td>
      <td>${esc(cli ? cli.nome : '')}${proc ? `<br><span class="muted proc" style="font-size:12px">${esc(proc)}</span>` : ''}</td></tr>`;
  }

  function vTarefas() {
    const u = ui(), ed = A.pode(MOD, 'editar'), arr = lista(), h = A.hoje(), todas = A.col('tarefas'), LIM = 300;
    const n = {minhas: todas.filter(t => aberta(t) && S.meId && t.responsavelId === S.meId).length, atrasadas: todas.filter(t => aberta(t) && t.prazo && t.prazo < h).length,
      hoje: todas.filter(t => aberta(t) && t.prazo === h).length, semresp: todas.filter(t => aberta(t) && !t.responsavelId).length, aguardando: todas.filter(t => t.status === 'aguardando_terceiros').length};
    const cats = [...new Set([...A.op().categoriasTarefa, ...todas.map(t => t.categoria).filter(Boolean)])];
    return `<section class="panel"><div class="vhead"><h2>Tarefas</h2><span class="muted num">${arr.length} tarefa(s)</span>${A.botoesExport('tarefas')}${ed ? '<button class="btn primary" data-action="tarefa-nova">+ Nova tarefa</button>' : ''}</div>
      <div class="tabs-inline tvisoes">${VISOES.map(([k, l]) => `<button data-action="tarefa-visao" data-v="${k}" aria-pressed="${u.visao === k}"${k === 'atrasadas' && n.atrasadas ? ' class="tab-late"' : ''}>${l}${n[k] ? ` <span class="num">${n[k]}</span>` : ''}</button>`).join('')}</div>
      <div class="filters"><input id="tfBusca" type="search" data-ui="tarefas.busca" placeholder="Buscar título, descrição, cliente, processo…" value="${esc(u.busca)}" style="flex:1 1 220px">
        <select id="tfResp" data-ui="tarefas.resp" aria-label="Responsável"><option value="">Todos os responsáveis</option><option value="-"${u.resp === '-' ? ' selected' : ''}>Sem responsável</option>${A.col('equipe').map(m => `<option value="${esc(m.id)}"${u.resp === m.id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <select id="tfCat" data-ui="tarefas.cat" aria-label="Categoria">${A.opts(cats, u.cat, 'Todas as categorias')}</select>
        <select id="tfCli" data-ui="tarefas.cli" aria-label="Cliente">${A.optsClientesTodos(u.cli, 'Todos os clientes')}</select>
        <select id="tfProc" data-ui="tarefas.proc" aria-label="Processo">${A.optsProcessos(u.proc, 'Todos os processos')}</select></div>
      ${u.visao === 'recorrentes' ? '<div class="dica"><b>Tarefas recorrentes</b> são rotinas que se repetem (todo dia útil, toda semana, todo mês ou a cada N). Quando alguém conclui a de hoje, o sistema já cria a próxima com o prazo seguinte, então ninguém precisa lembrar de cadastrar de novo. A lista mostra a próxima ocorrência de cada rotina; as anteriores ficam em “Concluídas”. Para encerrar uma rotina, mude a situação para “Cancelada”.</div>' : ''}
      ${u.visao === 'minhas' && !S.meId ? '<p class="muted" style="padding:0 14px">Você não está identificado na equipe: use a visão Equipe.</p>' : ''}
      <div class="tablewrap"><table class="tarefas"><thead><tr><th></th><th>Tarefa</th><th>Prioridade</th><th>Prazo</th><th>Situação</th><th>Responsável</th><th>Cliente / processo</th></tr></thead>
        <tbody>${arr.slice(0, LIM).map(linha).join('') || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhuma tarefa nesta visão.</td></tr>'}</tbody></table></div>
      ${arr.length > LIM ? `<p class="muted" style="padding:10px 14px">Mostrando ${LIM} de ${arr.length}. Use os filtros (a exportação traz todas).</p>` : ''}
      <div class="legend">A prioridade é calculada pelo prazo, pela urgência do cliente, pela categoria, por prazo próximo no processo e por dependências (pesos em Configurações). Ajustar a prioridade no formulário fixa o valor (✎). Uma tarefa que depende de outra ainda aberta aparece como bloqueada. Ao concluir uma tarefa recorrente, a próxima ocorrência é criada automaticamente.</div></section>`;
  }
  A.route('tarefas', {label: 'Tarefas', mod: MOD, render: vTarefas,
    badge: () => A.col('tarefas').filter(t => aberta(t) && t.prazo && t.prazo < A.hoje() && (!S.meId || t.responsavelId === S.meId || A.papel() === 'admin')).length});
  A.on('tarefa-visao', el => { ui().visao = el.dataset.v; A.render(); });

  /* ---------- gravação (regras de status, conclusão e recorrência) ---------- */
  A.gravarTarefa = async function (novo, opts) {
    if (!A.exigir(MOD)) return null;
    const ant = A.byId('tarefas', novo.id), agora = new Date().toISOString();
    const t = Object.assign({titulo: '', descricao: '', responsavelId: '', clienteId: '', processoId: '', compromissoId: '', categoria: '', prioridade: 'normal', prioridadeManual: false,
      inicio: '', prazo: '', status: 'aberta', aguardandoQuem: '', dependeDe: [], recorrencia: null, origem: {tipo: 'manual'}, concluidaEm: null, concluidaPor: null}, novo);
    t.dependeDe = [...new Set((t.dependeDe || []).filter(id => id && id !== t.id))];
    if (!ant || ant.status !== t.status) t.statusDesde = agora;
    if (t.status === 'concluida') { if (!ant || ant.status !== 'concluida') { t.concluidaEm = agora; t.concluidaPor = S.meId || null; } }
    else { t.concluidaEm = null; t.concluidaPor = null; }
    if (t.status !== 'aguardando_terceiros') t.aguardandoQuem = '';
    const salvo = await A.save('tarefas', t, opts);
    if (salvo && salvo.status === 'concluida' && (!ant || ant.status !== 'concluida') && salvo.recorrencia) await criarProxima(salvo);
    return salvo;
  };
  async function criarProxima(t) {
    const prox = R.proximaOcorrencia(t, A.hoje()); if (!prox || A.byId('tarefas', prox.id)) return;
    if (t.exemplo) prox.exemplo = true;
    prox.statusDesde = new Date().toISOString();
    if (await A.save('tarefas', prox, {origem: 'automacao', texto: 'Próxima ocorrência de tarefa recorrente'})) A.toast('Próxima ocorrência criada para ' + A.fmt(prox.prazo) + '.');
  }
  // Tarefa B depende (direta ou indiretamente) de A?
  function depende(deId, deQuem, vistos) { vistos = vistos || new Set(); if (vistos.has(deId)) return false; vistos.add(deId);
    const t = mapa().get(deId); return !!t && (t.dependeDe || []).some(id => id === deQuem || depende(id, deQuem, vistos)); }

  A.on('tarefa-concluir', async (el, e) => { if (e) e.stopPropagation(); if (!A.exigir(MOD)) return;
    const t = A.byId('tarefas', el.dataset.id); if (!t) return;
    const fazer = async () => { const r = await A.gravarTarefa(Object.assign({}, t, {status: aberta(t) ? 'concluida' : 'aberta'}));
      if (r) { if (document.getElementById('fTarefa')) A.closeModal(); A.toast(r.status === 'concluida' ? 'Tarefa concluída.' : 'Tarefa reaberta.'); } };
    const bl = aberta(t) ? bloqueios(t) : [];
    if (bl.length) A.confirm('Tarefa bloqueada', 'Esta tarefa depende de outra ainda aberta: ' + bl.map(x => x.titulo).join('; ') + '. Concluir mesmo assim?', 'Concluir', fazer);
    else await fazer();
  });

  /* ---------- formulário ---------- */
  A.on('tarefa-nova', el => { if (!A.exigir(MOD)) return; const d = (el && el.dataset) || {};
    const preset = {}; if (d.cli) { preset.clienteId = d.cli; preset.origem = {tipo: 'cliente', ref: d.cli}; preset._voltar = {tipo: 'cliente', id: d.cli}; }
    if (d.proc) { preset.processoId = d.proc; preset.clienteId = preset.clienteId || A.processo(d.proc)?.clienteId || ''; preset.origem = {tipo: 'processo', ref: d.proc}; preset._voltar = {tipo: 'processo', id: d.proc}; }
    A.formTarefa(null, preset); });
  A.on('tarefa-editar', (el, e) => { if (e) e.stopPropagation(); const t = A.byId('tarefas', el.dataset.id); if (!t) { A.toast('Tarefa não encontrada.'); return; }
    const d = el.dataset || {}; A.formTarefa(t, d.voltarCli ? {_voltar: {tipo: 'cliente', id: d.voltarCli}} : d.voltarProc ? {_voltar: {tipo: 'processo', id: d.voltarProc}} : null); });
  const voltar = v => { if (!v) return; if (v.tipo === 'cliente' && A.cliente(v.id)) A.actions['abrir-cliente']({dataset: {id: v.id}}); if (v.tipo === 'processo' && A.processo(v.id)) A.actions['abrir-processo']({dataset: {id: v.id}}); };
  A.voltarPara = voltar;

  A.formTarefa = function (t, preset) {
    const novo = !t, ed = A.pode(MOD, 'editar'), ro = ed ? '' : 'disabled', op = A.op();
    const pr = Object.assign({}, preset || {}), volta = pr._voltar; delete pr._voltar;
    t = Object.assign({id: A.uid(), titulo: '', descricao: '', responsavelId: A.me()?.id || '', clienteId: '', processoId: '', compromissoId: '', categoria: '', prioridade: 'normal', prioridadeManual: false,
      inicio: '', prazo: '', status: 'aberta', aguardandoQuem: '', dependeDe: [], recorrencia: null, origem: {tipo: 'manual'}}, t ? JSON.parse(JSON.stringify(t)) : {}, pr);
    const i = novo ? {calc: R.prioridadeTarefa(t, {hoje: A.hoje(), cliente: A.cliente(t.clienteId)}, op), bloqueada: false} : inf(t);
    const cats = [...new Set([...op.categoriasTarefa, t.categoria].filter(Boolean))];
    const outras = A.col('tarefas').filter(o => o.id !== t.id && (aberta(o) || (t.dependeDe || []).includes(o.id))).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR')).slice(0, 300);
    const coments = novo ? [] : A.doIdx('tarefa_comentarios', 'tarefaId', t.id).slice().sort((a, b) => String(a.em).localeCompare(String(b.em)));
    const bl = novo ? [] : bloqueios(t), rec = t.recorrencia || {};
    A.modal(`${A.modalHead(novo ? 'Nova tarefa' : 'Tarefa', !novo ? `<span class="tag">${esc(ST[t.status])}</span>${i.bloqueada ? ' <span class="tag alta">Bloqueada</span>' : ''}` : '')}
    <form id="fTarefa"><div class="body">
      ${A.inp('tTit', 'Título', t.titulo, `required ${ro} placeholder="Ex.: pedir CNIS ao cliente"`, 'full')}
      ${A.area('tDesc', 'Descrição', t.descricao, 3, ro)}
      ${A.sel('tResp', 'Responsável', A.optsEquipe(t.responsavelId), '', ro)}
      ${A.sel('tCat', 'Categoria', A.opts(cats, t.categoria, 'Sem categoria'), '', ro)}
      ${A.sel('tPrio', 'Prioridade', A.opts([['auto', 'Automática (' + PRIO[i.calc.nivel].toLowerCase() + ')'], ...Object.entries(PRIO).map(([k, l]) => [k, l + ' (fixar)'])], t.prioridadeManual ? t.prioridade : 'auto'), '', ro)}
      ${A.sel('tSt', 'Situação', A.opts(STATUS, t.status), '', ro)}
      ${A.inp('tIni', 'Início', t.inicio, `type="date" ${ro}`)}${A.inp('tPrazo', 'Prazo', t.prazo, `type="date" ${ro}`)}
      ${A.inp('tAguard', 'Aguardando quem? (situação "Aguardando terceiros")', t.aguardandoQuem, `${ro} placeholder="Ex.: cliente enviar comprovante"`, 'full')}
      ${A.sel('tCli', 'Cliente', A.optsClientesTodos(t.clienteId, 'Nenhum'), '', ro)}${A.sel('tProc', 'Processo', A.optsProcessos(t.processoId, 'Nenhum'), '', ro)}
      ${A.field('tFreq', 'Repetir', `<div style="display:flex;gap:6px;align-items:center"><select id="tFreq" ${ro}>${A.opts([['', 'Não repete'], ['diaria', 'Diariamente (dias úteis)'], ['semanal', 'Semanalmente'], ['mensal', 'Mensalmente']], rec.freq || '')}</select><span class="muted">a cada</span><input id="tInt" type="number" min="1" max="365" value="${esc(rec.intervalo || 1)}" style="width:64px" ${ro}></div><small class="muted" style="display:block;margin-top:4px">Para rotinas, como conferir o DJEN todo dia ou o Meu INSS toda semana. Ao concluir, a próxima é criada sozinha com o novo prazo.</small>`)}
      ${A.field('tDep', 'Depende de (Ctrl/⌘ para várias)', `<select id="tDep" multiple size="${Math.min(6, Math.max(3, outras.length))}" ${ro}>${outras.map(o => `<option value="${esc(o.id)}"${(t.dependeDe || []).includes(o.id) ? ' selected' : ''}>${esc(o.titulo)}${aberta(o) ? '' : ' (' + esc(ST[o.status]).toLowerCase() + ')'}</option>`).join('')}</select>`, 'full')}
      <div class="tinfo full muted">${[`Origem: ${esc(origemTxt(t))}`, !novo && t.criadoEm ? `criada por ${esc(t.criadoPor ? A.nomeDe(t.criadoPor) : 'automação/sem identificação')} em ${esc(A.quando(t.criadoEm))}` : '',
        !novo ? `${esc(ST[t.status])} ${esc(A.haDias(desde(t)))}` : '', `prioridade calculada: ${esc(PRIO[i.calc.nivel].toLowerCase())}${i.calc.motivos.length ? ' (' + esc(i.calc.motivos.join(', ')) + ')' : ''}`,
        bl.length ? `<b>bloqueada por:</b> ${bl.map(x => esc(x.titulo)).join('; ')}` : '', t.concluidaEm ? `concluída por ${esc(t.concluidaPor ? A.nomeDe(t.concluidaPor) : '—')} em ${esc(A.quando(t.concluidaEm))}` : ''].filter(Boolean).join(' · ')}</div>
      ${novo ? '' : `<div class="full tcoments"><h4>Comentários</h4><ul class="timeline">${coments.map(c => `<li>${A.avatar(A.membro(c.por))}<div>${esc(c.texto)}<small>${esc(c.por ? A.nomeDe(c.por) : 'Equipe')} · ${esc(A.quando(c.em))}</small></div></li>`).join('') || '<li class="muted">Nenhum comentário.</li>'}</ul>
        ${ed ? '<div style="display:flex;gap:6px"><input id="tComent" placeholder="Escreva um comentário" style="flex:1" aria-label="Comentário"><button type="button" class="btn small" data-action="tarefa-comentar">Comentar</button></div>' : ''}
        <p class="muted" style="font-size:12px;margin:6px 0 0">Anexos: envie pelo bloco de documentos do cliente ou do processo vinculado.</p></div>`}
    </div><footer>${!novo && ed ? '<button type="button" class="btn danger left" data-action="tarefa-excluir">Excluir</button>' : ''}
      <button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>
      ${ed ? `${!novo && t.status !== 'cancelada' ? `<button type="button" class="btn" data-action="tarefa-concluir" data-id="${esc(t.id)}">${aberta(t) ? 'Concluir' : 'Reabrir'}</button>` : ''}<button type="submit" class="btn primary">Salvar</button>` : ''}</footer></form>`, {wide: true});
    const f = document.getElementById('fTarefa'); S.ui._modalCtx = {tipo: 'tarefa', id: t.id};
    const ag = () => { const c = document.getElementById('tAguard')?.closest('.field'); if (c) c.style.display = f.tSt.value === 'aguardando_terceiros' ? '' : 'none'; }; ag();
    f.tSt.addEventListener('change', ag);
    f.tProc.addEventListener('change', () => { const p = A.processo(f.tProc.value); if (p && !f.tCli.value) f.tCli.value = p.clienteId || ''; });
    atual = {t, novo, volta};
    f.addEventListener('submit', async e => { e.preventDefault(); if (!A.exigir(MOD)) return;
      const titulo = f.tTit.value.trim(); if (!titulo) { A.toast('Informe o título.'); return; }
      if (f.tIni.value && f.tPrazo.value && f.tPrazo.value < f.tIni.value) { A.toast('O prazo é anterior ao início.'); return; }
      const dep = [...f.tDep.selectedOptions].map(o => o.value), ciclo = dep.find(id => id === t.id || depende(id, t.id));
      if (ciclo) { A.toast('Dependência circular: "' + (mapa().get(ciclo)?.titulo || '') + '" já depende desta tarefa.'); return; }
      const prio = f.tPrio.value, freq = f.tFreq.value;
      const obj = Object.assign({}, t, {titulo, descricao: f.tDesc.value.trim(), responsavelId: f.tResp.value, categoria: f.tCat.value, prioridadeManual: prio !== 'auto', prioridade: prio === 'auto' ? (t.prioridadeManual ? 'normal' : t.prioridade || 'normal') : prio,
        status: f.tSt.value, inicio: f.tIni.value, prazo: f.tPrazo.value, aguardandoQuem: f.tAguard.value.trim(), clienteId: f.tCli.value, processoId: f.tProc.value, dependeDe: dep,
        recorrencia: freq ? {freq, intervalo: Math.min(365, Math.max(1, Number(f.tInt.value) || 1))} : null});
      if (obj.recorrencia && !obj.prazo) { A.toast('Tarefa recorrente precisa de prazo (a próxima ocorrência conta a partir dele).'); return; }
      if (await A.gravarTarefa(obj)) { A.closeModal(); A.toast('Tarefa salva.'); voltar(volta); }
    });
  };
  let atual = null;
  A.on('tarefa-comentar', async () => { if (!A.exigir(MOD) || !atual) return; const txt = A.v('tComent'); if (!txt) return;
    const c = {tarefaId: atual.t.id, texto: txt.slice(0, 4000), em: new Date().toISOString(), por: S.meId || null}; if (atual.t.exemplo) c.exemplo = true;
    const r = await A.save('tarefa_comentarios', c);
    if (r) { const t = A.byId('tarefas', atual.t.id); if (t) A.formTarefa(t, atual.volta ? {_voltar: atual.volta} : null); } });
  A.on('tarefa-excluir', () => { if (!A.exigir(MOD) || !atual) return; const id = atual.t.id;
    A.confirm('Excluir tarefa', 'A tarefa será apagada. Para manter o registro, prefira a situação "Cancelada". O histórico e os comentários continuam guardados.', 'Excluir', async () => {
      if (A.exigir(MOD) && await A.remove('tarefas', id)) A.toast('Tarefa excluída.'); }); });

  /* ---------- bloco nas fichas de cliente e processo ---------- */
  A.blocoTarefas = function (alvo) {
    if (!A.pode(MOD, 'ver')) return '';
    const arr = (alvo.processoId ? A.doIdx('tarefas', 'processoId', alvo.processoId) : A.doIdx('tarefas', 'clienteId', alvo.clienteId));
    const ab = arr.filter(aberta).sort((a, b) => PRIO_ORD[inf(a).prio] - PRIO_ORD[inf(b).prio] || (a.prazo || '9').localeCompare(b.prazo || '9')), feitas = arr.length - ab.length;
    const volta = alvo.processoId ? `data-voltar-proc="${esc(alvo.processoId)}"` : `data-voltar-cli="${esc(alvo.clienteId)}"`;
    return `<div class="tbloco">${ab.slice(0, 8).map(t => { const i = inf(t), m = A.membro(t.responsavelId);
      return `<button type="button" class="tbl-i${i.atrasada ? ' is-late' : ''}" data-action="tarefa-editar" data-id="${esc(t.id)}" ${volta}><span class="tprio p-${i.prio}">${PRIO[i.prio]}</span><span class="tbl-t">${esc(t.titulo)}${i.bloqueada ? ' <span class="tag alta">Bloqueada</span>' : ''}</span>
        <span class="muted">${t.prazo ? esc(A.fmt(t.prazo).slice(0, 5)) : 'sem prazo'} · ${esc(ST[t.status])}</span>${A.avatar(m)}</button>`; }).join('') || '<span class="muted" style="font-size:12px">Nenhuma tarefa em aberto.</span>'}
      ${ab.length > 8 ? `<span class="muted" style="font-size:12px">+${ab.length - 8} em aberto</span>` : ''}${feitas ? `<span class="muted" style="font-size:12px">${feitas} concluída(s) ou cancelada(s)</span>` : ''}</div>
      ${A.pode(MOD, 'editar') ? `<div><button type="button" class="btn small" data-action="${alvo.processoId ? 'pr-nova-tarefa' : 'cl-nova-tarefa'}">+ Nova tarefa</button></div>` : ''}`;
  };

  /* ---------- migração: compromissos "Tarefa interna" -> tarefas ---------- */
  A.migrarTarefaInterna = async function (c) {
    if (!c || c.tipo !== 'Tarefa interna' || c.migradoParaTarefa) return null;
    if (!A.pode(MOD, 'editar') || !A.pode('prazos', 'editar')) return null;
    const t = R.tarefaDeCompromisso(c); const parts = t._participantes || []; delete t._participantes;
    if (parts.length) t.descricao = [c.obs || '', 'Participantes na agenda: ' + parts.map(A.nomeDe).join(', ')].filter(Boolean).join('\n');
    if (!A.byId('tarefas', t.id)) {
      if (!(await A.save('tarefas', t, {semHistorico: true}))) return null;
      await A.registrar({id: 'mig-hist-' + c.id, entidade: 'tarefas', entidadeId: t.id, acao: 'migracao', origem: 'automacao', texto: 'Migrada da agenda (Tarefa interna de ' + A.fmt(c.data) + ')'});
    }
    await A.save('compromissos', Object.assign({}, c, {migradoParaTarefa: t.id}), {semHistorico: true});
    return t.id;
  };
  A.migracoes.push(async () => {
    const pend = A.col('compromissos').filter(c => c.tipo === 'Tarefa interna' && !c.migradoParaTarefa);
    let n = 0; for (const c of pend) { if (await A.migrarTarefaInterna(c)) n++; }
    if (n) A.toast(n + ' tarefa(s) interna(s) da agenda migrada(s) para a Central de tarefas.');
  });

  /* ---------- exemplos de captação, checklists e tarefas em dados locais antigos ----------
     Entram uma única vez: só se a base ainda tem dados de exemplo (ninguém clicou em "Remover exemplos")
     e se nenhum deles existe ainda (apagar um exemplo não o faz voltar). Ids fixos: rodar em duas abas não duplica. */
  A.migracoes.push(async () => {
    if (!A.seed.exemplosOperacionais || !A.pode('clientes', 'editar') || !A.pode(MOD, 'editar')) return;
    if (!A.COLS.some(c => A.col(c).some(x => x.exemplo))) return;
    const ex = A.seed.exemplosOperacionais(A.hoje(), P);
    if (Object.keys(ex).some(c => ex[c].some(o => A.byId(c, o.id)))) return;
    for (const c of Object.keys(ex)) if (ex[c].length && !(await A.saveLote(c, ex[c]))) return;
    A.toast('Exemplos de checklists e tarefas recorrentes incluídos (clientes Maria Aparecida e José Carlos).');
  });
})(window.App);
