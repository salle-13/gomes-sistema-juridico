/* Exportação (CSV, Excel, PDF) e gráficos simples em SVG. */
(function (A) {
  const LIBS = {
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
    pdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'],
  };
  const carregadas = {};
  function script(src) { return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('falha ao carregar ' + src)); document.head.appendChild(s); }); }
  async function carregar(nome) { if (!carregadas[nome]) carregadas[nome] = (async () => { for (const src of LIBS[nome]) await script(src); })(); return carregadas[nome]; }
  A.carregarLib = carregar; // usado pelo gerador de documentos (m-modelos.js)

  function valorCelula(col, row, modo) {
    const v = col.v(row);
    if (col.tipo === 'money') return modo === 'xlsx' ? Number(v || 0) / 100 : A.num(v);
    if (col.tipo === 'date') return v ? A.fmt(v) : '';
    return v == null ? '' : String(v);
  }
  async function salvar(arquivo, data) {
    if (A.S.downloads) {
      try { await A.S.downloads.save({filename: arquivo, data}); return true; }
      catch (e) { if (e && e.code === 'declined') return false; A.toast('Não foi possível baixar o arquivo neste acesso.'); return false; }
    }
    try { // fora da plataforma (pré-visualização local)
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arquivo; document.body.appendChild(a); a.click(); a.remove(); return true;
    } catch (e) { A.toast('Download indisponível neste acesso.'); return false; }
  }

  /* def = {titulo, arquivo (sem extensão), colunas:[{t, v(row), tipo:'money'|'date'|'text'}], linhas, filtros:'texto', totais:{coluna: valor}} */
  A.exportar = async function (def, formato) {
    const nome = (def.arquivo || def.titulo).replace(/[^\wÀ-ú -]/g, '').replace(/\s+/g, '-').toLowerCase() + '-' + A.hoje();
    try {
      if (formato === 'csv') {
        const linhas = [def.colunas.map(c => c.t), ...def.linhas.map(r => def.colunas.map(c => valorCelula(c, r, 'csv')))];
        if (def.totais) linhas.push(def.colunas.map((c, i) => def.totais[c.t] != null ? A.num(def.totais[c.t]) : (i === 0 ? 'Total' : '')));
        const csv = '﻿' + linhas.map(l => l.map(x => /[;"\n]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(';')).join('\r\n');
        return salvar(nome + '.csv', csv);
      }
      if (formato === 'xlsx') {
        A.toast('Gerando planilha…'); await carregar('xlsx');
        const aoa = [[def.titulo], [def.filtros || ''], [], def.colunas.map(c => c.t), ...def.linhas.map(r => def.colunas.map(c => valorCelula(c, r, 'xlsx')))];
        if (def.totais) aoa.push(def.colunas.map((c, i) => def.totais[c.t] != null ? def.totais[c.t] / 100 : (i === 0 ? 'Total' : '')));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = def.colunas.map(c => ({wch: c.tipo === 'money' ? 14 : c.tipo === 'date' ? 12 : Math.min(45, Math.max(10, c.t.length + 4))}));
        const range = XLSX.utils.decode_range(ws['!ref']);
        def.colunas.forEach((c, ci) => { if (c.tipo !== 'money') return; for (let r = 4; r <= range.e.r; r++) { const cell = ws[XLSX.utils.encode_cell({r, c: ci})]; if (cell && typeof cell.v === 'number') cell.z = '#,##0.00'; } });
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        const buf = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
        return salvar(nome + '.xlsx', new Blob([buf]));
      }
      if (formato === 'pdf') {
        A.toast('Gerando PDF…'); await carregar('pdf');
        const {jsPDF} = window.jspdf;
        const doc = new jsPDF({orientation: def.colunas.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4'});
        const W = doc.internal.pageSize.getWidth();
        doc.setFillColor(39, 56, 132); doc.rect(0, 0, W, 54, 'F');
        doc.setTextColor(234, 233, 233); doc.setFontSize(13); doc.text('GOMES · Assessoria Jurídica', 36, 24);
        doc.setFontSize(9); doc.text('Araguari/MG · Uberlândia/MG', 36, 40);
        doc.setTextColor(19, 18, 11); doc.setFontSize(15); doc.text(def.titulo, 36, 82);
        doc.setFontSize(9); doc.setTextColor(84, 89, 95);
        doc.text((def.filtros ? def.filtros + '   ·   ' : '') + 'Gerado em ' + A.quando(new Date().toISOString()), 36, 98);
        const body = def.linhas.map(r => def.colunas.map(c => valorCelula(c, r, 'pdf')));
        const foot = def.totais ? [def.colunas.map((c, i) => def.totais[c.t] != null ? A.num(def.totais[c.t]) : (i === 0 ? 'Total' : ''))] : undefined;
        doc.autoTable({startY: 110, head: [def.colunas.map(c => c.t)], body, foot, theme: 'grid', styles: {fontSize: 8, cellPadding: 4},
          headStyles: {fillColor: [39, 56, 132], textColor: 255}, footStyles: {fillColor: [234, 233, 233], textColor: 20, fontStyle: 'bold'},
          columnStyles: Object.fromEntries(def.colunas.map((c, i) => [i, c.tipo === 'money' ? {halign: 'right'} : {}])),
          didDrawPage: d => { doc.setFontSize(8); doc.setTextColor(120); doc.text('Página ' + doc.internal.getNumberOfPages(), W - 80, doc.internal.pageSize.getHeight() - 16); }});
        return salvar(nome + '.pdf', doc.output('blob'));
      }
    } catch (e) { console.error(e); A.toast('Não foi possível gerar o arquivo. Verifique a conexão e tente de novo.'); return false; }
  };
  /* Botões padrão de exportação: data-action="exportar" data-exp="<chave>" data-fmt="csv|xlsx|pdf" */
  A.exportadores = {};
  A.botoesExport = chave => `<span class="export"><span class="muted">Exportar</span><button class="btn small" data-action="exportar" data-exp="${chave}" data-fmt="xlsx">Excel</button><button class="btn small" data-action="exportar" data-exp="${chave}" data-fmt="pdf">PDF</button><button class="btn small" data-action="exportar" data-exp="${chave}" data-fmt="csv">CSV</button></span>`;
  A.on('exportar', el => { const f = A.exportadores[el.dataset.exp]; if (!f) return; A.exportar(f(), el.dataset.fmt); });

  /* ---------- gráficos ---------- */
  const abrev = c => { const v = Math.abs(c) / 100; return (c < 0 ? '-' : '') + (v >= 1e6 ? (v/1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 ? Math.round(v/1e3) + ' mil' : Math.round(v)); };
  function escala(max) { if (max <= 0) return [0, 1]; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = [1, 2, 2.5, 5, 10].find(k => k * p * 4 >= max) * p; return [n, Math.ceil(max / n) * n]; }
  /* barras agrupadas: {labels, series:[{nome, cor, valores(centavos)}], linha:{nome, cor, valores}} */
  A.chartBarras = function ({labels, series, linha, altura}) {
    const W = 640, H = altura || 240, L = 54, R = 10, T = 10, B = 28, w = W - L - R, h = H - T - B;
    const todos = series.flatMap(s => s.valores).concat(linha ? linha.valores : []);
    const maxAbs = Math.max(1, ...todos.map(v => Math.max(0, v))); const minV = Math.min(0, ...todos);
    const [passo, topo] = escala(maxAbs); const fundo = minV < 0 ? -escala(-minV)[1] : 0;
    const y = v => T + h - (v - fundo) / (topo - fundo) * h;
    let g = '';
    for (let v = fundo; v <= topo + 1; v += passo) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${abrev(v)}</text>`;
    const gw = w / labels.length, bw = Math.min(22, (gw - 8) / series.length);
    labels.forEach((lb, i) => {
      const x0 = L + i * gw + (gw - bw * series.length) / 2;
      series.forEach((s, si) => { const v = s.valores[i] || 0; const yy = y(Math.max(0, v)), hh = Math.abs(y(v) - y(0));
        g += `<rect x="${x0 + si * bw}" y="${yy}" width="${bw - 2}" height="${Math.max(0, hh)}" rx="2" fill="${s.cor}"><title>${A.esc(s.nome)} · ${A.esc(lb)}: ${A.brl(v)}</title></rect>`; });
      g += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${A.esc(lb)}</text>`;
    });
    if (linha) { const pts = linha.valores.map((v, i) => `${L + i * gw + gw / 2},${y(v)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" stroke="${linha.cor}" stroke-width="2"/>` + linha.valores.map((v, i) => `<circle cx="${L + i * gw + gw / 2}" cy="${y(v)}" r="3" fill="${linha.cor}"><title>${A.esc(linha.nome)} · ${A.esc(labels[i])}: ${A.brl(v)}</title></circle>`).join(''); }
    const leg = series.concat(linha ? [linha] : []).map(s => `<span><i style="background:${s.cor}"></i>${A.esc(s.nome)}</span>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="chart-legend">${leg}</div></div>`;
  };
  /* barras horizontais: itens [{nome, valor, cor}] */
  A.chartHBar = function (itens) {
    const max = Math.max(1, ...itens.map(i => i.valor));
    return `<div class="load">${itens.map(i => `<div class="loadrow" style="grid-template-columns:minmax(0,1fr) auto"><span>${A.esc(i.nome)}</span><span class="num muted">${A.brl(i.valor)}</span><span class="bar" style="grid-column:1 / 3"><b style="width:${Math.round(i.valor / max * 100)}%;background:${i.cor || 'var(--accent)'}"></b></span></div>`).join('') || '<span class="muted">Sem dados no período.</span>'}</div>`;
  };
})(window.App);
