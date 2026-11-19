/* Módulo Modelos: cadastro de modelos de texto com campos {{...}} e gerador de documentos
   a partir da ficha do cliente ou do processo (prévia, impressão/PDF e envio para Documentos). */
(function (A) {
  const S = A.S, esc = A.esc;
  const ui = () => A.ui('modelos', {busca: '', tipo: '', ativos: true});
  A.TIPOS_MODELO = ['Procuração', 'Contrato', 'Declaração', 'Petição', 'Outro'];
  const CAT_DOC = {'Procuração': 'Procuração', 'Contrato': 'Contrato', 'Petição': 'Petição / peça'};

  /* ---------- campos disponíveis ---------- */
  const extenso = s => { const [y, m, d] = s.split('-').map(Number); return (d === 1 ? '1º' : d) + ' de ' + A.MESES[m - 1] + ' de ' + y; };
  A.CAMPOS_MODELO = [
    ['Cliente', [
      ['cliente.nome', 'Nome / razão social', c => c.cliente?.nome],
      ['cliente.cpf_cnpj', 'CPF / CNPJ', c => c.cliente?.documento],
      ['cliente.endereco', 'Endereço', c => c.cliente?.endereco],
      ['cliente.tipo_pessoa', 'Pessoa física / jurídica', c => c.cliente ? (c.cliente.tipoPessoa === 'PJ' ? 'pessoa jurídica' : 'pessoa física') : ''],
      ['cliente.email', 'E-mail', c => c.cliente?.email],
      ['cliente.telefone', 'Telefone', c => c.cliente?.telefone],
    ]],
    ['Processo', [
      ['processo.numero', 'Número (CNJ)', c => c.processo?.numero],
      ['processo.vara', 'Vara / órgão', c => c.processo?.vara],
      ['processo.comarca', 'Comarca', c => c.processo?.comarca],
      ['processo.tribunal', 'Tribunal', c => c.processo?.tribunal],
      ['processo.classe', 'Classe / ação', c => c.processo?.classe],
      ['processo.parte_contraria', 'Parte contrária', c => c.processo?.parteContraria],
      ['processo.valor_causa', 'Valor da causa', c => c.processo?.valorCausa ? A.brl(c.processo.valorCausa) : ''],
    ]],
    ['Advogada', [
      ['advogada.nome', 'Nome', c => c.advogada?.nome],
      ['advogada.oab', 'Inscrição na OAB', c => c.advogada?.oab],
      ['advogada.email', 'E-mail', c => c.advogada?.email],
    ]],
    ['Datas', [
      ['data_hoje_extenso', 'Data de hoje por extenso', () => extenso(A.hoje())],
      ['data_hoje', 'Data de hoje (dd/mm/aaaa)', () => A.fmt(A.hoje())],
    ]],
  ];
  const CAMPOS = Object.fromEntries(A.CAMPOS_MODELO.flatMap(([, l]) => l.map(([k, r, f]) => [k, f])));
  const CAMPO_RE = /\{\{\s*([\w.]+)\s*\}\}/g, FALTA_RE = /\[\[([\w.]+)\]\]/g;

  /* Preenche o texto; campo vazio ou desconhecido vira [[chave]] e entra em "faltando". */
  A.preencherModelo = function (texto, ctx) {
    const faltando = new Set();
    const out = String(texto || '').replace(CAMPO_RE, (_, k) => { const f = CAMPOS[k]; const v = f ? String(f(ctx) ?? '').trim() : '';
      if (!v) { faltando.add(k); return '[[' + k + ']]'; } return v; });
    return {texto: out, faltando: [...faltando]};
  };
  const faltandoEm = t => [...new Set([...String(t || '').matchAll(FALTA_RE)].map(m => m[1]))];
  const desconhecidos = t => [...new Set([...String(t || '').matchAll(CAMPO_RE)].map(m => m[1]).filter(k => !CAMPOS[k]))];

  /* ---------- tela Modelos ---------- */
  function lista() { const u = ui();
    return A.col('modelos').filter(m => (!u.tipo || m.tipo === u.tipo) && (!u.ativos || m.ativo !== false) && A.match(u.busca, m.nome, m.tipo, m.texto))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')); }
  A.exportadores.modelos = () => ({titulo: 'Modelos de documentos', linhas: lista(), colunas: [{t:'Modelo', v:m => m.nome}, {t:'Tipo', v:m => m.tipo},
    {t:'Ativo', v:m => m.ativo === false ? 'Não' : 'Sim'}, {t:'Atualizado em', v:m => String(m.atualizadoEm || '').slice(0, 10), tipo:'date'}]});

  function vModelos() {
    const u = ui(), arr = lista(), ed = A.pode('modelos', 'editar');
    const rows = arr.map(m => { const n = (String(m.texto || '').match(CAMPO_RE) || []).length;
      return `<tr class="row-click" data-action="abrir-modelo" data-id="${esc(m.id)}"><td><b>${esc(m.nome)}</b>${m.exemplo ? ' <span class="tag">exemplo</span>' : ''}<br><span class="muted" style="font-size:12px">${esc(String(m.texto || '').replace(/\s+/g, ' ').slice(0, 110))}${String(m.texto || '').length > 110 ? '…' : ''}</span></td>
        <td><span class="tag">${esc(m.tipo || 'Outro')}</span></td><td class="num">${n}</td><td>${m.ativo === false ? 'Inativo' : 'Ativo'}</td>
        <td>${esc(A.fmt(String(m.atualizadoEm || m.criadoEm || '').slice(0, 10)))}</td>
        <td><button class="btn small" data-action="gerar-de-modelo" data-id="${esc(m.id)}">Gerar</button></td></tr>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Modelos de documentos</h2><span class="muted num">${arr.length} modelo(s)</span>${A.botoesExport('modelos')}${ed ? '<button class="btn primary" data-action="novo-modelo">+ Novo modelo</button>' : ''}</div>
      <div class="filters"><input id="moBusca" type="search" data-ui="modelos.busca" placeholder="Buscar modelo ou trecho do texto…" value="${esc(u.busca)}" style="flex:1 1 260px">
        <select id="moTipo" data-ui="modelos.tipo">${A.opts(A.TIPOS_MODELO, u.tipo, 'Todos os tipos')}</select>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="moAtivos" data-ui="modelos.ativos" ${u.ativos ? 'checked' : ''}> Só ativos</label></div>
      <div class="tablewrap"><table><thead><tr><th>Modelo</th><th>Tipo</th><th>Campos</th><th>Situação</th><th>Atualizado</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty" style="padding:16px">Nenhum modelo encontrado.${!A.col('modelos').length && ed ? ' <button class="btn small" data-action="mod-exemplos">Carregar os 3 modelos de exemplo</button>' : ''}</td></tr>`}</tbody></table></div>
      <div class="legend">Para gerar um documento, abra a ficha de um cliente ou de um processo e use “Gerar documento”, ou clique em “Gerar” aqui e escolha o cliente.</div></section>`;
  }
  A.route('modelos', {label: 'Modelos de documentos', mod: 'modelos', render: vModelos});

  /* ---------- editor do modelo ---------- */
  let mod = null;
  A.on('novo-modelo', () => abrirModelo(null));
  A.on('abrir-modelo', el => { const m = A.byId('modelos', el.dataset.id); if (m) abrirModelo(m); });
  function painelCampos(ed) {
    return `<div class="box"><h4>Campos disponíveis</h4><p class="muted" style="margin:0;font-size:12px">${ed ? 'Clique para inserir no ponto do cursor.' : 'Campos que o texto pode usar.'} Campo sem dado aparece destacado na prévia.</p>
      ${A.CAMPOS_MODELO.map(([g, l]) => `<div class="campos"><b>${esc(g)}</b>${l.map(([k, r]) => `<button type="button" class="campo" ${ed ? `data-action="mod-inserir" data-k="${esc(k)}"` : 'disabled'} title="${esc(r)}"><code>{{${esc(k)}}}</code><span>${esc(r)}</span></button>`).join('')}</div>`).join('')}</div>`;
  }
  function abrirModelo(m) {
    const ed = A.pode('modelos', 'editar'), ro = ed ? '' : 'disabled';
    mod = m ? JSON.parse(JSON.stringify(m)) : {id: A.uid(), _novo: true, nome: '', tipo: 'Procuração', texto: '', ativo: true};
    A.modal(`${A.modalHead(mod._novo ? 'Novo modelo' : mod.nome)}
      <form id="fModelo"><div class="cgrid"><div>
        <div class="two">${A.inp('moNome', 'Nome do modelo', mod.nome, `required ${ro}`)}${A.sel('moTipoM', 'Tipo', A.opts(A.TIPOS_MODELO, mod.tipo), '', ro)}</div>
        ${A.area('moTexto', 'Texto do modelo', mod.texto, 22, `${ro} spellcheck="true" style="font-family:var(--font-display);font-size:14px;line-height:1.55"`)}
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="moAtivo" ${mod.ativo !== false ? 'checked' : ''} ${ro}> Modelo ativo (aparece em “Gerar documento”)</label>
      </div><div>${painelCampos(ed)}</div></div>
      <footer>${!mod._novo && ed ? '<button type="button" class="btn danger left" data-action="mod-excluir">Excluir modelo</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`, {wide: true});
    document.getElementById('fModelo').addEventListener('submit', async e => { e.preventDefault(); if (await salvarModelo()) { A.closeModal(); A.toast('Modelo salvo.'); } });
  }
  async function salvarModelo() {
    const obj = Object.assign({}, mod, {nome: A.v('moNome'), tipo: A.v('moTipoM'), texto: document.getElementById('moTexto').value, ativo: A.v('moAtivo')});
    if (!obj.nome) { A.toast('Informe o nome do modelo.'); return null; }
    if (!obj.texto.trim()) { A.toast('Escreva o texto do modelo.'); return null; }
    const dx = desconhecidos(obj.texto);
    if (dx.length) A.toast('Atenção: campo(s) desconhecido(s) no texto: ' + dx.map(k => '{{' + k + '}}').join(', ') + '. Eles vão aparecer como “sem dado”.');
    delete obj._novo; return A.save('modelos', obj);
  }
  A.on('mod-inserir', el => {
    const ta = document.getElementById('moTexto'); if (!ta) return;
    const ins = '{{' + el.dataset.k + '}}', i = ta.selectionStart ?? ta.value.length, j = ta.selectionEnd ?? i;
    ta.value = ta.value.slice(0, i) + ins + ta.value.slice(j); ta.focus(); ta.setSelectionRange(i + ins.length, i + ins.length);
  });
  A.on('mod-exemplos', async () => { // base compartilhada nova: a coleção não vem do seed automaticamente
    let n = 0; for (const m of A.seed(A.hoje(), A.P).data.modelos || []) if (!A.byId('modelos', m.id) && await A.save('modelos', m)) n++;
    A.toast(n + ' modelo(s) de exemplo carregado(s).');
  });
  A.on('mod-excluir', () => { const id = mod.id; A.confirm('Excluir modelo', 'O modelo será apagado. Os documentos já gerados a partir dele continuam em Documentos.', 'Excluir', async () => { if (await A.remove('modelos', id)) A.toast('Modelo excluído.'); }); });

  /* ---------- gerador ---------- */
  let g = null; // {clienteId, processoId, modeloId, advId, texto, editando}
  const advogadas = () => A.col('equipe').filter(m => ['advogado', 'admin'].includes(m.papel) && m.ativo !== false);
  const ativos = () => A.col('modelos').filter(m => m.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  function advPadrao(clienteId, processoId) {
    const cand = [A.processo(processoId)?.responsavelId, A.cliente(clienteId)?.responsavelId, S.meId];
    return cand.find(id => id && A.membro(id)) || advogadas()[0]?.id || '';
  }
  function preencher() {
    const m = A.byId('modelos', g.modeloId);
    g.texto = m ? A.preencherModelo(m.texto, {cliente: A.cliente(g.clienteId), processo: A.processo(g.processoId), advogada: A.membro(g.advId)}).texto : '';
    g.editando = false;
  }
  A.abrirGerador = function (alvo) {
    if (!A.pode('modelos', 'ver')) { A.toast('Seu papel não tem acesso a Modelos de documentos.'); return; }
    const processoId = alvo.processoId || '', clienteId = alvo.clienteId || A.processo(processoId)?.clienteId || '';
    const lst = ativos();
    g = {clienteId, processoId, modeloId: (alvo.modeloId && A.byId('modelos', alvo.modeloId)) ? alvo.modeloId : (lst[0]?.id || ''), advId: advPadrao(clienteId, processoId), texto: '', editando: false};
    S.ui._modalCtx = {tipo: 'gerador'};
    preencher(); desenharGerador();
  };
  function previaHtml(t) { return esc(t).replace(/\[\[([\w.]+)\]\]/g, '<mark title="Campo sem dado">[[$1]]</mark>'); }
  function aviso() {
    const f = faltandoEm(g.texto);
    return f.length ? `<div class="aviso-campos" role="alert"><b>Campos sem dado:</b> ${f.map(k => `<code>${esc(k)}</code>`).join(', ')}. Complete o cadastro (cliente, processo ou equipe) e gere de novo, ou edite o texto antes de imprimir.</div>` : '';
  }
  function desenharGerador() {
    const lst = ativos(), podeSalvar = A.pode('documentos', 'editar'), semEnvio = S.mode === 'local' || !S.assets;
    const procs = A.col('processos').filter(p => !g.clienteId || p.clienteId === g.clienteId);
    const motivo = !podeSalvar ? 'Seu papel não pode enviar documentos.' : S.mode === 'local' ? 'No modo local não é possível anexar arquivos. Abra o sistema compartilhado para salvar em Documentos.' : semEnvio ? 'Seu acesso não permite enviar arquivos.' : '';
    A.modal(`${A.modalHead('Gerar documento')}
      <div class="cgrid"><div>
        <div id="gerAviso">${aviso()}</div>
        <div class="vhead" style="padding:0"><b style="font-size:13px">Prévia</b><button type="button" class="btn small" data-action="ger-editar">${g.editando ? 'Ver prévia' : 'Editar texto'}</button></div>
        ${g.editando ? `<textarea id="gerTexto" rows="24" aria-label="Texto do documento" style="font-family:var(--font-display);font-size:14px;line-height:1.55">${esc(g.texto)}</textarea>`
          : `<div class="previa" id="gerPrevia">${g.texto ? previaHtml(g.texto) : '<span class="muted">Escolha um modelo.</span>'}</div>`}
      </div><div>
        <div class="box"><h4>Dados</h4>
          ${A.sel('gerModelo', 'Modelo', lst.length ? A.opts(lst.map(m => [m.id, m.nome]), g.modeloId) : '<option value="">Nenhum modelo ativo</option>', '', 'data-onchange="ger-campo"')}
          ${A.sel('gerCli', 'Cliente', A.opts(A.col('clientes').slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(c => [c.id, c.nome]), g.clienteId, 'Nenhum'), '', 'data-onchange="ger-campo"')}
          ${A.sel('gerProc', 'Processo', A.opts(procs.map(p => [p.id, p.numero]), g.processoId, 'Nenhum'), '', 'data-onchange="ger-campo"')}
          ${A.sel('gerAdv', 'Advogada que assina', A.opts(advogadas().map(m => [m.id, m.nome + (m.oab ? ' · ' + m.oab : '')]), g.advId, 'Nenhuma'), '', 'data-onchange="ger-campo"')}
          <p class="muted" style="margin:0;font-size:12px">Trocar um dado gera o texto de novo a partir do modelo (edições manuais são descartadas).</p>
        </div>
        <div class="box"><h4>Concluir</h4>
          <button type="button" class="btn" data-action="ger-imprimir" ${g.texto ? '' : 'disabled'}>Imprimir / salvar como PDF</button>
          <button type="button" class="btn primary" data-action="ger-salvar" ${g.texto && !motivo ? '' : 'disabled'}>Salvar em Documentos (PDF)</button>
          ${motivo ? `<span class="muted" style="font-size:12px">${esc(motivo)}</span>` : `<span class="muted" style="font-size:12px">O PDF fica vinculado ${g.processoId ? 'ao processo e ao cliente' : g.clienteId ? 'ao cliente' : 'aos documentos gerais do escritório'}.</span>`}
        </div>
      </div></div>
      <footer><button type="button" class="btn" data-action="modal-fechar">Fechar</button></footer>`, {wide: true, nofocus: true});
    const ta = document.getElementById('gerTexto');
    if (ta) ta.addEventListener('input', () => { g.texto = ta.value; document.getElementById('gerAviso').innerHTML = aviso(); });
  }
  A.on('ger-campo', el => {
    if (el.id === 'gerModelo') g.modeloId = el.value;
    if (el.id === 'gerAdv') g.advId = el.value;
    if (el.id === 'gerCli') { g.clienteId = el.value; if (g.processoId && A.processo(g.processoId)?.clienteId !== g.clienteId) g.processoId = ''; }
    if (el.id === 'gerProc') { g.processoId = el.value; const p = A.processo(g.processoId); if (p && p.clienteId) g.clienteId = p.clienteId; }
    preencher(); desenharGerador();
  });
  A.on('ger-editar', () => { const ta = document.getElementById('gerTexto'); if (ta) g.texto = ta.value; g.editando = !g.editando; desenharGerador(); });

  /* Ação perigosa com campos faltando: pede um segundo clique (mesmo padrão de doc-excluir). */
  function confirmarFaltando(el) {
    if (!faltandoEm(g.texto).length || el.dataset.armed) return true;
    const orig = el.textContent; el.dataset.armed = '1'; el.textContent = 'Há campos sem dado. Clique de novo para continuar';
    setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = orig; } }, 5000); return false;
  }
  const nomeArquivo = () => { const m = A.byId('modelos', g.modeloId), c = A.cliente(g.clienteId);
    return [m?.nome || 'Documento', c?.nome].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '').slice(0, 120) + ' - ' + A.hoje() + '.pdf'; };

  A.on('ger-imprimir', el => {
    const ta = document.getElementById('gerTexto'); if (ta) g.texto = ta.value;
    if (!confirmarFaltando(el)) return;
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
    const d = fr.contentDocument;
    d.open(); d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeArquivo().replace(/\.pdf$/, ''))}</title><style>
      @page{size:A4;margin:25mm 22mm}body{font-family:"Times New Roman",Georgia,serif;font-size:12pt;line-height:1.6;color:#000;margin:0}
      header{font-family:Arial,sans-serif;font-size:9pt;color:#273884;border-bottom:1px solid #273884;padding-bottom:4pt;margin-bottom:18pt}
      .t{white-space:pre-wrap;text-align:justify}mark{background:#ffe08a}</style></head>
      <body><header>GOMES · Assessoria Jurídica — Araguari/MG · Uberlândia/MG</header><div class="t">${previaHtml(g.texto)}</div></body></html>`);
    d.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast('Não foi possível abrir a impressão.'); } setTimeout(() => fr.remove(), 60000); }, 250);
  });

  async function gerarPdf(texto) {
    await A.carregarLib('pdf');
    const {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'pt', format: 'a4'});
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), mx = 64, top = 84, base = H - 64, lh = 17;
    const cabecalho = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(39, 56, 132);
      doc.text('GOMES · Assessoria Jurídica — Araguari/MG · Uberlândia/MG', mx, 46); doc.setDrawColor(39, 56, 132); doc.line(mx, 52, W - mx, 52);
      doc.setFont('times', 'normal'); doc.setFontSize(12); doc.setTextColor(0); };
    cabecalho(); let y = top;
    for (const par of String(texto).split('\n')) {
      const linhas = par.trim() ? doc.splitTextToSize(par, W - 2 * mx) : [''];
      for (const l of linhas) { if (y > base) { doc.addPage(); cabecalho(); y = top; } doc.text(l, mx, y); y += lh; }
    }
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text('Página ' + i + ' de ' + n, W - mx, H - 30, {align: 'right'}); }
    return doc.output('blob');
  }
  A.on('ger-salvar', async el => {
    const ta = document.getElementById('gerTexto'); if (ta) g.texto = ta.value;
    if (!S.assets || !A.pode('documentos', 'editar')) { A.toast('Envio de arquivos indisponível para seu acesso.'); return; }
    if (!confirmarFaltando(el)) return;
    el.disabled = true; el.textContent = 'Gerando PDF…';
    try {
      const nome = nomeArquivo(), blob = await gerarPdf(g.texto);
      const r = await S.assets.upload(new File([blob], nome, {type: 'application/pdf'}), {type: 'application/pdf'});
      const m = A.byId('modelos', g.modeloId);
      const ok = await A.save('documentos', {nome, categoria: CAT_DOC[m?.tipo] || 'Modelo do escritório', assetId: r.id, contentType: r.contentType, sizeBytes: r.sizeBytes,
        clienteId: g.clienteId || null, processoId: g.processoId || null, enviadoPor: S.meId || null, enviadoEm: new Date().toISOString()});
      if (ok) A.toast('Documento salvo em Documentos: ' + nome);
    } catch (e) { const c = e && e.code; A.toast(c === 'quota_or_state' ? 'O espaço de armazenamento acabou.' : 'Não foi possível salvar o documento. Verifique a conexão e tente de novo.'); }
    if (el.isConnected) { el.disabled = false; el.textContent = 'Salvar em Documentos (PDF)'; }
  });

  /* ---------- botões nas fichas de cliente e processo ---------- */
  A.on('gerar-de-modelo', (el, e) => { e && e.stopPropagation(); A.abrirGerador({modeloId: el.dataset.id}); });
  A.on('gerar-documento', async () => {
    const ctx = S.ui._modalCtx || {};
    if (ctx.tipo === 'cliente') {
      if (!A.cliente(ctx.id) && !(await A.salvarClienteAberto())) return;
      A.closeModal(); A.abrirGerador({clienteId: ctx.id});
    } else if (ctx.tipo === 'processo') {
      if (!A.processo(ctx.id)) { A.toast('Salve o processo antes de gerar documentos.'); return; }
      A.closeModal(); A.abrirGerador({processoId: ctx.id});
    } else A.abrirGerador({});
  });
  A.blocoGerarDocumento = () => A.pode('modelos', 'ver') ? `<div class="box"><h4>Gerar documento</h4><span class="muted" style="font-size:12px">Procuração, contrato, declaração e outros modelos, já preenchidos com os dados desta ficha.</span><div><button type="button" class="btn small" data-action="gerar-documento">Gerar documento a partir de modelo</button></div></div>` : '';
})(window.App);
