/* Módulo Agenda: tela única com visões Ano, Mês, Semana, Dia e Lista. Mostra prazos (data fatal) e compromissos (com horário). */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const TIPOS = ['Contestação','Réplica','Recurso de Apelação','Agravo de Instrumento','Agravo Interno','Embargos de Declaração','Contrarrazões','Manifestação','Impugnação','Cumprimento de sentença','Recurso Ordinário','Audiência','Perícia','Juntada de documentos','Diligência / protocolo','Prazo interno'];
  const TIPOS_COMP = ['Atendimento','Audiência','Reunião','Inicial','Consulta','Diligência','Ligação / retorno','Tarefa interna','Outro'];
  const LABEL = {vencido:'Vencido',hoje:'Vence hoje',critico:'Até 2 dias úteis',atencao:'Próximo',ok:'No prazo',concluido:'Concluído'};
  const ORDER = {vencido:0,hoje:1,critico:2,atencao:3,ok:4,concluido:5};
  const VISOES = [['ano','Ano'],['mes','Mês'],['semana','Semana'],['dia','Dia'],['lista','Lista']];
  const ui = () => A.ui('agenda', {visao: 'mes', ano: new Date().getFullYear(), mes: new Date().getMonth(), dia: null, resp: 'todos', status: 'abertos', busca: '', mostrar: 'tudo'});
  const ant = () => Number(S.config.antecedencia) || 5;
  const sit = p => P.situacao(p, A.hoje(), ant());
  A.sitPrazo = sit; A.LABEL_PRAZO = LABEL; A.TIPOS_COMP = TIPOS_COMP;
  const doResp = id => ui().resp === 'todos' || id === ui().resp;
  const vis = () => A.col('prazos').filter(p => doResp(p.responsavelId));
  const visComp = () => A.col('compromissos').filter(c => doResp(c.responsavelId) || (c.participantes || []).includes(ui().resp));
  const nomeCliente = p => A.cliente(p.clienteId)?.nome || p.cliente || '';
  const restam = p => { const h = A.hoje(); if (p.vencimento < h) { const n = P.uteisEntre(p.vencimento, h); return n ? 'venceu há ' + n + (n === 1 ? ' dia útil' : ' dias úteis') : 'venceu no último dia útil'; } if (p.vencimento === h) return 'vence hoje'; const u = P.uteisEntre(h, p.vencimento); return 'em ' + u + (u === 1 ? ' dia útil' : ' dias úteis'); };
  const hm = h => h ? h.replace(/^0/, '') : '';
  const somaHora = (h, min) => { const [a, b] = (h || '08:00').split(':').map(Number), t = Math.min(23 * 60 + 59, a * 60 + b + min); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const horario = c => c.diaInteiro || !c.horaInicio ? 'Dia todo' : hm(c.horaInicio) + (c.horaFim ? ' a ' + hm(c.horaFim) : '');
  const ref = () => ui().dia || A.hoje();
  const setRef = s => { const u = ui(), d = P.parse(s); u.dia = s; u.ano = d.getFullYear(); u.mes = d.getMonth(); };
  const inicioSemana = s => P.addDays(s, -P.parse(s).getDay());

  /* Itens do dia: prazos (data fatal) e compromissos, em ordem: prazos e "dia todo" primeiro, depois pelo horário. */
  function itensPorDia() {
    const m = new Map(), put = (d, it) => { if (!d) return; if (!m.has(d)) m.set(d, []); m.get(d).push(it); }, mo = ui().mostrar;
    if (mo !== 'compromissos') for (const p of vis()) put(p.vencimento, {k: 'prazo', o: p, hora: '', s: sit(p)});
    if (mo !== 'prazos') for (const c of visComp()) put(c.data, {k: 'comp', o: c, hora: c.diaInteiro ? '' : (c.horaInicio || '')});
    for (const a of m.values()) a.sort((x, y) => (x.k === 'prazo' ? 0 : 1) - (y.k === 'prazo' ? 0 : 1) || (x.k === 'prazo' ? ORDER[x.s] - ORDER[y.s] : 0) || x.hora.localeCompare(y.hora));
    return m;
  }
  const piorPrazo = arr => arr.filter(i => i.k === 'prazo').reduce((w, i) => ORDER[i.s] < ORDER[w] ? i.s : w, 'concluido');
  const temPrazo = arr => arr.some(i => i.k === 'prazo');

  /* Cartão no estilo da agenda: "8:00 a 9:00 ATENDIMENTO - título" + responsável. */
  function evCard(it, compacto) {
    if (it.k === 'prazo') { const p = it.o, m = A.membro(p.responsavelId);
      return `<button class="evc s-${it.s}${it.s === 'concluido' ? ' done' : ''}" data-action="editar-prazo" data-id="${esc(p.id)}" title="${esc('Prazo · ' + p.tipo + ' · ' + nomeCliente(p) + ' · ' + (p.processo || '') + ' · ' + LABEL[it.s])}">
        <b>PRAZO · ${esc(p.tipo)}${p.prioridade === 'alta' ? ' !' : ''}</b>${nomeCliente(p) ? `<span class="evx">${esc(nomeCliente(p))}</span>` : ''}<span class="evr">${esc(m ? m.nome : 'Sem responsável')}</span>${compacto ? '' : `<span class="evtag">${esc(LABEL[it.s])}${p.processo ? ' · ' + esc(p.processo) : ''}</span>`}</button>`; }
    const c = it.o, m = A.membro(c.responsavelId), outros = (c.participantes || []).filter(id => id !== c.responsavelId).map(id => A.membro(id)?.nome).filter(Boolean), proc = A.processo(c.processoId);
    return `<button class="evc comp${c.status === 'concluido' ? ' done' : ''}" style="--rc:${esc(m ? m.cor : '#8893A3')}" data-action="editar-comp" data-id="${esc(c.id)}" title="${esc(horario(c) + ' · ' + c.tipo + ' · ' + c.titulo + (c.local ? ' · ' + c.local : ''))}">
      <b>${esc(horario(c))} ${esc(c.tipo.toUpperCase())} - ${esc(c.titulo)}</b><span class="evr">${esc(m ? m.nome : 'Sem responsável')}${outros.length ? ' + ' + esc(outros.join(', ')) : ''}</span>${proc ? `<span class="evtag">${esc(proc.numero)}</span>` : ''}${!compacto && c.local ? `<span class="evx">${esc(c.local)}</span>` : ''}</button>`;
  }

  A.pcardPrazo = function (p) { const s = sit(p), m = A.membro(p.responsavelId);
    return `<button class="pcard s-${s}" data-action="editar-prazo" data-id="${esc(p.id)}"><span class="t">${esc(p.tipo)}${p.prioridade === 'alta' ? ' · <span style="color:var(--danger)">prioridade alta</span>' : ''}</span>
      <span class="meta"><span class="pill">${esc(LABEL[s])}</span><span class="num">${esc(A.fmt(p.vencimento))}</span><span>${s === 'concluido' ? '' : esc(restam(p))}</span></span>
      <span class="meta">${esc(nomeCliente(p))}</span><span class="meta proc">${esc(p.processo || '')}</span><span class="meta">${A.avatar(m)} ${esc(m ? m.nome : 'Sem responsável')}</span></button>`; };

  /* ---------- barra de ferramentas única ---------- */
  function rotulo() { const u = ui(), r = ref();
    if (u.visao === 'ano') return String(u.ano);
    if (u.visao === 'mes') return A.MESES[u.mes].replace(/^./, c => c.toUpperCase()) + ' de ' + u.ano;
    if (u.visao === 'semana') { const i = inicioSemana(r), f = P.addDays(i, 6); return A.fmt(i).slice(0, 5) + ' a ' + A.fmt(f); }
    if (u.visao === 'dia') { const d = P.parse(r); return A.fmtCurto(r).split(',')[0] + ', ' + d.getDate() + ' de ' + A.MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
    return u.mostrar === 'compromissos' ? 'Compromissos' : u.mostrar === 'prazos' ? 'Prazos' : 'Prazos e compromissos'; }
  function barra() {
    const u = ui(), ed = A.pode('prazos', 'editar'), nav = u.visao !== 'lista';
    return `<div class="agbar">
      <select id="agResp" data-ui="agenda.resp" aria-label="Mostrar a agenda de"><option value="todos">Toda a equipe</option>${A.col('equipe').map(m => `<option value="${esc(m.id)}"${u.resp === m.id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
      <select id="agMostrar" data-ui="agenda.mostrar" aria-label="Tipo de item">${A.opts([['tudo','Prazos e compromissos'],['prazos','Só prazos'],['compromissos','Só compromissos']], u.mostrar)}</select>
      <div class="seg" role="group" aria-label="Visão">${VISOES.map(([v, t]) => `<button data-action="ag-visao" data-v="${v}" aria-pressed="${u.visao === v}">${t}</button>`).join('')}</div>
      ${nav ? `<div class="agnav"><button class="iconbtn" data-action="ag-mover" data-d="-1" aria-label="Anterior">‹</button><span class="agrot">${esc(rotulo())}</span><button class="iconbtn" data-action="ag-mover" data-d="1" aria-label="Próximo">›</button></div><button class="btn small" data-action="ag-hoje">Hoje</button>` : `<span class="agrot">${esc(rotulo())}</span>`}
      <span class="agfill"></span>${u.visao === 'lista' ? A.botoesExport('prazos') : ''}
      ${ed ? `<span class="agacts"><button class="btn small" data-action="novo-prazo"${u.visao === 'dia' ? ` data-venc="${ref()}"` : ''}>+ Prazo</button><button class="btn primary small" data-action="novo-comp"${['dia', 'semana'].includes(u.visao) || u.dia ? ` data-data="${ref()}"` : ''}>Adicionar compromisso</button></span>` : ''}
    </div>`;
  }
  const legenda = () => `<div class="legend"><span class="s-vencido"><i></i>Prazo vencido / vence hoje</span><span class="s-critico"><i></i>Até 2 dias úteis</span><span class="s-atencao"><i></i>Até ${ant()} dias úteis</span><span class="s-ok"><i></i>No prazo</span><span class="s-concluido"><i></i>Concluído</span><span class="s-comp"><i></i>Compromisso (barra na cor do responsável)</span><span><b style="color:var(--hol);text-decoration:underline dotted">15</b> feriado</span><span><i style="background:repeating-linear-gradient(135deg,var(--recesso) 0 3px,transparent 3px 6px);border-color:var(--line)"></i>Recesso forense (20/12 a 20/01)</span></div>`;
  const quadro = corpo => `<section class="panel">${barra()}${corpo}${ui().visao === 'lista' ? '' : legenda()}</section>`;

  /* ---------- Ano ---------- */
  function vAno() {
    const u = ui(), h = A.hoje(), mapa = itensPorDia(); let meses = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(u.ano, m, 1), dim = new Date(u.ano, m + 1, 0).getDate();
      let cells = ['D','S','T','Q','Q','S','S'].map(d => `<span class="dow">${d}</span>`).join('') + '<span class="d out"></span>'.repeat(first.getDay()); let np = 0, nc = 0;
      for (let d = 1; d <= dim; d++) {
        const s = P.ymd(new Date(u.ano, m, d)), arr = mapa.get(s) || [], fer = P.feriado(s), cls = ['d'];
        if (P.fimDeSemana(s)) cls.push('we'); if (P.recesso(s)) cls.push('rec'); if (fer) cls.push('hol'); if (s === h) cls.push('today'); if (s === u.dia) cls.push('sel');
        if (arr.length) { cls.push('has', temPrazo(arr) ? 's-' + piorPrazo(arr) : 's-comp'); arr.forEach(i => i.k === 'prazo' ? np++ : nc++); }
        const tip = [A.fmt(s), fer, P.recesso(s) ? 'Recesso forense (prazos suspensos)' : '', ...arr.map(i => i.k === 'prazo' ? 'Prazo: ' + i.o.tipo + ' · ' + nomeCliente(i.o) : horario(i.o) + ' ' + i.o.tipo + ': ' + i.o.titulo)].filter(Boolean).join('\n');
        cells += `<button class="${cls.join(' ')}" data-action="ag-dia" data-dia="${s}" title="${esc(tip)}" aria-label="${esc(tip)}">${d}${arr.length > 1 ? `<span class="n">${arr.length}</span>` : ''}</button>`;
      }
      const cur = u.ano === new Date().getFullYear() && m === new Date().getMonth(), cont = [np ? np + ' prazo' + (np > 1 ? 's' : '') : '', nc ? nc + ' comp.' : ''].filter(Boolean).join(' · ');
      meses += `<div class="mini${cur ? ' current' : ''}"><h3><button data-action="ag-abrir-mes" data-mes="${m}">${A.MESES[m]}</button><small class="num">${cont}</small></h3><div class="mgrid">${cells}</div></div>`;
    }
    return quadro(`<div class="year">${meses}</div>`);
  }

  /* ---------- Mês ---------- */
  function vMes() {
    const u = ui(), h = A.hoje(), mapa = itensPorDia(), first = new Date(u.ano, u.mes, 1), start = P.addDays(P.ymd(first), -first.getDay()), MAX = 4;
    let cells = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const s = P.addDays(start, i), dt = P.parse(s); if (i >= 35 && dt.getMonth() !== u.mes) break;
      const arr = mapa.get(s) || [], fer = P.feriado(s), cls = ['cell', 'big'];
      if (dt.getMonth() !== u.mes) cls.push('out'); if (P.fimDeSemana(s)) cls.push('we'); if (P.recesso(s)) cls.push('rec'); if (s === h) cls.push('today'); if (s === u.dia) cls.push('sel');
      cells += `<div class="${cls.join(' ')}" data-action="ag-dia" data-dia="${s}"><div class="top-row">${fer ? `<span class="hn">${esc(fer)}</span>` : '<span></span>'}<button class="dn num" data-action="ag-ver-dia" data-dia="${s}" title="Abrir o dia">${dt.getDate()}</button></div>
        ${arr.slice(0, MAX).map(it => evCard(it, true)).join('')}${arr.length > MAX ? `<button class="more" data-action="ag-ver-dia" data-dia="${s}">+${arr.length - MAX} mais</button>` : ''}</div>`;
    }
    return quadro(`<div class="month">${cells}</div>`);
  }

  /* ---------- Semana ---------- */
  function vSemana() {
    const u = ui(), h = A.hoje(), mapa = itensPorDia(), ini = inicioSemana(ref());
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const s = P.addDays(ini, i), dt = P.parse(s), arr = mapa.get(s) || [], fer = P.feriado(s), cls = ['wcol'];
      if (P.fimDeSemana(s)) cls.push('we'); if (P.recesso(s)) cls.push('rec'); if (s === h) cls.push('today');
      cols += `<div class="${cls.join(' ')}"><button class="whead" data-action="ag-ver-dia" data-dia="${s}"><span>${A.DOWL[i]}</span><b class="num">${dt.getDate()}</b></button>${fer ? `<div class="hn">${esc(fer)}</div>` : ''}
        <div class="wlist">${arr.map(it => evCard(it, false)).join('') || '<span class="muted wvazio">—</span>'}</div></div>`;
    }
    return quadro(`<div class="week">${cols}</div>`);
  }

  /* ---------- Dia ---------- */
  function vDia() {
    const s = ref(), arr = itensPorDia().get(s) || [], fer = P.feriado(s), ed = A.pode('prazos', 'editar');
    const obs = [fer ? 'Feriado: ' + fer : '', P.recesso(s) ? 'Recesso forense: prazos suspensos' : '', P.fimDeSemana(s) ? 'Fim de semana' : '', (!fer && !P.recesso(s) && !P.fimDeSemana(s)) ? 'Dia útil' : ''].filter(Boolean).join(' · ');
    const prz = arr.filter(i => i.k === 'prazo'), cps = arr.filter(i => i.k === 'comp');
    const linhas = cps.map(it => `<div class="drow"><span class="dhora num">${esc(it.o.diaInteiro || !it.o.horaInicio ? 'Dia todo' : hm(it.o.horaInicio))}</span>${evCard(it, false)}</div>`).join('');
    return quadro(`<div class="dayview"><p class="muted" style="margin:0 0 12px">${esc(obs)}</p>
      <h4>Prazos que vencem neste dia</h4><div class="dprz">${prz.map(i => A.pcardPrazo(i.o)).join('') || '<span class="muted">Nenhum prazo vence neste dia.</span>'}</div>
      <h4>Compromissos</h4>${linhas || `<p class="muted">Nenhum compromisso.${ed ? ` <button class="btn small" data-action="novo-comp" data-data="${s}">Adicionar compromisso</button>` : ''}</p>`}</div>`);
  }

  /* ---------- Lista ---------- */
  function listaFiltrada() { const u = ui(), aberto = x => x.status !== 'concluido';
    const ok = x => u.status === 'todos' || (u.status === 'concluidos' ? !aberto(x) : aberto(x));
    const prz = u.mostrar === 'compromissos' ? [] : vis().filter(ok).filter(p => A.match(u.busca, p.processo, nomeCliente(p), p.tipo, p.descricao, p.obs, A.membro(p.responsavelId)?.nome)).map(p => ({k: 'prazo', o: p, data: p.vencimento, hora: '', s: sit(p)}));
    const cps = u.mostrar === 'prazos' ? [] : visComp().filter(ok).filter(c => A.match(u.busca, c.titulo, c.tipo, c.local, c.obs, A.processo(c.processoId)?.numero, A.cliente(c.clienteId)?.nome, A.membro(c.responsavelId)?.nome)).map(c => ({k: 'comp', o: c, data: c.data, hora: c.horaInicio || ''}));
    return [...prz, ...cps].sort((a, b) => (u.status !== 'concluidos' && a.k === 'prazo' && b.k === 'prazo' ? ORDER[a.s] - ORDER[b.s] : 0) || (a.data || '').localeCompare(b.data || '') || a.hora.localeCompare(b.hora)); }
  A.exportadores.prazos = () => ({titulo: 'Agenda', filtros: 'Situação: ' + ui().status + ' · ' + rotulo() + (ui().resp !== 'todos' ? ' · Responsável: ' + A.nomeDe(ui().resp) : ''), linhas: listaFiltrada(),
    colunas: [{t:'Item', v:i => i.k === 'prazo' ? 'Prazo' : 'Compromisso'}, {t:'Situação', v:i => i.k === 'prazo' ? LABEL[i.s] : (i.o.status === 'concluido' ? 'Concluído' : 'Agendado')}, {t:'Data', v:i => i.data, tipo:'date'}, {t:'Horário', v:i => i.k === 'prazo' ? '' : horario(i.o)},
      {t:'Tipo', v:i => i.o.tipo}, {t:'Descrição', v:i => i.k === 'prazo' ? (i.o.descricao || '') : i.o.titulo}, {t:'Processo', v:i => i.k === 'prazo' ? i.o.processo : (A.processo(i.o.processoId)?.numero || '')},
      {t:'Cliente', v:i => i.k === 'prazo' ? nomeCliente(i.o) : (A.cliente(i.o.clienteId)?.nome || '')}, {t:'Responsável', v:i => A.membro(i.o.responsavelId)?.nome || ''}]});
  function vLista() {
    const u = ui(), arr = listaFiltrada(), ed = A.pode('prazos', 'editar');
    const rows = arr.map(it => { const o = it.o, m = A.membro(o.responsavelId);
      if (it.k === 'prazo') { const s = it.s;
        return `<tr class="s-${s}${s === 'concluido' ? ' done' : ''}"><td><span class="pill">${esc(LABEL[s])}</span></td><td class="num" style="white-space:nowrap"><b>${esc(A.fmt(o.vencimento))}</b><br><span class="muted" style="font-size:12px">${s === 'concluido' ? '' : esc(restam(o))}</span></td>
          <td>Prazo · ${esc(o.tipo)}${o.prioridade === 'alta' ? ' <span style="color:var(--danger);font-size:11px;font-weight:600">ALTA</span>' : ''}</td><td><span class="proc">${esc(o.processo)}</span><br><span class="muted" style="font-size:12px">${esc(nomeCliente(o))}</span></td>
          <td><span class="who">${A.avatar(m)}${esc(m ? m.nome : '—')}</span></td><td><div class="rowact">${ed ? `<button class="btn small" data-action="concluir-prazo" data-id="${esc(o.id)}">${s === 'concluido' ? 'Reabrir' : 'Concluir'}</button>` : ''}<button class="btn small" data-action="editar-prazo" data-id="${esc(o.id)}">${ed ? 'Editar' : 'Ver'}</button></div></td></tr>`; }
      const done = o.status === 'concluido', proc = A.processo(o.processoId), cli = A.cliente(o.clienteId);
      return `<tr class="s-comp${done ? ' done' : ''}"><td><span class="pill">${done ? 'Concluído' : 'Agendado'}</span></td><td class="num" style="white-space:nowrap"><b>${esc(A.fmt(o.data))}</b><br><span class="muted" style="font-size:12px">${esc(horario(o))}</span></td>
        <td>${esc(o.tipo)} · ${esc(o.titulo)}</td><td><span class="proc">${esc(proc ? proc.numero : '')}</span><br><span class="muted" style="font-size:12px">${esc(cli ? cli.nome : (o.local || ''))}</span></td>
        <td><span class="who">${A.avatar(m)}${esc(m ? m.nome : '—')}</span></td><td><div class="rowact">${ed ? `<button class="btn small" data-action="concluir-comp" data-id="${esc(o.id)}">${done ? 'Reabrir' : 'Concluir'}</button>` : ''}<button class="btn small" data-action="editar-comp" data-id="${esc(o.id)}">${ed ? 'Editar' : 'Ver'}</button></div></td></tr>`; }).join('');
    return quadro(`<div class="filters"><select id="pzSt" data-ui="agenda.status">${A.opts([['abertos','Em aberto'],['concluidos','Concluídos'],['todos','Todos']], u.status)}</select>
      <input id="pzBusca" type="search" data-ui="agenda.busca" placeholder="Buscar processo, cliente, tipo, título…" value="${esc(u.busca)}" style="flex:1 1 240px"><span class="muted num">${arr.length} item(ns)</span></div>
      <div class="tablewrap"><table><thead><tr><th>Situação</th><th>Data</th><th>Tipo</th><th>Processo / cliente</th><th>Responsável</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty" style="padding:16px">Nada encontrado.</td></tr>'}</tbody></table></div>`);
  }

  /* ---------- painel lateral (visão Ano) ---------- */
  function vLado() {
    const u = ui(); let topo;
    if (u.dia) { const arr = itensPorDia().get(u.dia) || [], fer = P.feriado(u.dia), ed = A.pode('prazos', 'editar');
      const obs = [fer ? 'Feriado: ' + fer : '', P.recesso(u.dia) ? 'Recesso forense: prazos suspensos' : '', P.fimDeSemana(u.dia) ? 'Fim de semana' : '', (!fer && !P.recesso(u.dia) && !P.fimDeSemana(u.dia)) ? 'Dia útil' : ''].filter(Boolean).join(' · ');
      topo = `<h3>${esc(A.fmtCurto(u.dia))}/${u.dia.slice(0, 4)}</h3><div class="sub">${esc(obs)} · <button class="linkbtn" data-action="ag-ver-dia" data-dia="${u.dia}">abrir o dia</button></div>
        <div class="plist">${arr.length ? arr.map(it => it.k === 'prazo' ? A.pcardPrazo(it.o) : evCard(it, false)).join('') : '<div class="empty">Nada agendado neste dia.</div>'}</div>
        ${ed ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-action="novo-comp" data-data="${u.dia}">+ Compromisso</button><button class="btn small" data-action="novo-prazo" data-venc="${u.dia}">+ Prazo nesta data</button></div>` : ''}`;
    } else { const prox = vis().filter(p => p.status !== 'concluido' && p.vencimento).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
      topo = `<h3>Próximos vencimentos</h3><div class="sub">Clique num dia do calendário para ver o que há nele.</div><div class="plist">${prox.map(A.pcardPrazo).join('') || '<div class="empty">Nenhum prazo em aberto.</div>'}</div>`; }
    const ab = A.col('prazos').filter(p => p.status !== 'concluido'); const max = Math.max(1, ...A.col('equipe').map(m => ab.filter(p => p.responsavelId === m.id).length));
    const carga = A.col('equipe').map(m => { const n = ab.filter(p => p.responsavelId === m.id).length; if (!n) return ''; const urg = ab.filter(p => p.responsavelId === m.id && ['vencido','hoje','critico'].includes(sit(p))).length;
      return `<div class="loadrow">${A.avatar(m)}<span>${esc(m.nome)}</span><span class="num muted">${n}${urg ? ` · <b style="color:var(--danger)">${urg} urgente${urg > 1 ? 's' : ''}</b>` : ''}</span><span></span><span class="bar"><b style="width:${Math.round(n / max * 100)}%;background:${esc(m.cor)}"></b></span></div>`; }).join('');
    return `<aside class="panel side">${topo}<div class="sec"><h4>Carga da equipe (prazos em aberto)</h4><div class="load">${carga || '<span class="muted">Nenhum prazo em aberto.</span>'}</div></div></aside>`;
  }

  const RENDER = {ano: vAno, mes: vMes, semana: vSemana, dia: vDia, lista: vLista};
  A.route('agenda', {label: 'Agenda', mod: 'prazos', render: () => (RENDER[ui().visao] || vMes)(), lado: () => ui().visao === 'ano' ? vLado() : '',
    badge: () => A.col('prazos').filter(p => ['vencido','hoje','critico'].includes(sit(p))).length});
  /* Endereços antigos (#ano, #mes, #prazos) abrem a Agenda na visão correspondente. */
  A.aliases = Object.assign(A.aliases || {}, {ano: () => { ui().visao = 'ano'; }, mes: () => { ui().visao = 'mes'; }, prazos: () => { ui().visao = 'lista'; }});

  A.on('ag-visao', el => { const u = ui(); u.visao = el.dataset.v; A.render(); });
  A.on('ag-dia', el => { const u = ui(), d = el.dataset.dia; if (u.visao === 'mes') { setRef(d); u.visao = 'dia'; } else if (u.dia === d) u.dia = null; else setRef(d); A.render(); });
  A.on('ag-ver-dia', (el, e) => { if (e) e.stopPropagation(); setRef(el.dataset.dia); ui().visao = 'dia'; A.go('agenda'); });
  A.on('ag-mover', el => { const u = ui(), d = Number(el.dataset.d);
    if (u.visao === 'ano') { u.ano += d; u.dia = null; }
    else if (u.visao === 'mes') { u.mes += d; if (u.mes < 0) { u.mes = 11; u.ano--; } if (u.mes > 11) { u.mes = 0; u.ano++; } u.dia = null; }
    else setRef(P.addDays(ref(), u.visao === 'semana' ? 7 * d : d));
    A.render(); });
  A.on('ag-hoje', () => { setRef(A.hoje()); A.render(); });
  A.on('ag-abrir-mes', el => { const u = ui(); u.mes = Number(el.dataset.mes); u.dia = null; u.visao = 'mes'; A.render(); });
  A.on('novo-prazo', el => { if (A.pode('prazos', 'editar')) A.formPrazo(null, el.dataset.venc ? {vencimento: el.dataset.venc, publicacao: ''} : null); });
  A.on('editar-prazo', (el, e) => { if (e) e.stopPropagation(); const p = A.byId('prazos', el.dataset.id); if (p) A.formPrazo(p); });
  A.on('concluir-prazo', async el => { const p = A.byId('prazos', el.dataset.id); if (!p) return; const novo = Object.assign({}, p, {status: p.status === 'concluido' ? 'pendente' : 'concluido'});
    if (await A.save('prazos', novo)) { if (document.getElementById('fPrazo')) A.closeModal(); A.toast(novo.status === 'concluido' ? 'Prazo concluído.' : 'Prazo reaberto.'); } });
  A.on('excluir-prazo', el => { const id = el.dataset.id; A.confirm('Excluir prazo', 'Este prazo será apagado para toda a equipe. Se ele foi cumprido, prefira marcar como concluído.', 'Excluir', async () => { if (await A.remove('prazos', id)) A.toast('Prazo excluído.'); }); });

  /* ---------- compromissos ---------- */
  A.on('novo-comp', el => { if (A.pode('prazos', 'editar')) A.formComp(null, el.dataset.data ? {data: el.dataset.data} : null); });
  A.on('editar-comp', (el, e) => { if (e) e.stopPropagation(); const c = A.byId('compromissos', el.dataset.id); if (c) A.formComp(c); });
  A.on('concluir-comp', async el => { const c = A.byId('compromissos', el.dataset.id); if (!c) return; const novo = Object.assign({}, c, {status: c.status === 'concluido' ? 'agendado' : 'concluido'});
    if (await A.save('compromissos', novo)) { if (document.getElementById('fComp')) A.closeModal(); A.toast(novo.status === 'concluido' ? 'Compromisso concluído.' : 'Compromisso reaberto.'); } });
  A.on('excluir-comp', el => { const id = el.dataset.id; A.confirm('Excluir compromisso', 'Este compromisso será apagado da agenda de toda a equipe.', 'Excluir', async () => { if (await A.remove('compromissos', id)) A.toast('Compromisso excluído.'); }); });

  /* Cadastro de compromisso. preset pode trazer data, processoId, clienteId, responsavelId, tipo, titulo. */
  A.formComp = function (c, preset) {
    const novo = !c, ed = A.pode('prazos', 'editar'), ro = ed ? '' : 'disabled';
    c = Object.assign({id: '', tipo: 'Atendimento', titulo: '', data: ui().dia || A.hoje(), diaInteiro: false, horaInicio: '08:00', horaFim: '09:00', responsavelId: ui().resp !== 'todos' ? ui().resp : (A.me()?.id || ''), participantes: [], processoId: '', clienteId: '', local: '', status: 'agendado', obs: ''}, c || {}, preset || {});
    const part = A.col('equipe').filter(m => m.ativo !== false || (c.participantes || []).includes(m.id)).map(m => `<label class="chk"><input type="checkbox" name="cPart" value="${esc(m.id)}"${(c.participantes || []).includes(m.id) ? ' checked' : ''} ${ro}> ${esc(m.nome)}</label>`).join('');
    A.modal(`${A.modalHead(novo ? 'Novo compromisso' : 'Compromisso', !novo && c.status === 'concluido' ? '<span class="pill s-concluido">Concluído</span>' : '')}
    <form id="fComp"><div class="body">
      ${A.sel('cTipo', 'Tipo', A.opts(TIPOS_COMP.map(t => [t, t]), c.tipo), '', ro)}
      ${A.inp('cTit', 'Título', c.titulo, `required placeholder="Ex.: Atendimento Sr. João (para Dra. Helena)" ${ro}`)}
      ${A.inp('cData', 'Data', c.data, `type="date" required ${ro}`)}
      ${A.field('cHor', 'Horário', `<div style="display:flex;gap:6px;align-items:center"><input id="cIni" type="time" value="${esc(c.horaInicio)}" ${ro}><span class="muted">a</span><input id="cFim" type="time" value="${esc(c.horaFim)}" ${ro}><label class="chk"><input id="cTodo" type="checkbox"${c.diaInteiro ? ' checked' : ''} ${ro}> dia todo</label></div>`)}
      ${A.sel('cResp', 'Responsável', A.optsEquipe(c.responsavelId), '', ro)}
      ${A.inp('cLocal', 'Local ou link', c.local, `placeholder="Ex.: escritório Araguari, sala virtual do TRT3" ${ro}`)}
      ${A.field('cParts', 'Outros participantes', `<div class="chks">${part}</div>`, 'full')}
      ${A.sel('cProc', 'Processo', A.optsProcessos(c.processoId, 'Não vinculado'), '', ro)}
      ${A.sel('cCli', 'Cliente', A.optsClientes(c.clienteId, 'Nenhum'), '', ro)}
      ${A.area('cObs', 'Observações', c.obs, 2, ro)}
    </div><footer>${!novo && ed ? `<button type="button" class="btn danger left" data-action="excluir-comp" data-id="${esc(c.id)}">Excluir</button>` : ''}
      <button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>
      ${ed ? `${!novo ? `<button type="button" class="btn" data-action="concluir-comp" data-id="${esc(c.id)}">${c.status === 'concluido' ? 'Reabrir' : 'Marcar concluído'}</button>` : ''}<button type="submit" class="btn primary">Salvar</button>` : ''}</footer></form>`);
    const f = document.getElementById('fComp');
    const travar = () => { f.cIni.disabled = f.cFim.disabled = f.cTodo.checked || !ed; }; travar();
    f.cTodo.addEventListener('change', travar);
    f.cIni.addEventListener('change', () => { if (!f.cFim.value || f.cFim.value <= f.cIni.value) f.cFim.value = somaHora(f.cIni.value, 60); });
    f.cProc.addEventListener('change', () => { const pr = A.processo(f.cProc.value); if (pr && !f.cCli.value) f.cCli.value = pr.clienteId || ''; });
    f.addEventListener('submit', async e => { e.preventDefault(); if (!ed) return;
      const todo = f.cTodo.checked, ini = f.cIni.value, fim = f.cFim.value;
      if (!f.cData.value || !f.cTit.value.trim()) { A.toast('Informe título e data.'); return; }
      if (!todo && ini && fim && fim < ini) { A.toast('O horário final é antes do inicial.'); return; }
      const obj = Object.assign({}, c, {tipo: f.cTipo.value, titulo: f.cTit.value.trim(), data: f.cData.value, diaInteiro: todo, horaInicio: todo ? '' : ini, horaFim: todo ? '' : fim, responsavelId: f.cResp.value,
        participantes: [...f.querySelectorAll('input[name="cPart"]:checked')].map(x => x.value).filter(id => id !== f.cResp.value), local: f.cLocal.value.trim(), processoId: f.cProc.value, clienteId: f.cCli.value, obs: f.cObs.value.trim()});
      if (await A.save('compromissos', obj)) { A.closeModal(); A.toast('Compromisso salvo.'); }
    });
  };

  /* Cadastro de prazo. preset pode trazer processoId, clienteId, publicacao, publicacaoId, responsavelId, vencimento. */
  A.formPrazo = function (p, preset) {
    const novo = !p, ed = A.pode('prazos', 'editar'), ro = ed ? '' : 'disabled';
    p = Object.assign({id: '', processo: '', processoId: '', clienteId: '', cliente: '', tipo: 'Contestação', descricao: '', publicacao: A.hoje(), dias: 15, contagem: 'uteis', vencimento: '', responsavelId: ui().resp !== 'todos' ? ui().resp : (A.me()?.id || ''), prioridade: 'normal', status: 'pendente', obs: '', publicacaoId: ''}, p || {}, preset || {});
    if (p.processoId && !p.processo) { const pr = A.processo(p.processoId); if (pr) { p.processo = pr.numero; p.clienteId = p.clienteId || pr.clienteId; p.responsavelId = p.responsavelId || pr.responsavelId; } }
    A.modal(`${A.modalHead(novo ? 'Novo prazo' : 'Prazo', !novo ? `<span class="pill s-${sit(p)}">${esc(LABEL[sit(p)])}</span>` : '')}
    <form id="fPrazo"><div class="body">
      ${A.sel('pProcId', 'Processo cadastrado', A.optsProcessos(p.processoId, 'Não vinculado'), 'full', ro)}
      ${A.inp('pProc', 'Nº do processo (CNJ)', p.processo, `placeholder="0000000-00.0000.0.00.0000" ${ro}`)}
      ${A.sel('pCli', 'Cliente', A.optsClientes(p.clienteId, p.cliente || 'Nenhum'), '', ro)}
      ${A.field('pTipo', 'Tipo de prazo', `<input id="pTipo" list="tiposList" value="${esc(p.tipo)}" required ${ro}><datalist id="tiposList">${TIPOS.map(t => `<option value="${esc(t)}">`).join('')}</datalist>`)}
      ${A.sel('pResp', 'Responsável', A.optsEquipe(p.responsavelId), '', ro)}
      ${A.inp('pPub', 'Data da publicação', p.publicacao, `type="date" ${ro}`)}
      ${A.field('pDias', 'Prazo', `<div style="display:flex;gap:6px"><input id="pDias" type="number" min="1" max="365" value="${esc(p.dias)}" style="width:80px" ${ro}><select id="pCont" ${ro}>${A.opts([['uteis','dias úteis'],['corridos','dias corridos']], p.contagem)}</select></div>`)}
      <div class="calc" id="pCalc"></div>
      ${A.inp('pVenc', 'Vencimento (data fatal)', p.vencimento, `type="date" required ${ro}`)}
      ${A.sel('pPrio', 'Prioridade', A.opts([['normal','Normal'],['alta','Alta']], p.prioridade), '', ro)}
      ${A.inp('pDesc', 'Providência / descrição', p.descricao, `placeholder="Ex.: apresentar contestação com reconvenção" ${ro}`, 'full')}
      ${A.area('pObs', 'Observações', p.obs, 2, ro)}
    </div><footer>${!novo && ed ? `<button type="button" class="btn danger left" data-action="excluir-prazo" data-id="${esc(p.id)}">Excluir</button>` : ''}
      <button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>
      ${ed ? `${!novo ? `<button type="button" class="btn" data-action="concluir-prazo" data-id="${esc(p.id)}">${p.status === 'concluido' ? 'Reabrir' : 'Marcar concluído'}</button>` : ''}<button type="submit" class="btn primary">Salvar</button>` : ''}</footer></form>`);
    const f = document.getElementById('fPrazo');
    let manual = !!(preset && preset.vencimento && !preset.publicacao) || (!novo && p.publicacao && p.vencimento !== P.vencimento(p.publicacao, p.dias, p.contagem));
    const recalc = fromInputs => { const pub = f.pPub.value, d = f.pDias.value, c = f.pCont.value, calc = document.getElementById('pCalc');
      if (pub && d) { const v = P.vencimento(pub, d, c); if (fromInputs) manual = false; if (!manual) f.pVenc.value = v; const interna = P.voltarUteis(f.pVenc.value || v, 2);
        calc.innerHTML = `Calculado: começa em <b>${esc(A.fmtCurto(P.vencimento(pub, 1, 'uteis')))}</b> e vence em <b>${esc(A.fmtCurto(v))}/${v.slice(0, 4)}</b> (${esc(d)} ${c === 'corridos' ? 'dias corridos' : 'dias úteis'}, sem fins de semana, feriados e recesso).${manual && f.pVenc.value !== v ? ' <b>Vencimento ajustado manualmente.</b>' : ''} Meta interna sugerida: <b>${esc(A.fmtCurto(interna))}</b>.`; }
      else calc.innerHTML = 'Informe a data da publicação e o prazo para calcular o vencimento, ou preencha a data fatal diretamente.'; };
    ['pPub', 'pDias', 'pCont'].forEach(id => f[id].addEventListener('input', () => recalc(true)));
    f.pVenc.addEventListener('input', () => { manual = true; recalc(false); });
    f.pProcId.addEventListener('change', () => { const pr = A.processo(f.pProcId.value); if (pr) { f.pProc.value = pr.numero; f.pCli.value = pr.clienteId || ''; if (!f.pResp.value) f.pResp.value = pr.responsavelId || ''; } });
    recalc(false);
    f.addEventListener('submit', async e => { e.preventDefault(); if (!ed) return;
      const cli = A.cliente(f.pCli.value);
      const obj = Object.assign({}, p, {processoId: f.pProcId.value, processo: f.pProc.value.trim(), clienteId: f.pCli.value, cliente: cli ? cli.nome : p.cliente, tipo: f.pTipo.value.trim() || 'Prazo', descricao: f.pDesc.value.trim(),
        publicacao: f.pPub.value, dias: Number(f.pDias.value) || null, contagem: f.pCont.value, vencimento: f.pVenc.value, responsavelId: f.pResp.value, prioridade: f.pPrio.value, obs: f.pObs.value.trim()});
      if (!obj.vencimento) { A.toast('Informe o vencimento.'); return; }
      const salvo = await A.save('prazos', obj);
      if (salvo) { if (obj.publicacaoId) { const pb = A.byId('publicacoes', obj.publicacaoId); if (pb && pb.prazoId !== salvo.id) await A.save('publicacoes', Object.assign({}, pb, {prazoId: salvo.id, status: 'tratada', tratadaEm: new Date().toISOString(), tratadaPor: S.meId || null})); }
        A.closeModal(); A.toast('Prazo salvo.'); }
    });
  };

  /* Aviso ao abrir o sistema */
  A.depoisDeCarregar = function () {
    if (A.ssGet('gomes-aviso') || !A.pode('prazos', 'ver')) return;
    const urg = vis().filter(p => ['vencido', 'hoje', 'critico'].includes(sit(p))).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (!urg.length || document.querySelector('.modal')) return; A.ssSet('gomes-aviso', '1');
    A.modal(`<header><span class="pulse" aria-hidden="true"></span><h3>${urg.length} prazo${urg.length > 1 ? 's pedem' : ' pede'} atenção agora</h3><button class="iconbtn" data-action="modal-fechar" aria-label="Fechar">×</button></header>
      <div class="urgent-list">${urg.map(A.pcardPrazo).join('')}</div><footer><button class="btn" data-action="modal-fechar">Entendi</button><a class="btn primary" href="#prazos" data-action="modal-fechar" style="text-decoration:none">Ver todos os prazos</a></footer>`, {nofocus: true});
  };
})(window.App);
