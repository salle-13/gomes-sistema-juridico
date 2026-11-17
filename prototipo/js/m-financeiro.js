/* Módulo Financeiro (parte 1): contas a receber, contas a pagar, custas e despesas processuais, baixas manuais e centros de custo.
   Sem integração bancária: todos os lançamentos e baixas são manuais. */
(function (A) {
  const S = A.S, esc = A.esc;
  A.CAT_RECEBER = ['Honorários contratuais','Honorários iniciais','Honorários de êxito','Honorários de sucumbência','Consultoria','Reembolso de despesas','Outras receitas'];
  A.CAT_PAGAR = ['Custas processuais','Despesas processuais','Aluguel','Pessoal','Pró-labore','Impostos e taxas','Software e sistemas','Marketing','Material de escritório','Anuidade OAB','Contabilidade','Outras despesas'];
  const naturezaDe = cat => /^custas/i.test(cat) ? 'custas' : /despesas processuais/i.test(cat) ? 'despesa_processual' : /^honor/i.test(cat) ? 'honorarios' : /reembolso/i.test(cat) ? 'reembolso' : 'operacional';
  A.situacaoFin = f => f.status === 'pago' ? 'pago' : f.status === 'cancelado' ? 'cancelado' : (f.vencimento < A.hoje() ? 'vencido' : f.vencimento === A.hoje() ? 'hoje' : 'pendente');
  const SIT = {pendente: ['A vencer', 's-ok'], hoje: ['Vence hoje', 's-hoje'], vencido: ['Vencido', 's-vencido'], pago: ['Pago', 's-concluido'], cancelado: ['Cancelado', 's-concluido']};
  const sitLabel = f => { const s = A.situacaoFin(f); return s === 'pago' ? (f.tipo === 'receber' ? 'Recebido' : 'Pago') + ' em ' + A.fmt(f.pagoEm) : SIT[s][0]; };
  A.centro = id => A.byId('centros_custo', id);
  const VIEWS = {
    'fin-receber': {titulo: 'Contas a receber', filtro: f => f.tipo === 'receber', tipo: 'receber'},
    'fin-pagar': {titulo: 'Contas a pagar', filtro: f => f.tipo === 'pagar', tipo: 'pagar'},
    'fin-custas': {titulo: 'Custas e despesas processuais', filtro: f => f.tipo === 'pagar' && ['custas','despesa_processual'].includes(f.natureza), tipo: 'pagar', custas: true},
  };
  const ui = () => A.ui('fin', {de: A.addMonths(A.hoje(), -1).slice(0, 8) + '01', ate: A.addMonths(A.hoje(), 1).slice(0, 8) + '28', status: 'abertos', centro: '', cliente: '', busca: ''});

  function filtrar(rota) { const u = ui(), v = VIEWS[rota];
    return A.col('fin_lancamentos').filter(v.filtro).filter(f => {
      const s = A.situacaoFin(f);
      if (u.status === 'abertos' && !['pendente','vencido','hoje'].includes(s)) return false;
      if (u.status === 'vencidos' && s !== 'vencido') return false; if (u.status === 'pagos' && s !== 'pago') return false; if (u.status === 'cancelados' && s !== 'cancelado') return false;
      const ref = s === 'pago' ? f.pagoEm : f.vencimento;
      if (u.status !== 'vencidos' && u.status !== 'abertos' && ((u.de && ref < u.de) || (u.ate && ref > u.ate))) return false;
      if (u.status === 'abertos' && u.ate && f.vencimento > u.ate) return false;
      return (!u.centro || f.centroCustoId === u.centro) && (!u.cliente || f.clienteId === u.cliente) && A.match(u.busca, f.descricao, f.categoria, f.documento, A.cliente(f.clienteId)?.nome, A.processo(f.processoId)?.numero);
    }).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')); }
  const colunas = rota => [{t:'Vencimento', v:f => f.vencimento, tipo:'date'}, {t:'Descrição', v:f => f.descricao}, {t:'Categoria', v:f => f.categoria}, {t:'Cliente', v:f => A.cliente(f.clienteId)?.nome || ''},
    {t:'Processo', v:f => A.processo(f.processoId)?.numero || ''}, {t:'Centro de custo', v:f => A.centro(f.centroCustoId)?.nome || ''}, {t:'Situação', v:sitLabel},
    ...(VIEWS[rota].custas ? [{t:'Reembolsável', v:f => f.reembolsavel ? 'Sim' : 'Não'}] : []), {t:'Valor', v:f => f.valor, tipo:'money'}, {t:'Valor pago', v:f => f.status === 'pago' ? f.valorPago : 0, tipo:'money'}];
  Object.keys(VIEWS).forEach(rota => { A.exportadores[rota] = () => { const l = filtrar(rota), u = ui();
    return {titulo: VIEWS[rota].titulo, filtros: `Período ${A.fmt(u.de)} a ${A.fmt(u.ate)} · ${u.status}`, linhas: l, colunas: colunas(rota), totais: {'Valor': l.reduce((s, f) => s + (f.status === 'cancelado' ? 0 : f.valor), 0), 'Valor pago': l.reduce((s, f) => s + (f.status === 'pago' ? f.valorPago || 0 : 0), 0)}}; }; });

  function vLista(rota) {
    const u = ui(), v = VIEWS[rota], ed = A.pode('financeiro', 'editar'), arr = filtrar(rota);
    const tot = arr.reduce((s, f) => s + (f.status === 'cancelado' ? 0 : f.valor), 0), pago = arr.reduce((s, f) => s + (f.status === 'pago' ? f.valorPago || 0 : 0), 0);
    const venc = arr.filter(f => A.situacaoFin(f) === 'vencido').reduce((s, f) => s + f.valor, 0);
    const rows = arr.map(f => { const s = A.situacaoFin(f), cli = A.cliente(f.clienteId), pr = A.processo(f.processoId);
      const reemb = v.custas && f.reembolsavel ? (A.col('fin_lancamentos').find(x => x.reembolsoDe === f.id) ? '<span class="tag">Reembolso lançado</span>' : (ed ? `<button class="btn small" data-action="fin-reembolso" data-id="${esc(f.id)}">Cobrar reembolso</button>` : '<span class="tag alta">A cobrar</span>')) : '';
      return `<tr class="${SIT[s][1]}${s === 'cancelado' ? ' done' : ''}"><td class="num" style="white-space:nowrap">${esc(A.fmt(f.vencimento))}</td><td><b>${esc(f.descricao)}</b><br><span class="muted" style="font-size:12px">${esc(f.categoria)}${f.parcela ? ' · parcela ' + f.parcela.n + '/' + f.parcela.total : ''}${f.documento ? ' · ' + esc(f.documento) : ''}</span></td>
        <td>${esc(cli?.nome || '—')}${pr ? `<br><span class="muted proc" style="font-size:12px">${esc(pr.numero)}</span>` : ''}</td><td>${esc(A.centro(f.centroCustoId)?.nome || '—')}</td><td><span class="pill">${esc(sitLabel(f))}</span> ${reemb}</td>
        <td class="money"><b>${A.brl(f.valor)}</b>${f.status === 'pago' && f.valorPago !== f.valor ? `<br><span class="muted" style="font-size:12px">pago ${A.brl(f.valorPago)}</span>` : ''}</td>
        <td><div class="rowact">${ed && ['pendente','vencido','hoje'].includes(s) ? `<button class="btn small primary" data-action="fin-baixar" data-id="${esc(f.id)}">${f.tipo === 'receber' ? 'Receber' : 'Pagar'}</button>` : ''}<button class="btn small" data-action="fin-editar" data-id="${esc(f.id)}">${ed ? 'Editar' : 'Ver'}</button></div></td></tr>`; }).join('');
    const novoBtn = ed ? (v.custas ? `<button class="btn" data-action="fin-novo" data-tipo="pagar" data-cat="Despesas processuais">+ Despesa processual</button><button class="btn primary" data-action="fin-novo" data-tipo="pagar" data-cat="Custas processuais">+ Custa processual</button>`
      : `<button class="btn primary" data-action="fin-novo" data-tipo="${v.tipo}">+ Nova conta a ${v.tipo === 'receber' ? 'receber' : 'pagar'}</button>`) : '';
    return `<section class="panel"><div class="vhead"><h2>${esc(v.titulo)}</h2>${A.botoesExport(rota)}${novoBtn}</div>
      <div class="kpis"><div class="kpi"><span>Total listado</span><strong>${A.brl(tot)}</strong><small>${arr.length} lançamento(s)</small></div>
        <div class="kpi" style="--c:var(--ok)"><span>${v.tipo === 'receber' ? 'Recebido' : 'Pago'}</span><strong>${A.brl(pago)}</strong></div>
        <div class="kpi" style="--c:var(--amber)"><span>Em aberto</span><strong>${A.brl(arr.filter(f => f.status === 'pendente').reduce((s, f) => s + f.valor, 0))}</strong></div>
        <div class="kpi" style="--c:var(--danger)"><span>Vencido</span><strong>${A.brl(venc)}</strong></div></div>
      <div class="filters"><select id="fnSt" data-ui="fin.status">${A.opts([['abertos','Em aberto (até o fim do período)'],['vencidos','Somente vencidos'],['pagos','Pagos / recebidos no período'],['todos','Todos no período'],['cancelados','Cancelados']], u.status)}</select>
        <label class="muted" for="fnDe" style="font-size:12px">De</label><input id="fnDe" type="date" data-ui="fin.de" value="${esc(u.de)}"><label class="muted" for="fnAte" style="font-size:12px">até</label><input id="fnAte" type="date" data-ui="fin.ate" value="${esc(u.ate)}">
        <select id="fnCc" data-ui="fin.centro">${A.opts(A.col('centros_custo').map(c => [c.id, c.codigo + ' · ' + c.nome]), u.centro, 'Todos os centros de custo')}</select>
        <select id="fnCli" data-ui="fin.cliente">${A.optsClientes(u.cliente, 'Todos os clientes')}</select>
        <input id="fnBusca" type="search" data-ui="fin.busca" placeholder="Buscar descrição, documento…" value="${esc(u.busca)}" style="flex:1 1 180px"></div>
      <div class="tablewrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Cliente / processo</th><th>Centro de custo</th><th>Situação</th><th class="money">Valor</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhum lançamento com esses filtros.</td></tr>'}</tbody></table></div></section>`;
  }
  const badgeVenc = tipo => () => A.col('fin_lancamentos').filter(f => f.tipo === tipo && ['vencido','hoje'].includes(A.situacaoFin(f))).length;
  A.route('fin-receber', {label: 'Contas a receber', mod: 'financeiro', render: () => vLista('fin-receber'), badge: badgeVenc('receber')});
  A.route('fin-pagar', {label: 'Contas a pagar', mod: 'financeiro', render: () => vLista('fin-pagar'), badge: badgeVenc('pagar')});
  A.route('fin-custas', {label: 'Custas e despesas', mod: 'financeiro', render: () => vLista('fin-custas')});

  /* ---------- cadastro de lançamento ---------- */
  A.on('fin-novo', el => A.formLancamento(null, {tipo: el.dataset.tipo, categoria: el.dataset.cat || ''}));
  A.on('fin-editar', el => { const f = A.byId('fin_lancamentos', el.dataset.id); if (f) A.formLancamento(f); });
  A.formLancamento = function (f, preset) {
    const novo = !f, ed = A.pode('financeiro', 'editar'), ro = ed ? '' : 'disabled';
    f = Object.assign({tipo: 'pagar', categoria: '', natureza: '', descricao: '', valor: 0, vencimento: A.hoje(), competencia: A.hoje().slice(0, 7), status: 'pendente', clienteId: '', processoId: '', centroCustoId: '', conta: (S.config.contas || [])[0] || '', documento: '', reembolsavel: false, obs: ''}, f || {}, preset || {});
    if (!f.categoria) f.categoria = f.tipo === 'receber' ? 'Honorários contratuais' : 'Outras despesas';
    if (f.processoId && !f.centroCustoId) { const pr = A.processo(f.processoId); f.centroCustoId = (A.col('centros_custo').find(c => pr && A.norm(c.nome).includes(A.norm(pr.area).replace('direito ', ''))) || {}).id || ''; }
    const s = A.situacaoFin(f);
    A.modal(`${A.modalHead(novo ? (f.tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar') : f.descricao, !novo ? `<span class="pill ${SIT[s][1]}">${esc(sitLabel(f))}</span>` : '')}
      <form id="fLanc"><div class="body">
        ${A.sel('lTipo', 'Tipo', A.opts([['receber','A receber (entrada)'],['pagar','A pagar (saída)']], f.tipo), '', ro + (novo ? '' : ' disabled'))}
        ${A.inp('lCat', 'Categoria', f.categoria, `list="lCats" required ${ro}`)}<datalist id="lCats">${(f.tipo === 'receber' ? A.CAT_RECEBER : A.CAT_PAGAR).map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        ${A.inp('lDesc', 'Descrição', f.descricao, `required ${ro}`, 'full')}
        ${A.inp('lValor', 'Valor (R$)', f.valor ? A.num(f.valor) : '', `inputmode="decimal" required ${ro}`)}
        ${A.inp('lVenc', 'Vencimento', f.vencimento, `type="date" required ${ro}`)}
        ${A.inp('lComp', 'Competência', f.competencia, `type="month" ${ro}`)}
        ${A.sel('lCc', 'Centro de custo', A.opts(A.col('centros_custo').filter(c => c.ativo !== false || c.id === f.centroCustoId).map(c => [c.id, c.codigo + ' · ' + c.nome]), f.centroCustoId, 'Selecione'), '', ro)}
        ${A.sel('lCli', 'Cliente', A.optsClientes(f.clienteId), '', ro)}${A.sel('lProc', 'Processo', A.optsProcessos(f.processoId), '', ro)}
        ${A.sel('lConta', 'Conta / caixa', A.opts(S.config.contas || [], f.conta, 'Selecione'), '', ro)}${A.inp('lDoc', 'Nº do documento (NF, recibo, guia)', f.documento, ro)}
        ${f.tipo === 'pagar' ? A.field('lReemb', 'Reembolso', `<label style="display:flex;gap:8px;align-items:center;padding:7px 0"><input type="checkbox" id="lReemb" ${f.reembolsavel ? 'checked' : ''} ${ro}> Despesa reembolsável pelo cliente</label>`) : ''}
        ${novo ? A.field('lParc', 'Repetir / parcelar', `<div style="display:flex;gap:6px;align-items:center"><input id="lParc" type="number" min="1" max="60" value="1" style="width:70px" ${ro}><span class="muted" style="font-size:12px">vez(es), mensalmente</span></div>`) : ''}
        ${A.area('lObs', 'Observações', f.obs, 2, ro)}
        ${f.status === 'pago' ? `<div class="calc">${f.tipo === 'receber' ? 'Recebido' : 'Pago'} em <b>${esc(A.fmt(f.pagoEm))}</b> · ${A.brl(f.valorPago)} · ${esc(f.conta || '')}${f.forma ? ' · ' + esc(f.forma) : ''}</div>` : ''}
      </div><footer>${!novo && ed ? `<button type="button" class="btn danger left" data-action="fin-excluir" data-id="${esc(f.id)}">Excluir</button>` : ''}
        <button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>
        ${ed && !novo && f.status === 'pendente' ? `<button type="button" class="btn" data-action="fin-cancelar" data-id="${esc(f.id)}">Cancelar lançamento</button><button type="button" class="btn" data-action="fin-baixar" data-id="${esc(f.id)}">${f.tipo === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'}</button>` : ''}
        ${ed && !novo && f.status !== 'pendente' ? `<button type="button" class="btn" data-action="fin-reabrir" data-id="${esc(f.id)}">${f.status === 'pago' ? 'Estornar baixa' : 'Reativar'}</button>` : ''}
        ${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`);
    const fm = document.getElementById('fLanc');
    fm.lTipo.addEventListener('change', () => { document.getElementById('lCats').innerHTML = (fm.lTipo.value === 'receber' ? A.CAT_RECEBER : A.CAT_PAGAR).map(c => `<option value="${esc(c)}">`).join(''); });
    fm.lProc.addEventListener('change', () => { const pr = A.processo(fm.lProc.value); if (pr && !fm.lCli.value) fm.lCli.value = pr.clienteId || ''; });
    fm.lVenc.addEventListener('change', () => { if (novo) fm.lComp.value = fm.lVenc.value.slice(0, 7); });
    fm.addEventListener('submit', async e => { e.preventDefault(); if (!ed) return;
      const base = Object.assign({}, f, {tipo: fm.lTipo.value, categoria: A.v('lCat'), natureza: naturezaDe(A.v('lCat')), descricao: A.v('lDesc'), valor: A.cents(A.v('lValor')), vencimento: A.v('lVenc'), competencia: A.v('lComp') || A.v('lVenc').slice(0, 7),
        centroCustoId: A.v('lCc'), clienteId: A.v('lCli'), processoId: A.v('lProc'), conta: A.v('lConta'), documento: A.v('lDoc'), reembolsavel: fm.lTipo.value === 'pagar' && !!document.getElementById('lReemb')?.checked, obs: A.v('lObs')});
      if (base.valor <= 0) { A.toast('Informe um valor maior que zero.'); return; } if (!base.vencimento) { A.toast('Informe o vencimento.'); return; }
      const n = novo ? Math.max(1, Math.min(60, Number(A.v('lParc')) || 1)) : 1, grupo = n > 1 ? A.uid().slice(0, 12) : null; let ok = 0;
      for (let i = 0; i < n; i++) { const o = Object.assign({}, base, n > 1 ? {vencimento: A.addMonths(base.vencimento, i), competencia: A.addMonths(base.vencimento, i).slice(0, 7), parcela: {n: i + 1, total: n, grupo}, descricao: base.descricao + ` (${i + 1}/${n})`} : {});
        if (await A.save('fin_lancamentos', o)) ok++; }
      if (ok) { A.closeModal(); A.toast(n > 1 ? ok + ' lançamentos criados.' : 'Lançamento salvo.'); } });
  };

  /* ---------- baixa manual ---------- */
  A.on('fin-baixar', el => { const f = A.byId('fin_lancamentos', el.dataset.id); if (!f) return; const rec = f.tipo === 'receber';
    A.modal(`${A.modalHead(rec ? 'Registrar recebimento' : 'Registrar pagamento')}<form id="fBaixa"><div class="body">
      <div class="calc"><b>${esc(f.descricao)}</b> · vencimento ${esc(A.fmt(f.vencimento))} · ${A.brl(f.valor)}</div>
      ${A.inp('bData', rec ? 'Data do recebimento' : 'Data do pagamento', A.hoje(), 'type="date" required')}${A.inp('bValor', 'Valor efetivo (R$)', A.num(f.valor), 'inputmode="decimal" required')}
      ${A.sel('bConta', 'Conta / caixa', A.opts(S.config.contas || [], f.conta || (S.config.contas || [])[0]))}${A.inp('bForma', 'Forma (informativo)', f.forma || '', 'list="bFormas" placeholder="Ex.: transferência, dinheiro"')}<datalist id="bFormas">${['Transferência','Dinheiro','Cartão','Depósito','Cheque','Débito automático'].map(x => `<option value="${x}">`).join('')}</datalist>
      ${A.area('bObs', 'Observação', '', 2)}<p class="muted" style="grid-column:1 / -1;margin:0;font-size:12px">Valor diferente do previsto (juros, desconto, pagamento parcial) fica registrado no valor efetivo.</p>
    </div><footer><button type="button" class="btn" data-action="modal-fechar">Cancelar</button><button type="submit" class="btn primary">Confirmar ${rec ? 'recebimento' : 'pagamento'}</button></footer></form>`);
    document.getElementById('fBaixa').addEventListener('submit', async e => { e.preventDefault(); const v = A.cents(A.v('bValor')); if (v <= 0) { A.toast('Informe o valor.'); return; }
      const obs = A.v('bObs'); if (await A.save('fin_lancamentos', Object.assign({}, f, {status: 'pago', pagoEm: A.v('bData'), valorPago: v, conta: A.v('bConta'), forma: A.v('bForma'), obs: obs ? [f.obs, obs].filter(Boolean).join('\n') : f.obs}))) { A.closeModal(); A.toast(rec ? 'Recebimento registrado.' : 'Pagamento registrado.'); } }); });
  A.on('fin-reabrir', async el => { const f = A.byId('fin_lancamentos', el.dataset.id); if (f && await A.save('fin_lancamentos', Object.assign({}, f, {status: 'pendente', pagoEm: '', valorPago: 0}))) { A.closeModal(); A.toast('Lançamento reaberto.'); } });
  A.on('fin-cancelar', async el => { const f = A.byId('fin_lancamentos', el.dataset.id); if (f && await A.save('fin_lancamentos', Object.assign({}, f, {status: 'cancelado'}))) { A.closeModal(); A.toast('Lançamento cancelado.'); } });
  A.on('fin-excluir', el => { const id = el.dataset.id; A.confirm('Excluir lançamento', 'O lançamento será apagado de vez. Para manter o histórico, prefira “Cancelar lançamento”.', 'Excluir', async () => { if (await A.remove('fin_lancamentos', id)) A.toast('Lançamento excluído.'); }); });
  A.on('fin-reembolso', el => { const f = A.byId('fin_lancamentos', el.dataset.id); if (!f) return;
    A.formLancamento(null, {tipo: 'receber', categoria: 'Reembolso de despesas', natureza: 'reembolso', descricao: 'Reembolso: ' + f.descricao, valor: f.valorPago || f.valor, vencimento: P2(A.hoje()), clienteId: f.clienteId, processoId: f.processoId, centroCustoId: f.centroCustoId, reembolsoDe: f.id}); });
  const P2 = d => A.P.proximoUtil(A.P.addDays(d, 10));

  /* ---------- centros de custo ---------- */
  function vCentros() {
    const ed = A.pode('financeiro', 'editar'), ano = A.hoje().slice(0, 4);
    const rows = A.col('centros_custo').slice().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))).map(c => { const l = A.col('fin_lancamentos').filter(f => f.centroCustoId === c.id && f.status === 'pago' && String(f.pagoEm).startsWith(ano));
      const rec = l.filter(f => f.tipo === 'receber').reduce((s, f) => s + f.valorPago, 0), desp = l.filter(f => f.tipo === 'pagar').reduce((s, f) => s + f.valorPago, 0);
      return `<tr${c.ativo === false ? ' class="done"' : ''}><td class="num">${esc(c.codigo)}</td><td><b>${esc(c.nome)}</b>${c.ativo === false ? ' <span class="tag">inativo</span>' : ''}</td><td class="money pos">${A.brl(rec)}</td><td class="money neg">${A.brl(desp)}</td><td class="money ${rec - desp >= 0 ? 'pos' : 'neg'}">${A.brl(rec - desp)}</td>
        <td><div class="rowact">${ed ? `<button class="btn small" data-action="cc-editar" data-id="${esc(c.id)}">Editar</button>` : ''}</div></td></tr>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Centros de custo</h2>${ed ? '<button class="btn primary" data-action="cc-editar">+ Novo centro de custo</button>' : ''}</div>
      <div class="section-body"><p class="muted" style="margin:0">Classifique receitas e despesas por área do escritório. Valores realizados (pagos e recebidos) em ${ano}.</p></div>
      <div class="tablewrap"><table><thead><tr><th>Código</th><th>Centro de custo</th><th class="money">Receitas</th><th class="money">Despesas</th><th class="money">Resultado</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty" style="padding:16px">Nenhum centro de custo.</td></tr>'}</tbody></table></div></section>`;
  }
  A.route('fin-centros', {label: 'Centros de custo', mod: 'financeiro', render: vCentros});
  A.on('cc-editar', el => { const c = A.byId('centros_custo', el.dataset.id) || {codigo: String(A.col('centros_custo').length + 1).padStart(2, '0'), nome: '', ativo: true}; const novo = !c.id;
    A.modal(`${A.modalHead(novo ? 'Novo centro de custo' : 'Editar centro de custo')}<form id="fCc"><div class="body">${A.inp('ccCod', 'Código', c.codigo)}${A.inp('ccNome', 'Nome', c.nome, 'required')}${A.sel('ccAtivo', 'Situação', A.opts([['1','Ativo'],['0','Inativo']], c.ativo === false ? '0' : '1'))}</div>
      <footer>${!novo ? `<button type="button" class="btn danger left" data-action="cc-excluir" data-id="${esc(c.id)}">Excluir</button>` : ''}<button type="button" class="btn" data-action="modal-fechar">Cancelar</button><button type="submit" class="btn primary">Salvar</button></footer></form>`);
    document.getElementById('fCc').addEventListener('submit', async e => { e.preventDefault(); if (await A.save('centros_custo', Object.assign({}, c, {codigo: A.v('ccCod'), nome: A.v('ccNome'), ativo: A.v('ccAtivo') === '1'}))) { A.closeModal(); A.toast('Centro de custo salvo.'); } }); });
  A.on('cc-excluir', el => { const id = el.dataset.id, n = A.col('fin_lancamentos').filter(f => f.centroCustoId === id).length;
    A.confirm('Excluir centro de custo', n ? `Há ${n} lançamento(s) neste centro, que ficarão sem classificação. Prefira marcá-lo como inativo.` : 'O centro de custo será excluído.', 'Excluir', async () => { if (await A.remove('centros_custo', id)) A.toast('Centro de custo excluído.'); }); });
})(window.App);
