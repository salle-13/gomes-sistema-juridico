/* Módulo Relatórios: relatórios gerenciais com prévia na tela e exportação Excel, PDF e CSV. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const ui = () => A.ui('rel', {id: 'dre', de: A.hoje().slice(0, 5) + '01-01', ate: A.hoje(), centro: '', cliente: '', resp: ''});
  const fins = () => A.col('fin_lancamentos').filter(f => f.status !== 'cancelado');
  const noPer = (d, u) => d && d >= u.de && d <= u.ate;
  const filtroFin = (f, u) => (!u.centro || f.centroCustoId === u.centro) && (!u.cliente || f.clienteId === u.cliente);
  const agrupar = (arr, chave, val) => { const m = {}; arr.forEach(x => { const k = chave(x); m[k] = (m[k] || 0) + val(x); }); return m; };
  const nomeCli = id => A.cliente(id)?.nome || '—', nomeCc = id => A.centro(id)?.nome || 'Sem centro de custo';

  const RELS = [
    {id: 'dre', nome: 'Demonstrativo de resultado (caixa)', mod: 'financeiro', desc: 'Receitas e despesas realizadas no período, por categoria.', gerar(u) {
      const l = fins().filter(f => f.status === 'pago' && noPer(f.pagoEm, u) && filtroFin(f, u));
      const r = agrupar(l.filter(f => f.tipo === 'receber'), f => f.categoria, f => f.valorPago), d = agrupar(l.filter(f => f.tipo === 'pagar'), f => f.categoria, f => f.valorPago);
      const tr = Object.values(r).reduce((a, b) => a + b, 0), td = Object.values(d).reduce((a, b) => a + b, 0);
      const linhas = [...Object.entries(r).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({g: 'Receita', c, v})), {g: 'Receita', c: 'Total de receitas', v: tr, b: 1},
        ...Object.entries(d).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({g: 'Despesa', c, v: -v})), {g: 'Despesa', c: 'Total de despesas', v: -td, b: 1}, {g: 'Resultado', c: 'Resultado do período', v: tr - td, b: 1}];
      return {colunas: [{t: 'Grupo', v: x => x.g}, {t: 'Categoria', v: x => x.c}, {t: 'Valor', v: x => x.v, tipo: 'money'}], linhas}; }},
    {id: 'centros', nome: 'Resultado por centro de custo', mod: 'financeiro', desc: 'Receitas, despesas e resultado realizados por centro de custo.', gerar(u) {
      const l = fins().filter(f => f.status === 'pago' && noPer(f.pagoEm, u) && filtroFin(f, u)); const ids = [...new Set(l.map(f => f.centroCustoId || ''))];
      const linhas = ids.map(id => { const x = l.filter(f => (f.centroCustoId || '') === id); const r = x.filter(f => f.tipo === 'receber').reduce((s, f) => s + f.valorPago, 0), d = x.filter(f => f.tipo === 'pagar').reduce((s, f) => s + f.valorPago, 0); return {cc: nomeCc(id), r, d, res: r - d}; }).sort((a, b) => b.res - a.res);
      return {colunas: [{t: 'Centro de custo', v: x => x.cc}, {t: 'Receitas', v: x => x.r, tipo: 'money'}, {t: 'Despesas', v: x => x.d, tipo: 'money'}, {t: 'Resultado', v: x => x.res, tipo: 'money'}], linhas,
        totais: {Receitas: linhas.reduce((s, x) => s + x.r, 0), Despesas: linhas.reduce((s, x) => s + x.d, 0), Resultado: linhas.reduce((s, x) => s + x.res, 0)}}; }},
    {id: 'lanc', nome: 'Lançamentos financeiros', mod: 'financeiro', desc: 'Todos os lançamentos com vencimento ou baixa no período.', gerar(u) {
      const linhas = fins().filter(f => (noPer(f.vencimento, u) || noPer(f.pagoEm, u)) && filtroFin(f, u)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      return {colunas: [{t: 'Tipo', v: f => f.tipo === 'receber' ? 'Receber' : 'Pagar'}, {t: 'Vencimento', v: f => f.vencimento, tipo: 'date'}, {t: 'Descrição', v: f => f.descricao}, {t: 'Categoria', v: f => f.categoria}, {t: 'Cliente', v: f => nomeCli(f.clienteId)},
        {t: 'Centro de custo', v: f => nomeCc(f.centroCustoId)}, {t: 'Situação', v: f => ({pendente: 'Em aberto', pago: 'Baixado', cancelado: 'Cancelado'}[f.status])}, {t: 'Baixa', v: f => f.pagoEm, tipo: 'date'}, {t: 'Valor', v: f => f.tipo === 'pagar' ? -f.valor : f.valor, tipo: 'money'}], linhas,
        totais: {Valor: linhas.reduce((s, f) => s + (f.tipo === 'pagar' ? -f.valor : f.valor), 0)}}; }},
    {id: 'custas', nome: 'Custas e despesas por processo', mod: 'financeiro', desc: 'Custas e despesas processuais do período, com o que é reembolsável pelo cliente.', gerar(u) {
      const l = fins().filter(f => f.tipo === 'pagar' && ['custas', 'despesa_processual'].includes(f.natureza) && noPer(f.vencimento, u) && filtroFin(f, u));
      const reembolsado = id => fins().filter(f => f.reembolsoDe === id && f.status === 'pago').reduce((s, f) => s + f.valorPago, 0);
      const linhas = l.sort((a, b) => (A.processo(a.processoId)?.numero || '').localeCompare(A.processo(b.processoId)?.numero || ''));
      return {colunas: [{t: 'Processo', v: f => A.processo(f.processoId)?.numero || '—'}, {t: 'Cliente', v: f => nomeCli(f.clienteId)}, {t: 'Data', v: f => f.vencimento, tipo: 'date'}, {t: 'Descrição', v: f => f.descricao}, {t: 'Tipo', v: f => f.natureza === 'custas' ? 'Custas' : 'Despesa'},
        {t: 'Situação', v: f => f.status === 'pago' ? 'Paga' : 'Em aberto'}, {t: 'Valor', v: f => f.valor, tipo: 'money'}, {t: 'Reembolsável', v: f => f.reembolsavel ? f.valor : 0, tipo: 'money'}, {t: 'Reembolsado', v: f => reembolsado(f.id), tipo: 'money'}], linhas,
        totais: {Valor: linhas.reduce((s, f) => s + f.valor, 0), 'Reembolsável': linhas.reduce((s, f) => s + (f.reembolsavel ? f.valor : 0), 0), Reembolsado: linhas.reduce((s, f) => s + reembolsado(f.id), 0)}}; }},
    {id: 'inad', nome: 'Inadimplência', mod: 'financeiro', desc: 'Valores a receber vencidos e não baixados (posição de hoje).', gerar(u) {
      const h = A.hoje(), linhas = fins().filter(f => f.tipo === 'receber' && f.status === 'pendente' && f.vencimento < h && filtroFin(f, u)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      return {colunas: [{t: 'Cliente', v: f => nomeCli(f.clienteId)}, {t: 'Descrição', v: f => f.descricao}, {t: 'Vencimento', v: f => f.vencimento, tipo: 'date'}, {t: 'Dias de atraso', v: f => Math.round((P.parse(h) - P.parse(f.vencimento)) / 86400000)}, {t: 'Valor', v: f => f.valor, tipo: 'money'}], linhas,
        totais: {Valor: linhas.reduce((s, f) => s + f.valor, 0)}}; }},
    {id: 'honor', nome: 'Honorários por cliente', mod: 'financeiro', desc: 'Honorários recebidos no período e em aberto, por cliente.', gerar(u) {
      const l = fins().filter(f => f.tipo === 'receber' && f.natureza === 'honorarios' && filtroFin(f, u)); const ids = [...new Set(l.map(f => f.clienteId || ''))];
      const linhas = ids.map(id => { const x = l.filter(f => (f.clienteId || '') === id); return {c: nomeCli(id), rec: x.filter(f => f.status === 'pago' && noPer(f.pagoEm, u)).reduce((s, f) => s + f.valorPago, 0), ab: x.filter(f => f.status === 'pendente').reduce((s, f) => s + f.valor, 0)}; }).filter(x => x.rec || x.ab).sort((a, b) => b.rec - a.rec);
      return {colunas: [{t: 'Cliente', v: x => x.c}, {t: 'Recebido no período', v: x => x.rec, tipo: 'money'}, {t: 'Em aberto', v: x => x.ab, tipo: 'money'}], linhas, totais: {'Recebido no período': linhas.reduce((s, x) => s + x.rec, 0), 'Em aberto': linhas.reduce((s, x) => s + x.ab, 0)}}; }},
    {id: 'prazos', nome: 'Prazos do período', mod: 'prazos', desc: 'Prazos com vencimento no período, por responsável e situação.', gerar(u) {
      const linhas = A.col('prazos').filter(p => noPer(p.vencimento, u) && (!u.resp || p.responsavelId === u.resp) && (!u.cliente || p.clienteId === u.cliente)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      return {colunas: [{t: 'Vencimento', v: p => p.vencimento, tipo: 'date'}, {t: 'Tipo', v: p => p.tipo}, {t: 'Processo', v: p => p.processo}, {t: 'Cliente', v: p => A.cliente(p.clienteId)?.nome || p.cliente || ''}, {t: 'Responsável', v: p => A.membro(p.responsavelId)?.nome || ''}, {t: 'Situação', v: p => A.LABEL_PRAZO[A.sitPrazo(p)]}], linhas}; }},
    {id: 'processos', nome: 'Carteira de processos', mod: 'processos', desc: 'Processos por responsável, área e situação, com prazos em aberto.', gerar(u) {
      const linhas = A.col('processos').filter(p => (!u.resp || p.responsavelId === u.resp) && (!u.cliente || p.clienteId === u.cliente)).sort((a, b) => (A.membro(a.responsavelId)?.nome || '').localeCompare(A.membro(b.responsavelId)?.nome || ''));
      return {colunas: [{t: 'Responsável', v: p => A.membro(p.responsavelId)?.nome || ''}, {t: 'Processo', v: p => p.numero}, {t: 'Cliente', v: p => nomeCli(p.clienteId)}, {t: 'Área', v: p => p.area}, {t: 'Órgão', v: p => [p.vara, p.comarca].filter(Boolean).join(' · ')}, {t: 'Situação', v: p => p.status},
        {t: 'Prazos em aberto', v: p => A.col('prazos').filter(x => x.processoId === p.id && x.status !== 'concluido').length}, {t: 'Valor da causa', v: p => p.valorCausa || 0, tipo: 'money'}], linhas, totais: {'Valor da causa': linhas.reduce((s, p) => s + (p.valorCausa || 0), 0)}}; }},
    {id: 'pubs', nome: 'Publicações do período', mod: 'publicacoes', desc: 'Publicações disponibilizadas no período e como foram tratadas.', gerar(u) {
      const linhas = A.col('publicacoes').filter(p => noPer(p.disponibilizacao, u) && (!u.resp || p.responsavelId === u.resp)).sort((a, b) => a.disponibilizacao.localeCompare(b.disponibilizacao));
      return {colunas: [{t: 'Disponibilização', v: p => p.disponibilizacao, tipo: 'date'}, {t: 'Processo', v: p => p.numeroProcesso}, {t: 'Tipo', v: p => p.tipo}, {t: 'Situação', v: p => A.PUB_LABEL[p.status]}, {t: 'Responsável', v: p => A.membro(p.responsavelId)?.nome || ''}, {t: 'Prazo gerado', v: p => A.byId('prazos', p.prazoId)?.vencimento || '', tipo: 'date'}], linhas}; }},
  ];
  const atual = () => RELS.filter(r => A.pode(r.mod, 'ver')).find(r => r.id === ui().id) || RELS.find(r => A.pode(r.mod, 'ver'));
  A.exportadores.relatorio = () => { const r = atual(), u = ui(), g = r.gerar(u);
    return Object.assign({titulo: r.nome, filtros: `Período ${A.fmt(u.de)} a ${A.fmt(u.ate)}` + (u.centro ? ' · ' + nomeCc(u.centro) : '') + (u.cliente ? ' · ' + nomeCli(u.cliente) : '') + (u.resp ? ' · ' + A.nomeDe(u.resp) : '')}, g); };
  function vRel() {
    const u = ui(), r = atual(); if (!r) return '<section class="panel lock"><h2>Sem relatórios disponíveis para o seu papel.</h2></section>';
    const g = r.gerar(u), fin = r.mod === 'financeiro';
    const cell = (c, x) => { const v = c.v(x); return c.tipo === 'money' ? `<td class="money ${v < 0 ? 'neg' : ''}">${A.brl(v)}</td>` : c.tipo === 'date' ? `<td class="num">${v ? A.fmt(v) : '—'}</td>` : `<td>${esc(v)}</td>`; };
    return `<section class="panel"><div class="vhead"><h2>Relatórios</h2>${A.botoesExport('relatorio')}</div>
      <div class="filters"><select id="rlId" data-ui="rel.id" aria-label="Relatório">${A.opts(RELS.filter(x => A.pode(x.mod, 'ver')).map(x => [x.id, x.nome]), r.id)}</select>
        <label class="muted" for="rlDe" style="font-size:12px">De</label><input id="rlDe" type="date" data-ui="rel.de" value="${esc(u.de)}"><label class="muted" for="rlAte" style="font-size:12px">até</label><input id="rlAte" type="date" data-ui="rel.ate" value="${esc(u.ate)}">
        ${fin ? `<select id="rlCc" data-ui="rel.centro">${A.opts(A.col('centros_custo').map(c => [c.id, c.codigo + ' · ' + c.nome]), u.centro, 'Todos os centros de custo')}</select>` : `<select id="rlResp" data-ui="rel.resp">${A.optsEquipe(u.resp, 'Todos os responsáveis')}</select>`}
        <select id="rlCli" data-ui="rel.cliente">${A.optsClientes(u.cliente, 'Todos os clientes')}</select></div>
      <div class="section-body"><p class="muted" style="margin:0">${esc(r.desc)} ${g.linhas.length} linha(s).</p></div>
      <div class="tablewrap"><table><thead><tr>${g.colunas.map(c => `<th class="${c.tipo === 'money' ? 'money' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>
        <tbody>${g.linhas.map(x => `<tr${x.b ? ' style="font-weight:600;background:var(--bg)"' : ''}>${g.colunas.map(c => cell(c, x)).join('')}</tr>`).join('') || `<tr><td colspan="${g.colunas.length}" class="empty" style="padding:16px">Sem dados no período.</td></tr>`}</tbody>
        ${g.totais ? `<tfoot class="tfoot"><tr>${g.colunas.map((c, i) => `<td class="${c.tipo === 'money' ? 'money' : ''}">${g.totais[c.t] != null ? A.brl(g.totais[c.t]) : i === 0 ? 'Total' : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div></section>`;
  }
  A.route('relatorios', {label: 'Relatórios', mod: 'relatorios', render: vRel});
})(window.App);
