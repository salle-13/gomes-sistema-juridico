/* Módulo Financeiro (parte 2): dashboard financeiro e fluxo de caixa (realizado e projetado). */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const fins = () => A.col('fin_lancamentos').filter(f => f.status !== 'cancelado');
  const realizados = (de, ate, conta) => fins().filter(f => f.status === 'pago' && f.pagoEm >= de && f.pagoEm <= ate && (!conta || f.conta === conta));
  const soma = (arr, campo) => arr.reduce((s, f) => s + (f[campo] || 0), 0);
  const ent = arr => soma(arr.filter(f => f.tipo === 'receber'), 'valorPago'), sai = arr => soma(arr.filter(f => f.tipo === 'pagar'), 'valorPago');
  const fimMes = ym => { const [y, m] = ym.split('-').map(Number); return P.ymd(new Date(y, m, 0)); };
  /* saldo realizado ao FINAL do dia 'ate' */
  A.saldoAte = function (ate, conta) {
    const contas = conta ? [conta] : (S.config.contas || []); let s = 0;
    for (const c of contas) { const si = (S.config.saldosIniciais || {})[c]; const ini = si && si.data ? si.data : '0000-01-01'; if (si && si.data <= ate) s += si.valor || 0;
      const mov = fins().filter(f => f.status === 'pago' && f.conta === c && f.pagoEm >= ini && f.pagoEm <= ate); s += ent(mov) - sai(mov); }
    if (!conta) { const sem = fins().filter(f => f.status === 'pago' && !contas.includes(f.conta) && f.pagoEm <= ate); s += ent(sem) - sai(sem); }
    return s;
  };

  /* ---------- dashboard ---------- */
  function vDash() {
    const u = A.ui('findash', {ym: A.hoje().slice(0, 7)}), h = A.hoje(), ini = u.ym + '-01', fim = fimMes(u.ym);
    const mesR = realizados(ini, fim), rec = ent(mesR), pag = sai(mesR);
    const abertos = fins().filter(f => f.status === 'pendente');
    const aRec = soma(abertos.filter(f => f.tipo === 'receber' && f.vencimento >= ini && f.vencimento <= fim), 'valor'), aPag = soma(abertos.filter(f => f.tipo === 'pagar' && f.vencimento >= ini && f.vencimento <= fim), 'valor');
    const inad = abertos.filter(f => f.tipo === 'receber' && f.vencimento < h), pagVenc = abertos.filter(f => f.tipo === 'pagar' && f.vencimento < h);
    const meses = []; for (let i = 11; i >= 0; i--) meses.push(A.addMonths(ini, -i).slice(0, 7));
    const serieR = meses.map(m => ent(realizados(m + '-01', fimMes(m)))), serieP = meses.map(m => sai(realizados(m + '-01', fimMes(m))));
    const porCat = {}; mesR.filter(f => f.tipo === 'pagar').forEach(f => porCat[f.categoria] = (porCat[f.categoria] || 0) + f.valorPago);
    const porCc = {}; mesR.forEach(f => { const k = A.centro(f.centroCustoId)?.nome || 'Sem centro de custo'; porCc[k] = (porCc[k] || 0) + (f.tipo === 'pagar' ? f.valorPago : 0); });
    const hon = {}; fins().filter(f => f.tipo === 'receber' && f.status === 'pago' && f.pagoEm >= meses[0] + '-01' && f.pagoEm <= fim).forEach(f => { const k = A.cliente(f.clienteId)?.nome || 'Sem cliente'; hon[k] = (hon[k] || 0) + f.valorPago; });
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, valor]) => ({nome, valor}));
    const prox = abertos.filter(f => f.vencimento >= h && f.vencimento <= P.addDays(h, 7)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const linhaVenc = f => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:4px 0;border-bottom:1px dashed var(--line)"><span><b class="num">${esc(A.fmt(f.vencimento).slice(0, 5))}</b> · ${esc(f.descricao)}</span><span class="num ${f.tipo === 'receber' ? 'pos' : 'neg'}">${f.tipo === 'receber' ? '+' : '−'} ${A.brl(f.valor)}</span></div>`;
    const ymOpts = []; for (let i = -12; i <= 3; i++) { const m = A.addMonths(A.hoje().slice(0, 8) + '01', i).slice(0, 7); ymOpts.push([m, A.MESES[Number(m.slice(5)) - 1] + ' de ' + m.slice(0, 4)]); }
    return `<section class="panel"><div class="vhead"><h2>Dashboard financeiro</h2><select id="fdYm" data-ui="findash.ym" aria-label="Mês">${A.opts(ymOpts, u.ym)}</select></div>
      <div class="kpis">
        <div class="kpi" style="--c:var(--ok)"><span>Recebido no mês</span><strong>${A.brl(rec)}</strong><small>${A.brl(aRec)} ainda a receber no mês</small></div>
        <div class="kpi" style="--c:var(--danger)"><span>Pago no mês</span><strong>${A.brl(pag)}</strong><small>${A.brl(aPag)} ainda a pagar no mês</small></div>
        <div class="kpi" style="--c:${rec - pag >= 0 ? 'var(--ok)' : 'var(--danger)'}"><span>Resultado do mês (realizado)</span><strong class="${rec - pag >= 0 ? 'pos' : 'neg'}">${A.brl(rec - pag)}</strong><small>Previsto: ${A.brl(rec + aRec - pag - aPag)}</small></div>
        <div class="kpi"><span>Saldo atual nas contas</span><strong>${A.brl(A.saldoAte(h))}</strong><small>${(S.config.contas || []).map(c => esc(c) + ': ' + A.brl(A.saldoAte(h, c))).join(' · ')}</small></div>
        <div class="kpi" style="--c:var(--warn)"><span>Inadimplência</span><strong>${A.brl(soma(inad, 'valor'))}</strong><small>${inad.length} recebimento(s) em atraso</small></div>
        <div class="kpi" style="--c:var(--danger)"><span>Contas a pagar vencidas</span><strong>${A.brl(soma(pagVenc, 'valor'))}</strong><small>${pagVenc.length} conta(s)</small></div>
      </div>
      <div class="grid2"><div class="card"><h3>Receitas e despesas realizadas · últimos 12 meses</h3>${A.chartBarras({labels: meses.map(A.ymLabel), series: [{nome: 'Receitas', cor: '#2C7A4D', valores: serieR}, {nome: 'Despesas', cor: '#B8322A', valores: serieP}], linha: {nome: 'Resultado', cor: '#273884', valores: serieR.map((v, i) => v - serieP[i])}})}</div>
        <div class="card"><h3>Próximos 7 dias</h3>${prox.map(linhaVenc).join('') || '<span class="muted">Nada vence nos próximos 7 dias.</span>'}
          ${inad.length ? `<h3 style="margin-top:14px">Recebimentos em atraso</h3>${inad.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6).map(f => linhaVenc(f).replace('</span><span', ' · ' + esc(A.cliente(f.clienteId)?.nome || '') + '</span><span')).join('')}` : ''}</div>
        <div class="card"><h3>Despesas do mês por categoria</h3>${A.chartHBar(top(porCat).map(i => Object.assign(i, {cor: '#B8322A'})))}</div>
        <div class="card"><h3>Despesas do mês por centro de custo</h3>${A.chartHBar(top(porCc).filter(i => i.valor).map(i => Object.assign(i, {cor: '#273884'})))}</div>
        <div class="card"><h3>Honorários recebidos por cliente · 12 meses</h3>${A.chartHBar(top(hon).map(i => Object.assign(i, {cor: '#2C7A4D'})))}</div>
      </div></section>`;
  }
  A.route('fin', {label: 'Dashboard financeiro', mod: 'financeiro', render: vDash});

  /* ---------- fluxo de caixa ---------- */
  const uiF = () => A.ui('fluxo', {de: A.hoje().slice(0, 8) + '01', ate: fimMes(A.addMonths(A.hoje().slice(0, 8) + '01', 2).slice(0, 7)), conta: '', modo: 'mensal'});
  function calcFluxo() {
    const u = uiF(), h = A.hoje(), de = u.de, ate = u.ate < de ? de : u.ate;
    const saldoIni = A.saldoAte(P.addDays(de, -1), u.conta);
    const chave = d => u.modo === 'mensal' ? d.slice(0, 7) : d;
    const grupos = []; let d = de; const seen = new Set();
    while (d <= ate) { const k = chave(d); if (!seen.has(k)) { seen.add(k); grupos.push(k); } d = u.modo === 'mensal' ? A.addMonths(d.slice(0, 8) + '01', 1) : P.addDays(d, 1); }
    const real = realizados(de, ate, u.conta), prev = fins().filter(f => f.status === 'pendente' && f.vencimento >= h && f.vencimento >= de && f.vencimento <= ate && (!u.conta || f.conta === u.conta));
    let sr = saldoIni, sp = saldoIni;
    const linhas = grupos.map(k => { const r = real.filter(f => chave(f.pagoEm) === k), p = prev.filter(f => chave(f.vencimento) === k);
      const er = ent(r), sr_ = sai(r), ep = soma(p.filter(f => f.tipo === 'receber'), 'valor'), spv = soma(p.filter(f => f.tipo === 'pagar'), 'valor');
      sr += er - sr_; sp += er - sr_ + ep - spv; return {k, er, sr: sr_, ep, sp: spv, saldoReal: sr, saldoProj: sp}; });
    const atrasoR = soma(fins().filter(f => f.status === 'pendente' && f.tipo === 'receber' && f.vencimento < h && (!u.conta || f.conta === u.conta)), 'valor');
    const atrasoP = soma(fins().filter(f => f.status === 'pendente' && f.tipo === 'pagar' && f.vencimento < h && (!u.conta || f.conta === u.conta)), 'valor');
    return {saldoIni, linhas, atrasoR, atrasoP};
  }
  const rotulo = k => k.length === 7 ? A.MESES[Number(k.slice(5)) - 1] + '/' + k.slice(0, 4) : A.fmtCurto(k);
  A.exportadores.fluxo = () => { const f = calcFluxo(), u = uiF();
    return {titulo: 'Fluxo de caixa', filtros: `${A.fmt(u.de)} a ${A.fmt(u.ate)} · ${u.conta || 'todas as contas'} · saldo inicial ${A.brl(f.saldoIni)}`, linhas: f.linhas,
      colunas: [{t:'Período', v:l => rotulo(l.k)}, {t:'Entradas realizadas', v:l => l.er, tipo:'money'}, {t:'Saídas realizadas', v:l => l.sr, tipo:'money'}, {t:'Entradas previstas', v:l => l.ep, tipo:'money'},
        {t:'Saídas previstas', v:l => l.sp, tipo:'money'}, {t:'Saldo realizado', v:l => l.saldoReal, tipo:'money'}, {t:'Saldo projetado', v:l => l.saldoProj, tipo:'money'}]}; };
  function vFluxo() {
    const u = uiF(), f = calcFluxo(), L = f.linhas;
    const rows = L.map(l => `<tr><td>${esc(rotulo(l.k))}</td><td class="money pos">${l.er ? A.brl(l.er) : '—'}</td><td class="money neg">${l.sr ? A.brl(l.sr) : '—'}</td><td class="money pos" style="opacity:.75">${l.ep ? A.brl(l.ep) : '—'}</td><td class="money neg" style="opacity:.75">${l.sp ? A.brl(l.sp) : '—'}</td>
      <td class="money"><b>${A.brl(l.saldoReal)}</b></td><td class="money ${l.saldoProj < 0 ? 'neg' : ''}"><b>${A.brl(l.saldoProj)}</b></td></tr>`).join('');
    const tot = k => L.reduce((s, l) => s + l[k], 0);
    const grafico = L.length <= 24 ? A.chartBarras({labels: L.map(l => l.k.length === 7 ? A.ymLabel(l.k) : l.k.slice(8)), series: [{nome: 'Entradas (real + previsto)', cor: '#2C7A4D', valores: L.map(l => l.er + l.ep)}, {nome: 'Saídas (real + previsto)', cor: '#B8322A', valores: L.map(l => l.sr + l.sp)}], linha: {nome: 'Saldo projetado', cor: '#273884', valores: L.map(l => l.saldoProj)}}) : '<span class="muted">Reduza o período para ver o gráfico.</span>';
    return `<section class="panel"><div class="vhead"><h2>Fluxo de caixa</h2>${A.botoesExport('fluxo')}</div>
      <div class="filters"><label class="muted" for="flDe" style="font-size:12px">De</label><input id="flDe" type="date" data-ui="fluxo.de" value="${esc(u.de)}"><label class="muted" for="flAte" style="font-size:12px">até</label><input id="flAte" type="date" data-ui="fluxo.ate" value="${esc(u.ate)}">
        <select id="flConta" data-ui="fluxo.conta">${A.opts(S.config.contas || [], u.conta, 'Todas as contas')}</select><div class="subtabs">${[['mensal','Mensal'],['diario','Diário']].map(([k, l]) => `<button data-action="fl-modo" data-v="${k}" aria-pressed="${u.modo === k}">${l}</button>`).join('')}</div></div>
      <div class="kpis"><div class="kpi"><span>Saldo no início do período</span><strong>${A.brl(f.saldoIni)}</strong></div><div class="kpi" style="--c:var(--ok)"><span>Entradas (realizadas + previstas)</span><strong>${A.brl(tot('er') + tot('ep'))}</strong></div>
        <div class="kpi" style="--c:var(--danger)"><span>Saídas (realizadas + previstas)</span><strong>${A.brl(tot('sr') + tot('sp'))}</strong></div><div class="kpi"><span>Saldo projetado no fim</span><strong class="${(L.at(-1)?.saldoProj ?? f.saldoIni) < 0 ? 'neg' : ''}">${A.brl(L.at(-1)?.saldoProj ?? f.saldoIni)}</strong></div>
        <div class="kpi" style="--c:var(--warn)"><span>Fora da projeção (em atraso)</span><strong>${A.brl(f.atrasoR - f.atrasoP)}</strong><small>${A.brl(f.atrasoR)} a receber · ${A.brl(f.atrasoP)} a pagar</small></div></div>
      <div class="grid2" style="grid-template-columns:1fr"><div class="card">${grafico}</div></div>
      <div class="tablewrap"><table><thead><tr><th>Período</th><th class="money">Entradas realizadas</th><th class="money">Saídas realizadas</th><th class="money">Entradas previstas</th><th class="money">Saídas previstas</th><th class="money">Saldo realizado</th><th class="money">Saldo projetado</th></tr></thead>
        <tbody>${rows}</tbody><tfoot class="tfoot"><tr><td>Total</td><td class="money">${A.brl(tot('er'))}</td><td class="money">${A.brl(tot('sr'))}</td><td class="money">${A.brl(tot('ep'))}</td><td class="money">${A.brl(tot('sp'))}</td><td></td><td></td></tr></tfoot></table></div>
      <div class="legend">Realizado considera a data e o valor efetivos das baixas manuais. Previsto considera lançamentos em aberto com vencimento a partir de hoje; os atrasados ficam fora da projeção até serem baixados ou reprogramados.</div></section>`;
  }
  A.route('fin-fluxo', {label: 'Fluxo de caixa', mod: 'financeiro', render: vFluxo});
  A.on('fl-modo', el => { uiF().modo = el.dataset.v; A.render(); });
})(window.App);
