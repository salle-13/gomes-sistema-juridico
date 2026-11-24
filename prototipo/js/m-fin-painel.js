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

  /* ---------- dashboard ----------
     Um gráfico por vez. Cada gráfico (GRAFICOS) devolve um conjunto genérico
     {labels, series:[{nome, cor, valores}], linha?} + destaque e leitura rápida;
     um único renderizador (desenhar) o mostra em qualquer formato (FORMATOS). */
  const COR = {ok: '#2C7A4D', danger: '#B8322A', accent: '#273884', warn: '#C0620F'};
  const PALETA = ['#273884', '#2C7A4D', '#C0620F', '#957300', '#B8322A', '#2B7A8C', '#7A4C9C', '#8893A3'];
  const FORMATOS = [['barras', 'Barras'], ['hbarras', 'Barras horizontais'], ['linhas', 'Linhas'], ['area', 'Área'], ['rosca', 'Rosca'], ['tabela', 'Tabela']];
  const ICO_FMT = {
    barras: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V9"/>',
    hbarras: '<path d="M4 5h11M4 10h16M4 15h7M4 20h13"/>',
    linhas: '<path d="M3 17l5-6 4 3 4-7 5 4"/>',
    area: '<path d="M3 20v-4l5-6 4 3 4-7 5 4v10z" fill="currentColor" fill-opacity=".25"/>',
    rosca: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v4.5M19.5 15l-4.2-1.5"/>',
    tabela: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
  };
  const icoFmt = (f, t) => `<svg class="fd-ico" width="${t || 16}" height="${t || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO_FMT[f] || ''}</svg>`;
  const pct = (v, t) => t ? Math.round(v / t * 100) : 0;
  const diasEntre = (de, ate) => Math.round((P.parse(ate) - P.parse(de)) / 864e5);
  const ddmm = d => A.fmt(d).slice(0, 5);
  /* maiores N + "Outros" (para que rosca e tabela somem o total certo) */
  function maiores(obj, n, rotOutros) {
    const ord = Object.entries(obj).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
    const top = ord.slice(0, n), resto = ord.slice(n).reduce((s, [, v]) => s + v, 0);
    if (resto) top.push([rotOutros || 'Outros', resto]);
    return top;
  }

  /* Cálculos do mês escolhido — os mesmos de antes (realizados, A.saldoAte), só reunidos. */
  function calcDash(ym) {
    const h = A.hoje(), ini = ym + '-01', fim = fimMes(ym);
    const mesR = realizados(ini, fim), rec = ent(mesR), pag = sai(mesR);
    const abertos = fins().filter(f => f.status === 'pendente');
    const aRec = soma(abertos.filter(f => f.tipo === 'receber' && f.vencimento >= ini && f.vencimento <= fim), 'valor'), aPag = soma(abertos.filter(f => f.tipo === 'pagar' && f.vencimento >= ini && f.vencimento <= fim), 'valor');
    const inad = abertos.filter(f => f.tipo === 'receber' && f.vencimento < h), pagVenc = abertos.filter(f => f.tipo === 'pagar' && f.vencimento < h);
    const meses = []; for (let i = 11; i >= 0; i--) meses.push(A.addMonths(ini, -i).slice(0, 7));
    const serieR = meses.map(m => ent(realizados(m + '-01', fimMes(m)))), serieP = meses.map(m => sai(realizados(m + '-01', fimMes(m))));
    const porCat = {}; mesR.filter(f => f.tipo === 'pagar').forEach(f => porCat[f.categoria] = (porCat[f.categoria] || 0) + f.valorPago);
    const porCc = {}; mesR.forEach(f => { const k = A.centro(f.centroCustoId)?.nome || 'Sem centro de custo'; porCc[k] = (porCc[k] || 0) + (f.tipo === 'pagar' ? f.valorPago : 0); });
    const hon = {}; fins().filter(f => f.tipo === 'receber' && f.status === 'pago' && f.pagoEm >= meses[0] + '-01' && f.pagoEm <= fim).forEach(f => { const k = A.cliente(f.clienteId)?.nome || 'Sem cliente'; hon[k] = (hon[k] || 0) + f.valorPago; });
    const prox = abertos.filter(f => f.vencimento >= h && f.vencimento <= P.addDays(h, 7)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return {h, ini, fim, ym, rec, pag, aRec, aPag, inad, pagVenc, meses, serieR, serieP, porCat, porCc, hon, prox};
  }
  const nomeMes = ym => A.MESES[Number(ym.slice(5)) - 1] + ' de ' + ym.slice(0, 4);

  const GRAFICOS = [
    {id: 'rxd', titulo: 'Receitas x despesas', sub: '12 meses', formato: 'barras', dados(c) {
      const res = c.serieR.map((v, i) => v - c.serieP[i]), total = res.reduce((s, v) => s + v, 0);
      const positivos = res.filter(v => v > 0).length, melhor = res.indexOf(Math.max(...res));
      return {periodo: `Realizado · ${A.ymLabel(c.meses[0])} a ${A.ymLabel(c.meses[11])}`, labels: c.meses.map(A.ymLabel), dicas: c.meses.map(m => nomeMes(m)),
        series: [{nome: 'Receitas', cor: COR.ok, valores: c.serieR}, {nome: 'Despesas', cor: COR.danger, valores: c.serieP}], linha: {nome: 'Resultado', cor: COR.accent, valores: res},
        destaque: {rotulo: 'Resultado acumulado em 12 meses', valor: total, sinal: true, sub: `${A.brl(c.serieR.reduce((s, v) => s + v, 0))} recebidos · ${A.brl(c.serieP.reduce((s, v) => s + v, 0))} pagos`},
        leitura: `Em ${positivos} de 12 meses as receitas superaram as despesas; o melhor resultado foi em ${nomeMes(c.meses[melhor])} (${A.brl(res[melhor])}).`}; }},
    {id: 'resultado', titulo: 'Resultado do mês', sub: 'recebido x pago', formato: 'barras', dados(c) {
      const real = c.rec - c.pag, prev = c.rec + c.aRec - c.pag - c.aPag;
      return {periodo: nomeMes(c.ym), labels: ['Realizado', 'Em aberto'],
        series: [{nome: 'Recebido', cor: COR.ok, valores: [c.rec, c.aRec]}, {nome: 'Pago', cor: COR.danger, valores: [c.pag, c.aPag]}],
        destaque: {rotulo: 'Resultado realizado no mês', valor: real, sinal: true, sub: `Previsto, com o que está em aberto: ${A.brl(prev)}`},
        leitura: real >= 0 ? `O mês está positivo em ${A.brl(real)}; somando o que está em aberto, deve fechar em ${A.brl(prev)}.`
          : `As saídas superam as entradas em ${A.brl(-real)}; ainda há ${A.brl(c.aRec)} a receber no mês.`}; }},
    {id: 'saldo', titulo: 'Saldo por conta', sub: 'hoje', formato: 'hbarras', dados(c) {
      const contas = S.config.contas || [], vals = contas.map(k => A.saldoAte(c.h, k)), total = A.saldoAte(c.h);
      const labels = contas.slice(), sem = total - vals.reduce((s, v) => s + v, 0); if (sem) { labels.push('Sem conta informada'); vals.push(sem); }
      const neg = labels.find((l, i) => vals[i] < 0), maior = vals.indexOf(Math.max(...vals));
      return {periodo: 'Hoje, ' + A.fmt(c.h), labels, series: [{nome: 'Saldo', cor: COR.accent, valores: vals}],
        destaque: {rotulo: 'Saldo atual nas contas', valor: total, sinal: true, sub: `${labels.length} conta(s)`},
        leitura: neg ? `${neg} está negativa em ${A.brl(-vals[labels.indexOf(neg)])}.` : labels.length ? `${labels[maior]} concentra ${pct(vals[maior], total)}% do saldo.` : ''}; }},
    {id: 'prox7', titulo: 'Próximos 7 dias', sub: 'entradas x saídas', formato: 'barras', dados(c) {
      const dias = []; for (let i = 0; i <= 7; i++) dias.push(P.addDays(c.h, i));
      const e = dias.map(d => soma(c.prox.filter(f => f.vencimento === d && f.tipo === 'receber'), 'valor')), s_ = dias.map(d => soma(c.prox.filter(f => f.vencimento === d && f.tipo === 'pagar'), 'valor'));
      const te = e.reduce((a, v) => a + v, 0), ts = s_.reduce((a, v) => a + v, 0);
      const maiorSai = c.prox.filter(f => f.tipo === 'pagar').sort((a, b) => b.valor - a.valor)[0], maiorEnt = c.prox.filter(f => f.tipo === 'receber').sort((a, b) => b.valor - a.valor)[0];
      return {periodo: `${ddmm(dias[0])} a ${ddmm(dias[7])} · em aberto`, labels: dias.map(d => d === c.h ? 'hoje' : ddmm(d)), dicas: dias.map(A.fmtCurto),
        series: [{nome: 'Entradas', cor: COR.ok, valores: e}, {nome: 'Saídas', cor: COR.danger, valores: s_}],
        destaque: {rotulo: 'Saldo dos vencimentos', valor: te - ts, sinal: true, sub: `${A.brl(te)} a receber · ${A.brl(ts)} a pagar`},
        leitura: maiorSai ? `${c.prox.length} vencimento(s) na semana; a maior saída é ${maiorSai.descricao}, de ${A.brl(maiorSai.valor)}, em ${ddmm(maiorSai.vencimento)}.`
          : maiorEnt ? `Só há entradas previstas; a maior é ${maiorEnt.descricao}, de ${A.brl(maiorEnt.valor)}, em ${ddmm(maiorEnt.vencimento)}.` : '',
        vazio: 'Nada vence nos próximos 7 dias.'}; }},
    {id: 'inad', titulo: 'Inadimplência', sub: 'por faixa de atraso', formato: 'barras', dados(c) {
      const faixas = [['Até 30 dias', 0, 30], ['31–60 dias', 31, 60], ['61–90 dias', 61, 90], ['+90 dias', 91, Infinity]];
      const vals = faixas.map(([, a, b]) => soma(c.inad.filter(f => { const d = diasEntre(f.vencimento, c.h); return d >= a && d <= b; }), 'valor'));
      const total = vals.reduce((s, v) => s + v, 0), mi = vals.indexOf(Math.max(...vals));
      const porCli = {}; c.inad.forEach(f => { const k = A.cliente(f.clienteId)?.nome || 'Sem cliente'; porCli[k] = (porCli[k] || 0) + f.valor; });
      const dev = maiores(porCli, 1)[0];
      return {periodo: 'Recebimentos em atraso hoje', labels: faixas.map(f => f[0]), series: [{nome: 'Em atraso', cor: COR.warn, valores: vals}],
        destaque: {rotulo: 'Total em atraso', valor: total, tom: total ? 'warn' : 'pos', sub: `${c.inad.length} recebimento(s) em atraso`},
        leitura: total ? `A faixa "${faixas[mi][0]}" concentra ${pct(vals[mi], total)}% do valor em atraso; o maior devedor é ${dev[0]}, com ${A.brl(dev[1])}.` : 'Nenhum recebimento em atraso.', vazio: 'Nenhum recebimento em atraso.'}; }},
    {id: 'pagvenc', titulo: 'Contas a pagar vencidas', sub: 'por conta', formato: 'hbarras', dados(c) {
      const ord = c.pagVenc.slice().sort((a, b) => b.valor - a.valor), top = ord.slice(0, 7), resto = soma(ord.slice(7), 'valor');
      const labels = top.map(f => `${f.descricao} (${ddmm(f.vencimento)})`), vals = top.map(f => f.valor); if (resto) { labels.push(`Outras ${ord.length - 7}`); vals.push(resto); }
      const antiga = c.pagVenc.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0], total = soma(c.pagVenc, 'valor');
      return {periodo: 'Em aberto com vencimento anterior a hoje', labels, series: [{nome: 'Valor', cor: COR.danger, valores: vals}],
        destaque: {rotulo: 'Contas a pagar vencidas', valor: total, tom: total ? 'neg' : 'pos', sub: `${c.pagVenc.length} conta(s)`},
        leitura: antiga ? `A mais antiga, ${antiga.descricao}, de ${A.brl(antiga.valor)}, venceu há ${diasEntre(antiga.vencimento, c.h)} dia(s).` : 'Nenhuma conta a pagar vencida.', vazio: 'Nenhuma conta a pagar vencida.'}; }},
    {id: 'cat', titulo: 'Despesas por categoria', sub: 'no mês', formato: 'rosca', dados(c) {
      const it = maiores(c.porCat, 6, 'Outras categorias'), total = it.reduce((s, [, v]) => s + v, 0);
      return {periodo: 'Pagas em ' + nomeMes(c.ym), labels: it.map(i => i[0] || 'Sem categoria'), series: [{nome: 'Despesas', cor: COR.danger, valores: it.map(i => i[1])}],
        destaque: {rotulo: 'Despesas pagas no mês', valor: total, tom: total ? 'neg' : '', sub: `${it.length} categoria(s)`},
        leitura: it.length ? `${it[0][0] || 'Sem categoria'} concentra ${pct(it[0][1], total)}% das despesas do mês.` : '', vazio: 'Nenhuma despesa paga neste mês.'}; }},
    {id: 'cc', titulo: 'Despesas por centro de custo', sub: 'no mês', formato: 'hbarras', dados(c) {
      const it = maiores(c.porCc, 6, 'Outros centros'), total = it.reduce((s, [, v]) => s + v, 0);
      return {periodo: 'Pagas em ' + nomeMes(c.ym), labels: it.map(i => i[0]), series: [{nome: 'Despesas', cor: COR.accent, valores: it.map(i => i[1])}],
        destaque: {rotulo: 'Despesas pagas no mês', valor: total, tom: total ? 'neg' : '', sub: `${it.length} centro(s) de custo`},
        leitura: it.length ? `${it[0][0]} concentra ${pct(it[0][1], total)}% das despesas do mês.` : '', vazio: 'Nenhuma despesa paga neste mês.'}; }},
    {id: 'hon', titulo: 'Honorários por cliente', sub: '12 meses', formato: 'hbarras', dados(c) {
      const it = maiores(c.hon, 7, 'Outros clientes'), total = it.reduce((s, [, v]) => s + v, 0), n = Object.keys(c.hon).length;
      return {periodo: `Recebidos de ${A.ymLabel(c.meses[0])} a ${A.ymLabel(c.meses[11])}`, labels: it.map(i => i[0]), series: [{nome: 'Honorários', cor: COR.ok, valores: it.map(i => i[1])}],
        destaque: {rotulo: 'Honorários recebidos em 12 meses', valor: total, tom: total ? 'pos' : '', sub: `${n} cliente(s)`},
        leitura: it.length ? `${it[0][0]} responde por ${pct(it[0][1], total)}% dos honorários recebidos no período.` : '', vazio: 'Nenhum honorário recebido nos últimos 12 meses.'}; }},
  ];
  const grafico = id => GRAFICOS.find(g => g.id === id) || GRAFICOS[0];

  /* ---------- renderizador genérico ---------- */
  const abrev = c => { const v = Math.abs(c) / 100; return (c < 0 ? '-' : '') + (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : Math.round(v)); };
  const abrevFino = c => { const v = c / 100; return v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 && v < 1e5 ? (v / 1e3).toFixed(1).replace('.', ',').replace(',0', '') + ' mil' : abrev(c); };
  function escala(max) { if (max <= 0) return [0, 1]; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = [1, 2, 2.5, 5, 10].find(k => k * p * 4 >= max) * p; return [n, Math.ceil(max / n) * n]; }
  const corta = (t, n) => (t = String(t)).length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t;
  const legenda = itens => `<div class="chart-legend">${itens.map(s => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
  const dica = (d, i) => (d.dicas || d.labels)[i];

  /* eixos + grade comuns às linhas e à área */
  function eixos(d, W, H) {
    const L = 54, R = 14, T = 12, B = 28, w = W - L - R, h = H - T - B;
    const todos = d.series.flatMap(s => s.valores).concat(d.linha ? d.linha.valores : []);
    // passo único para a parte positiva e a negativa, para que as linhas de grade caiam em valores redondos a partir do zero
    const maxV = Math.max(0, ...todos), minV = Math.min(0, ...todos), passo = escala(Math.max(1, maxV - minV))[0];
    const topo = Math.max(passo, Math.ceil(maxV / passo) * passo), fundo = -Math.ceil(-minV / passo) * passo;
    const n = d.labels.length, gw = w / n, x = i => L + (i + .5) * gw, y = v => T + h - (v - fundo) / (topo - fundo) * h;
    let g = '';
    for (let v = fundo; v <= topo; v += passo) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${abrev(v)}</text>`;
    if (fundo < 0) g += `<line class="fd-zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    const maxCh = Math.max(3, Math.floor(gw / 6.5)), pulo = n > 12 ? Math.ceil(n / 12) : 1;
    d.labels.forEach((lb, i) => { if (i % pulo === 0) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(corta(lb, maxCh))}</text>`; });
    return {g, x, y};
  }
  function svgLinhas(d, area) {
    const W = 640, H = 260, {g, x, y} = eixos(d, W, H); let out = g;
    const traco = (s, tracejado) => { const pts = s.valores.map((v, i) => `${x(i).toFixed(1)},${y(v || 0).toFixed(1)}`);
      let r = '';
      if (area) r += `<path class="fd-area${tracejado ? ' fd-area-linha' : ''}" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(s.valores.length - 1)},${y(0)} Z" style="fill:${s.cor}"/>`;
      r += `<polyline class="fd-traco"${tracejado ? ' stroke-dasharray="5 4"' : ' pathLength="1"'} points="${pts.join(' ')}" style="stroke:${s.cor}"/>`;
      r += s.valores.map((v, i) => `<circle cx="${x(i)}" cy="${y(v || 0)}" r="3.5" style="fill:${s.cor}"><title>${esc(s.nome)} · ${esc(dica(d, i))}: ${A.brl(v || 0)}</title></circle>`).join('');
      return r; };
    d.series.forEach(s => out += traco(s));
    if (d.linha) out += traco(d.linha, true);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ${area ? 'área' : 'linhas'}">${out}</svg>${legenda(d.series.concat(d.linha ? [d.linha] : []))}</div>`;
  }
  function svgRosca(d) {
    let itens;
    // uma série: uma fatia por rótulo; várias séries: uma fatia com o total de cada série
    if (d.series.length === 1) itens = d.labels.map((lb, i) => ({nome: lb, cor: PALETA[i % PALETA.length], valor: d.series[0].valores[i] || 0}));
    else itens = d.series.map(s => ({nome: s.nome, cor: s.cor, valor: s.valores.reduce((a, v) => a + (v || 0), 0)}));
    const ignorados = itens.filter(i => i.valor < 0).length; itens = itens.filter(i => i.valor > 0);
    const total = itens.reduce((s, i) => s + i.valor, 0);
    if (!total) return vazio('Não há valores positivos para mostrar em rosca.', 'Experimente o formato Barras ou Tabela.');
    const R = 80, C = 2 * Math.PI * R; let acc = 0;
    const arcos = itens.map(i => { const len = i.valor / total * C, r = `<circle class="fd-fatia" r="${R}" cx="110" cy="110" style="stroke:${i.cor}" stroke-dasharray="${Math.max(0, len - (itens.length > 1 ? 2 : 0)).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 110 110)"><title>${esc(i.nome)}: ${A.brl(i.valor)} (${pct(i.valor, total)}%)</title></circle>`; acc += len; return r; }).join('');
    return `<div class="fd-rosca"><svg viewBox="0 0 220 220" role="img" aria-label="Gráfico de rosca">${arcos}<text x="110" y="104" text-anchor="middle" class="fd-rosca-rot">Total</text><text x="110" y="128" text-anchor="middle" class="fd-rosca-val">${esc(abrevFino(total))}</text></svg>
      <ul class="fd-rosca-leg">${itens.map(i => `<li><i style="background:${i.cor}"></i><span>${esc(i.nome)}</span><b class="num">${pct(i.valor, total)}%</b><small class="num">${A.brl(i.valor)}</small></li>`).join('')}</ul>
      ${ignorados ? `<p class="muted fd-nota">${ignorados} valor(es) negativo(s) ficaram de fora da rosca.</p>` : ''}</div>`;
  }
  function htmlHBarras(d) {
    const todas = d.series.concat(d.linha ? [d.linha] : []), max = Math.max(1, ...todas.flatMap(s => s.valores.map(v => Math.abs(v || 0))));
    return `<div class="fd-hbar">${d.labels.map((lb, i) => `<div class="fd-hbar-item"><div class="fd-hbar-rot" title="${esc(dica(d, i))}">${esc(lb)}</div>
      ${todas.map(s => { const v = s.valores[i] || 0, cor = v < 0 ? COR.danger : s.cor;
        return `<div class="fd-hbar-linha" title="${esc(s.nome)} · ${esc(dica(d, i))}: ${A.brl(v)}"><span class="fd-hbar-trilho">${v ? `<b style="width:${(Math.abs(v) / max * 100).toFixed(1)}%;background:${cor}"></b>` : ''}</span><span class="num ${v < 0 ? 'neg' : ''}">${todas.length > 1 ? `<small>${esc(s.nome)}</small> ` : ''}${A.brl(v)}</span></div>`; }).join('')}</div>`).join('')}</div>
      ${todas.length > 1 ? legenda(todas) : ''}`;
  }
  function htmlTabela(d) {
    const cols = d.series.concat(d.linha ? [d.linha] : []), unica = cols.length === 1, tot = cols.map(s => s.valores.reduce((a, v) => a + (v || 0), 0));
    const cel = v => `<td class="money ${v < 0 ? 'neg' : ''}">${A.brl(v || 0)}</td>`;
    return `<div class="tablewrap fd-tabela"><table><thead><tr><th scope="col"></th>${cols.map(s => `<th scope="col" class="money">${esc(s.nome)}</th>`).join('')}${unica ? '<th scope="col" class="money">% do total</th>' : ''}</tr></thead>
      <tbody>${d.labels.map((lb, i) => `<tr><th scope="row">${esc(dica(d, i))}</th>${cols.map(s => cel(s.valores[i])).join('')}${unica ? `<td class="money muted">${tot[0] ? pct(cols[0].valores[i] || 0, tot[0]) + '%' : '—'}</td>` : ''}</tr>`).join('')}</tbody>
      <tfoot class="tfoot"><tr><th scope="row">Total</th>${tot.map(v => cel(v)).join('')}${unica ? '<td class="money">100%</td>' : ''}</tr></tfoot></table></div>`;
  }
  const vazio = (t, s) => `<div class="fd-vazio">${icoFmt('barras', 28)}<b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>`;
  function desenhar(d, formato) {
    const temDados = d.labels.length && d.series.concat(d.linha ? [d.linha] : []).some(s => s.valores.some(v => v));
    if (!temDados) return vazio(d.vazio || 'Sem movimento para mostrar neste gráfico.', 'Escolha outro mês ou outro gráfico.');
    if (formato === 'tabela') return htmlTabela(d);
    if (formato === 'rosca') return svgRosca(d);
    if (formato === 'hbarras') return htmlHBarras(d);
    if (formato === 'linhas' || formato === 'area') return svgLinhas(d, formato === 'area');
    // barras: reaproveita A.chartBarras (rótulos longos encurtados para caber no eixo)
    const maxCh = Math.max(4, Math.floor(560 / d.labels.length / 6.5)), labels = d.labels.map(l => corta(l, maxCh));
    return A.chartBarras({labels, series: d.series, linha: d.linha, altura: 300});
  }

  /* ---------- preferências por pessoa (último gráfico e formato de cada gráfico) ---------- */
  const chaveFd = () => 'gomes-findash-' + (S.meId || (S.contaId ? 'conta-' + S.contaId : 'admin'));
  function prefsFd() { let p = null; try { p = JSON.parse(A.lsGet(chaveFd()) || 'null'); } catch (e) {} p = p && typeof p === 'object' ? p : {};
    return {grafico: GRAFICOS.some(g => g.id === p.grafico) ? p.grafico : GRAFICOS[0].id, formatos: p.formatos && typeof p.formatos === 'object' ? p.formatos : {}}; }
  const gravarFd = p => A.lsSet(chaveFd(), JSON.stringify(p));
  const formatoDe = (p, g) => FORMATOS.some(f => f[0] === p.formatos[g.id]) ? p.formatos[g.id] : g.formato;

  let menu = null, focar = null, animar = false; // menu aberto ('grafico'|'formato'), id a focar depois do desenho, anima a troca
  function vDash() {
    const u = A.ui('findash', {ym: A.hoje().slice(0, 7)}), p = prefsFd(), g = grafico(p.grafico), fmt = formatoDe(p, g);
    const c = calcDash(u.ym), d = g.dados(c), dq = d.destaque, idx = GRAFICOS.indexOf(g);
    const tom = dq.tom || (dq.sinal ? (dq.valor >= 0 ? 'pos' : 'neg') : '');
    const ymOpts = []; for (let i = -12; i <= 3; i++) { const m = A.addMonths(A.hoje().slice(0, 8) + '01', i).slice(0, 7); ymOpts.push([m, nomeMes(m)]); }
    const opcao = (acao, v, atual, conteudo, id) => `<button type="button" role="menuitemradio" id="${id}" class="fd-opcao" aria-checked="${atual}" tabindex="-1" data-action="${acao}" data-v="${esc(v)}" data-onkeydown="fd-tecla-menu">${conteudo}</button>`;
    const menuG = menu === 'grafico' ? `<div class="fd-pop" role="menu" id="fdMenuG" aria-label="Escolher gráfico">${GRAFICOS.map((x, i) => opcao('fd-grafico', x.id, x.id === g.id, `<span class="fd-op-n num">${i + 1}</span><span class="fd-op-t">${esc(x.titulo)}<small>${esc(x.sub)}</small></span>${icoFmt(formatoDe(p, x), 15)}`, 'fdOpG-' + x.id)).join('')}</div>` : '';
    const menuF = menu === 'formato' ? `<div class="fd-pop fd-pop-dir" role="menu" id="fdMenuF" aria-label="Escolher formato">${FORMATOS.map(([k, l]) => opcao('fd-formato', k, k === fmt, `${icoFmt(k, 18)}<span class="fd-op-t">${esc(l)}${k === g.formato ? '<small>padrão deste gráfico</small>' : ''}</span>`, 'fdOpF-' + k)).join('')}</div>` : '';
    return `<section class="panel fd"><div class="vhead fd-head"><h2>Dashboard financeiro</h2>
        <div class="fd-ctrl">
          <div class="fd-menu"><button type="button" class="fd-btn" id="fdBtnG" aria-haspopup="menu" aria-expanded="${menu === 'grafico'}"${menu === 'grafico' ? ' aria-controls="fdMenuG"' : ''} data-action="fd-menu" data-v="grafico" data-onkeydown="fd-tecla-btn">${icoFmt('barras', 16)}<span class="fd-btn-t"><small>Gráfico</small><b>${esc(g.titulo)}</b></span><span class="fd-seta" aria-hidden="true"></span></button>${menuG}</div>
          <div class="fd-menu"><button type="button" class="fd-btn" id="fdBtnF" aria-haspopup="menu" aria-expanded="${menu === 'formato'}"${menu === 'formato' ? ' aria-controls="fdMenuF"' : ''} data-action="fd-menu" data-v="formato" data-onkeydown="fd-tecla-btn">${icoFmt(fmt, 16)}<span class="fd-btn-t"><small>Formato</small><b>${esc(FORMATOS.find(f => f[0] === fmt)[1])}</b></span><span class="fd-seta" aria-hidden="true"></span></button>${menuF}</div>
          <select id="fdYm" class="fd-mes" data-ui="findash.ym" aria-label="Mês">${A.opts(ymOpts, u.ym)}</select>
        </div></div>
      <div class="fd-palco${animar ? ' fd-anima' : ''}" aria-live="polite">
        <div class="fd-topo">
          <div class="fd-destaque fd-${tom || 'neutro'}"><span class="fd-rotulo">${esc(dq.rotulo)}</span><strong class="num">${A.brl(dq.valor)}</strong><small>${esc(dq.sub || '')}</small></div>
          <div class="fd-leitura"><span class="fd-rotulo">Leitura rápida</span><p>${esc(d.leitura || 'Nada a destacar neste período.')}</p></div>
        </div>
        <div class="fd-tit"><div><h3>${esc(g.titulo)} <span class="muted">· ${esc(g.sub)}</span></h3><span class="muted fd-periodo">${esc(d.periodo)}</span></div>
          <div class="fd-nav"><button type="button" class="iconbtn" data-action="fd-passo" data-v="-1" aria-label="Gráfico anterior" title="Gráfico anterior (←)">‹</button><span class="num muted">${idx + 1} de ${GRAFICOS.length}</span><button type="button" class="iconbtn" data-action="fd-passo" data-v="1" aria-label="Próximo gráfico" title="Próximo gráfico (→)">›</button></div></div>
        <div class="fd-grafico fd-f-${fmt}">${desenhar(d, fmt)}</div>
      </div></section>`;
  }
  function depoisDash() {
    animar = false;
    if (focar) { const el = document.getElementById(focar); focar = null; if (el) el.focus(); }
  }
  const abrir = qual => { menu = qual; const p = prefsFd();
    focar = qual === 'grafico' ? 'fdOpG-' + p.grafico : 'fdOpF-' + formatoDe(p, grafico(p.grafico)); A.render(); };
  const fechar = volta => { if (!menu) return; if (volta) focar = menu === 'grafico' ? 'fdBtnG' : 'fdBtnF'; menu = null; A.render(); };
  function trocar(id, fmt, volta) {
    const p = prefsFd(); if (id) p.grafico = id; if (fmt) p.formatos[p.grafico] = fmt; gravarFd(p);
    animar = true; if (volta) focar = volta; menu = null; A.render();
  }
  function passo(n) { const i = GRAFICOS.indexOf(grafico(prefsFd().grafico)); trocar(GRAFICOS[(i + n + GRAFICOS.length) % GRAFICOS.length].id); }
  A.on('fd-menu', el => menu === el.dataset.v ? fechar(true) : abrir(el.dataset.v));
  A.on('fd-grafico', el => trocar(el.dataset.v, null, 'fdBtnG'));
  A.on('fd-formato', el => trocar(null, el.dataset.v, 'fdBtnF'));
  A.on('fd-passo', el => passo(Number(el.dataset.v)));
  /* teclado dentro do menu: ↑ ↓ Home End navegam; Esc e Tab fecham */
  A.on('fd-tecla-menu', (el, e) => {
    const itens = [...el.parentNode.querySelectorAll('.fd-opcao')], i = itens.indexOf(el);
    const ir = j => { e.preventDefault(); itens[(j + itens.length) % itens.length].focus(); };
    if (e.key === 'ArrowDown') ir(i + 1); else if (e.key === 'ArrowUp') ir(i - 1); else if (e.key === 'Home') ir(0); else if (e.key === 'End') ir(itens.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); fechar(true); } else if (e.key === 'Tab') fechar(false);
  });
  /* ↓ no botão abre o menu; Esc com o menu aberto fecha */
  A.on('fd-tecla-btn', (el, e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); abrir(el.dataset.v); }
    else if (e.key === 'Escape' && menu) { e.preventDefault(); fechar(true); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !menu) { e.preventDefault(); passo(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  /* atalhos da rota (chamados por app.js): Esc fecha o menu; ← → trocam o gráfico fora dos campos */
  function teclasDash(e) {
    if (e.key === 'Escape' && menu) { fechar(true); return true; }
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || menu) return false;
    const t = e.target; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || document.querySelector('.modal')) return false;
    e.preventDefault(); passo(e.key === 'ArrowLeft' ? -1 : 1); return true;
  }
  const cliqueDash = e => { if (menu && !e.target.closest('.fd-menu')) fechar(false); };
  A.route('fin', {label: 'Dashboard financeiro', mod: 'financeiro', render: vDash, depois: depoisDash, teclas: teclasDash, clique: cliqueDash});

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
