/* Módulo Agenda: calendário anual e mensal, lista de prazos, cadastro de prazo, feriados e alertas. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const TIPOS = ['Contestação','Réplica','Recurso de Apelação','Agravo de Instrumento','Agravo Interno','Embargos de Declaração','Contrarrazões','Manifestação','Impugnação','Cumprimento de sentença','Recurso Ordinário','Audiência','Perícia','Juntada de documentos','Diligência / protocolo','Prazo interno'];
  const LABEL = {vencido:'Vencido',hoje:'Vence hoje',critico:'Até 2 dias úteis',atencao:'Próximo',ok:'No prazo',concluido:'Concluído'};
  const ORDER = {vencido:0,hoje:1,critico:2,atencao:3,ok:4,concluido:5};
  const ui = () => A.ui('agenda', {ano: new Date().getFullYear(), mes: new Date().getMonth(), dia: null, resp: 'todos', status: 'abertos', busca: ''});
  const ant = () => Number(S.config.antecedencia) || 5;
  const sit = p => P.situacao(p, A.hoje(), ant());
  A.sitPrazo = sit; A.LABEL_PRAZO = LABEL;
  const vis = () => A.col('prazos').filter(p => ui().resp === 'todos' || p.responsavelId === ui().resp);
  const nomeCliente = p => A.cliente(p.clienteId)?.nome || p.cliente || '';
  const restam = p => { const h = A.hoje(); if (p.vencimento < h) return 'venceu há ' + P.uteisEntre(p.vencimento, h) + ' dia(s) útil(eis)'; if (p.vencimento === h) return 'vence hoje'; const u = P.uteisEntre(h, p.vencimento); return 'em ' + u + (u === 1 ? ' dia útil' : ' dias úteis'); };
  function porDia() { const m = new Map(); for (const p of vis()) { if (!p.vencimento) continue; if (!m.has(p.vencimento)) m.set(p.vencimento, []); m.get(p.vencimento).push(p); }
    for (const a of m.values()) a.sort((x, y) => ORDER[sit(x)] - ORDER[sit(y)]); return m; }
  const pior = arr => arr.reduce((w, p) => ORDER[sit(p)] < ORDER[w] ? sit(p) : w, 'concluido');
  const filtroResp = () => `<label class="muted" for="agResp" style="font-size:12px">Mostrar</label><select id="agResp" data-ui="agenda.resp"><option value="todos">Toda a equipe</option>${A.col('equipe').map(m => `<option value="${esc(m.id)}"${ui().resp === m.id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`;
  const legenda = () => `<div class="legend"><span class="s-vencido"><i></i>Vencido / vence hoje</span><span class="s-critico"><i></i>Até 2 dias úteis</span><span class="s-atencao"><i></i>Até ${ant()} dias úteis</span><span class="s-ok"><i></i>No prazo</span><span class="s-concluido"><i></i>Concluído</span><span><b style="color:var(--hol);text-decoration:underline dotted">15</b> feriado</span><span><i style="background:repeating-linear-gradient(135deg,var(--recesso) 0 3px,transparent 3px 6px);border-color:var(--line)"></i>Recesso forense (20/12 a 20/01)</span></div>`;

  A.pcardPrazo = function (p) { const s = sit(p), m = A.membro(p.responsavelId);
    return `<button class="pcard s-${s}" data-action="editar-prazo" data-id="${esc(p.id)}"><span class="t">${esc(p.tipo)}${p.prioridade === 'alta' ? ' · <span style="color:var(--danger)">prioridade alta</span>' : ''}</span>
      <span class="meta"><span class="pill">${esc(LABEL[s])}</span><span class="num">${esc(A.fmt(p.vencimento))}</span><span>${s === 'concluido' ? '' : esc(restam(p))}</span></span>
      <span class="meta">${esc(nomeCliente(p))}</span><span class="meta proc">${esc(p.processo || '')}</span><span class="meta">${A.avatar(m)} ${esc(m ? m.nome : 'Sem responsável')}</span></button>`; };

  function vAno() {
    const u = ui(), h = A.hoje(), mapa = porDia(); let meses = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(u.ano, m, 1), dim = new Date(u.ano, m + 1, 0).getDate();
      let cells = ['D','S','T','Q','Q','S','S'].map(d => `<span class="dow">${d}</span>`).join('') + '<span class="d out"></span>'.repeat(first.getDay()); let total = 0;
      for (let d = 1; d <= dim; d++) {
        const s = P.ymd(new Date(u.ano, m, d)), arr = mapa.get(s) || [], fer = P.feriado(s), cls = ['d'];
        if (P.fimDeSemana(s)) cls.push('we'); if (P.recesso(s)) cls.push('rec'); if (fer) cls.push('hol'); if (s === h) cls.push('today'); if (s === u.dia) cls.push('sel');
        if (arr.length) { cls.push('has', 's-' + pior(arr)); total += arr.length; }
        const tip = [A.fmt(s), fer, P.recesso(s) ? 'Recesso forense (prazos suspensos)' : '', ...arr.map(p => p.tipo + ' · ' + nomeCliente(p))].filter(Boolean).join('\n');
        cells += `<button class="${cls.join(' ')}" data-action="ag-dia" data-dia="${s}" title="${esc(tip)}" aria-label="${esc(tip)}">${d}${arr.length > 1 ? `<span class="n">${arr.length}</span>` : ''}</button>`;
      }
      const cur = u.ano === new Date().getFullYear() && m === new Date().getMonth();
      meses += `<div class="mini${cur ? ' current' : ''}"><h3><button data-action="ag-abrir-mes" data-mes="${m}">${A.MESES[m]}</button><small class="num">${total ? total + ' prazo' + (total > 1 ? 's' : '') : ''}</small></h3><div class="mgrid">${cells}</div></div>`;
    }
    return `<section class="panel"><div class="vhead"><button class="iconbtn" data-action="ag-ano" data-d="-1" aria-label="Ano anterior">‹</button><h2 class="num">${u.ano}</h2>${filtroResp()}<button class="btn small" data-action="ag-hoje">Hoje</button><button class="iconbtn" data-action="ag-ano" data-d="1" aria-label="Próximo ano">›</button></div><div class="year">${meses}</div>${legenda()}</section>`;
  }

  function vMes() {
    const u = ui(), h = A.hoje(), mapa = porDia(), first = new Date(u.ano, u.mes, 1), start = P.addDays(P.ymd(first), -first.getDay());
    let cells = A.DOWL.map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const s = P.addDays(start, i), dt = P.parse(s); if (i >= 35 && dt.getMonth() !== u.mes) break;
      const arr = mapa.get(s) || [], fer = P.feriado(s), cls = ['cell'];
      if (dt.getMonth() !== u.mes) cls.push('out'); if (P.fimDeSemana(s)) cls.push('we'); if (P.recesso(s)) cls.push('rec'); if (s === h) cls.push('today'); if (s === u.dia) cls.push('sel');
      cells += `<div class="${cls.join(' ')}" data-action="ag-dia" data-dia="${s}"><div class="top-row"><span class="dn num">${dt.getDate()}</span>${fer ? `<span class="hn">${esc(fer)}</span>` : ''}</div>
        ${arr.slice(0, 3).map(p => `<button class="ev s-${sit(p)}" data-action="editar-prazo" data-id="${esc(p.id)}" title="${esc(p.tipo + ' · ' + nomeCliente(p) + ' · ' + (p.processo || ''))}">${esc(A.iniciais(A.membro(p.responsavelId)?.nome))} · ${esc(p.tipo)}</button>`).join('')}${arr.length > 3 ? `<span class="more">+${arr.length - 3} mais</span>` : ''}</div>`;
    }
    return `<section class="panel"><div class="vhead"><button class="iconbtn" data-action="ag-mes" data-d="-1" aria-label="Mês anterior">‹</button><h2 style="text-transform:capitalize">${A.MESES[u.mes]} <span class="num">${u.ano}</span></h2>${filtroResp()}<button class="btn small" data-action="ag-hoje">Hoje</button><button class="iconbtn" data-action="ag-mes" data-d="1" aria-label="Próximo mês">›</button></div><div class="month">${cells}</div>${legenda()}</section>`;
  }

  function vLado() {
    const u = ui(); let topo;
    if (u.dia) { const arr = porDia().get(u.dia) || [], fer = P.feriado(u.dia);
      const obs = [fer ? 'Feriado: ' + fer : '', P.recesso(u.dia) ? 'Recesso forense: prazos suspensos' : '', P.fimDeSemana(u.dia) ? 'Fim de semana' : '', (!fer && !P.recesso(u.dia) && !P.fimDeSemana(u.dia)) ? 'Dia útil' : ''].filter(Boolean).join(' · ');
      topo = `<h3>${esc(A.fmtCurto(u.dia))}/${u.dia.slice(0, 4)}</h3><div class="sub">${esc(obs)}</div><div class="plist">${arr.length ? arr.map(A.pcardPrazo).join('') : '<div class="empty">Nenhum prazo vence neste dia.</div>'}</div>
        ${A.pode('prazos', 'editar') ? `<div style="margin-top:10px"><button class="btn small" data-action="novo-prazo" data-venc="${u.dia}">+ Prazo com vencimento nesta data</button></div>` : ''}`;
    } else { const prox = vis().filter(p => p.status !== 'concluido' && p.vencimento).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
      topo = `<h3>Próximos vencimentos</h3><div class="sub">Clique num dia do calendário para ver os prazos dele.</div><div class="plist">${prox.map(A.pcardPrazo).join('') || '<div class="empty">Nenhum prazo em aberto.</div>'}</div>`; }
    const ab = A.col('prazos').filter(p => p.status !== 'concluido'); const max = Math.max(1, ...A.col('equipe').map(m => ab.filter(p => p.responsavelId === m.id).length));
    const carga = A.col('equipe').map(m => { const n = ab.filter(p => p.responsavelId === m.id).length; if (!n) return ''; const urg = ab.filter(p => p.responsavelId === m.id && ['vencido','hoje','critico'].includes(sit(p))).length;
      return `<div class="loadrow">${A.avatar(m)}<span>${esc(m.nome)}</span><span class="num muted">${n}${urg ? ` · <b style="color:var(--danger)">${urg} urgente${urg > 1 ? 's' : ''}</b>` : ''}</span><span></span><span class="bar"><b style="width:${Math.round(n / max * 100)}%;background:${esc(m.cor)}"></b></span></div>`; }).join('');
    return `<aside class="panel side">${topo}<div class="sec"><h4>Carga da equipe (prazos em aberto)</h4><div class="load">${carga || '<span class="muted">Nenhum prazo em aberto.</span>'}</div></div></aside>`;
  }

  function listaFiltrada() { const u = ui();
    return vis().filter(p => u.status === 'todos' || (u.status === 'concluidos' ? p.status === 'concluido' : p.status !== 'concluido'))
      .filter(p => A.match(u.busca, p.processo, nomeCliente(p), p.tipo, p.descricao, p.obs, A.membro(p.responsavelId)?.nome))
      .sort((a, b) => ORDER[sit(a)] - ORDER[sit(b)] || (a.vencimento || '').localeCompare(b.vencimento || '')); }
  A.exportadores.prazos = () => ({titulo: 'Prazos', filtros: 'Situação: ' + ui().status + (ui().resp !== 'todos' ? ' · Responsável: ' + A.nomeDe(ui().resp) : ''), linhas: listaFiltrada(),
    colunas: [{t:'Situação', v:p => LABEL[sit(p)]}, {t:'Vencimento', v:p => p.vencimento, tipo:'date'}, {t:'Tipo', v:p => p.tipo}, {t:'Processo', v:p => p.processo}, {t:'Cliente', v:nomeCliente}, {t:'Responsável', v:p => A.membro(p.responsavelId)?.nome || ''}, {t:'Publicação', v:p => p.publicacao, tipo:'date'}, {t:'Providência', v:p => p.descricao}]});
  function vLista() {
    const u = ui(), arr = listaFiltrada(), ed = A.pode('prazos', 'editar');
    const rows = arr.map(p => { const s = sit(p), m = A.membro(p.responsavelId);
      return `<tr class="s-${s}${s === 'concluido' ? ' done' : ''}"><td><span class="pill">${esc(LABEL[s])}</span></td><td class="num" style="white-space:nowrap"><b>${esc(A.fmt(p.vencimento))}</b><br><span class="muted" style="font-size:12px">${s === 'concluido' ? '' : esc(restam(p))}</span></td>
        <td>${esc(p.tipo)}${p.prioridade === 'alta' ? ' <span style="color:var(--danger);font-size:11px;font-weight:600">ALTA</span>' : ''}</td><td><span class="proc">${esc(p.processo)}</span><br><span class="muted" style="font-size:12px">${esc(nomeCliente(p))}</span></td>
        <td><span class="who">${A.avatar(m)}${esc(m ? m.nome : '—')}</span></td><td><div class="rowact">${ed ? `<button class="btn small" data-action="concluir-prazo" data-id="${esc(p.id)}">${s === 'concluido' ? 'Reabrir' : 'Concluir'}</button>` : ''}<button class="btn small" data-action="editar-prazo" data-id="${esc(p.id)}">${ed ? 'Editar' : 'Ver'}</button></div></td></tr>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Prazos</h2><span class="muted num">${arr.length} prazo(s)</span>${A.botoesExport('prazos')}</div>
      <div class="filters"><select id="pzSt" data-ui="agenda.status">${A.opts([['abertos','Em aberto'],['concluidos','Concluídos'],['todos','Todos']], u.status)}</select>${filtroResp()}
      <input id="pzBusca" type="search" data-ui="agenda.busca" placeholder="Buscar processo, cliente, tipo…" value="${esc(u.busca)}" style="flex:1 1 240px"></div>
      <div class="tablewrap"><table><thead><tr><th>Situação</th><th>Vencimento</th><th>Tipo</th><th>Processo / cliente</th><th>Responsável</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty" style="padding:16px">Nenhum prazo encontrado.</td></tr>'}</tbody></table></div></section>`;
  }

  A.route('ano', {label: 'Calendário anual', mod: 'prazos', render: vAno, lado: vLado});
  A.route('mes', {label: 'Calendário mensal', mod: 'prazos', render: vMes, lado: vLado});
  A.route('prazos', {label: 'Prazos', mod: 'prazos', render: vLista, badge: () => A.col('prazos').filter(p => ['vencido','hoje','critico'].includes(sit(p))).length});

  A.on('ag-dia', el => { const u = ui(); u.dia = u.dia === el.dataset.dia && S.rota === 'ano' ? null : el.dataset.dia; A.render(); });
  A.on('ag-ano', el => { ui().ano += Number(el.dataset.d); ui().dia = null; A.render(); });
  A.on('ag-mes', el => { const u = ui(); u.mes += Number(el.dataset.d); if (u.mes < 0) { u.mes = 11; u.ano--; } if (u.mes > 11) { u.mes = 0; u.ano++; } A.render(); });
  A.on('ag-hoje', () => { const d = new Date(), u = ui(); u.ano = d.getFullYear(); u.mes = d.getMonth(); u.dia = A.hoje(); A.render(); });
  A.on('ag-abrir-mes', el => { ui().mes = Number(el.dataset.mes); A.go('mes'); });
  A.on('novo-prazo', el => { if (A.pode('prazos', 'editar')) A.formPrazo(null, el.dataset.venc ? {vencimento: el.dataset.venc, publicacao: ''} : null); });
  A.on('editar-prazo', el => { const p = A.byId('prazos', el.dataset.id); if (p) A.formPrazo(p); });
  A.on('concluir-prazo', async el => { const p = A.byId('prazos', el.dataset.id); if (!p) return; const novo = Object.assign({}, p, {status: p.status === 'concluido' ? 'pendente' : 'concluido'});
    if (await A.save('prazos', novo)) { if (document.getElementById('fPrazo')) A.closeModal(); A.toast(novo.status === 'concluido' ? 'Prazo concluído.' : 'Prazo reaberto.'); } });
  A.on('excluir-prazo', el => { const id = el.dataset.id; A.confirm('Excluir prazo', 'Este prazo será apagado para toda a equipe. Se ele foi cumprido, prefira marcar como concluído.', 'Excluir', async () => { if (await A.remove('prazos', id)) A.toast('Prazo excluído.'); }); });

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
