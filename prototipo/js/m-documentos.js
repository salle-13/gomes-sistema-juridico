/* Módulo Documentos: arquivo central e bloco de documentos usado nas fichas de cliente e processo. */
(function (A) {
  const S = A.S, esc = A.esc;
  A.CATS_DOC = ['Documento pessoal (RG/CNH/CPF)','Comprovante de residência','Contrato','Procuração','Provas','Documentos trabalhistas (CTPS, holerites)','Laudo / atestado','Petição / peça','Decisão / sentença','Guia / comprovante de custas','Nota fiscal / recibo','Modelo do escritório','Outros'];
  const TIPOS_OK = {pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', txt:'text/plain', csv:'text/csv', mp4:'video/mp4'};
  const ui = () => A.ui('documentos', {busca: '', cat: '', cli: '', proc: ''});
  const icone = ct => { ct = ct || ''; return ct.includes('pdf') ? 'PDF' : ct.startsWith('image/') ? 'IMG' : ct.startsWith('video/') ? 'VÍD' : ct.includes('csv') ? 'CSV' : 'TXT'; };
  const ordenados = arr => arr.slice().sort((a, b) => String(b.enviadoEm || '').localeCompare(String(a.enviadoEm || '')));

  function linha(d, contexto) {
    const c = A.cliente(d.clienteId), p = A.processo(d.processoId), ed = A.pode('documentos', 'editar');
    return `<div class="doc"><span class="ft">${icone(d.contentType)}</span><div style="min-width:0"><a href="/_blob/${esc(d.assetId)}" target="_blank" rel="noopener">${esc(d.nome)}</a>
      <small>${esc(d.categoria || 'Outros')} · ${esc(A.tamanho(d.sizeBytes))} · ${esc(d.enviadoPor ? A.nomeDe(d.enviadoPor) : 'Equipe')}, ${esc(A.quando(d.enviadoEm))}${contexto ? ' · ' + esc([c?.nome, p ? A.rotuloProcesso(p) : ''].filter(Boolean).join(' · ') || 'Documento geral') : ''}</small></div>
      ${ed ? `<button type="button" class="btn small" data-action="doc-excluir" data-id="${esc(d.id)}" aria-label="Excluir ${esc(d.nome)}">Excluir</button>` : '<span></span>'}</div>`;
  }
  function upload(alvo) { // alvo: {clienteId, processoId} ou {sel:true}
    if (!A.pode('documentos', 'editar')) return '';
    if (S.mode === 'local') return '<div class="muted" style="font-size:12px">No modo local não é possível anexar arquivos. Abra o sistema compartilhado para enviar documentos.</div>';
    if (!S.assets) return '<div class="muted" style="font-size:12px">Seu acesso não permite enviar arquivos. Peça ao dono do sistema para liberar envio (Editor, ou Colaborador com envio liberado).</div>';
    const k = A.uid().slice(0, 8);
    return `<div class="drop" data-drop="1" data-cli="${esc(alvo.clienteId || '')}" data-proc="${esc(alvo.processoId || '')}" data-sel="${alvo.sel ? 1 : ''}">
      <select id="upCat-${k}" aria-label="Tipo de documento">${A.CATS_DOC.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <label class="btn small primary" style="display:inline-flex;align-items:center">Escolher arquivos<input type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.mp4" data-onchange="doc-upload"></label>
      <span class="muted" style="font-size:12px">ou arraste aqui · PDF, imagem, TXT/CSV até 20 MB</span><span class="upstatus muted" style="font-size:12px;flex-basis:100%"></span></div>`;
  }
  A.blocoDocumentos = function (alvo) {
    const ds = ordenados(A.col('documentos').filter(d => alvo.processoId ? d.processoId === alvo.processoId : d.clienteId === alvo.clienteId));
    return `<div class="doclist">${ds.map(d => linha(d, false)).join('') || '<span class="muted" style="font-size:12px">Nenhum documento anexado.</span>'}</div>${upload(alvo)}`;
  };

  async function enviar(files, drop) {
    if (!S.assets) { A.toast('Envio de arquivos indisponível para seu acesso.'); return; }
    let clienteId = drop.dataset.cli || '', processoId = drop.dataset.proc || '';
    if (drop.dataset.sel) { clienteId = A.v('docCli'); processoId = A.v('docProc'); if (processoId && !clienteId) clienteId = A.processo(processoId)?.clienteId || ''; }
    const ctx = S.ui._modalCtx;
    if (ctx && ctx.tipo === 'cliente' && clienteId === ctx.id && !A.cliente(clienteId)) { if (!(await A.salvarClienteAberto())) return; }
    if (ctx && ctx.tipo === 'processo' && processoId === ctx.id && !A.processo(processoId)) { A.toast('Salve o processo antes de anexar documentos.'); return; }
    const cat = drop.querySelector('select')?.value || 'Outros', st = drop.querySelector('.upstatus'); let ok = 0;
    for (const f of [...files]) {
      const ext = (f.name.split('.').pop() || '').toLowerCase(), tipo = Object.values(TIPOS_OK).includes(f.type) ? f.type : TIPOS_OK[ext];
      if (!tipo) { A.toast(`“${f.name}” não é aceito. Salve documentos do Word como PDF antes de enviar.`); continue; }
      if (f.size > 20 * 1048576) { A.toast(`“${f.name}” passa de 20 MB.`); continue; }
      if (st) st.textContent = 'Enviando ' + f.name + '…';
      try { const r = await S.assets.upload(f, {type: tipo});
        if (await A.save('documentos', {nome: f.name, categoria: cat, assetId: r.id, contentType: r.contentType, sizeBytes: r.sizeBytes, clienteId: clienteId || null, processoId: processoId || null, enviadoPor: S.meId || null, enviadoEm: new Date().toISOString()})) ok++; }
      catch (e) { const c = e && e.code; A.toast(c === 'too_large' ? `“${f.name}” é grande demais.` : c === 'unsupported_type' ? `Formato de “${f.name}” não aceito.` : c === 'quota_or_state' ? 'O espaço de armazenamento acabou.' : `Não foi possível enviar “${f.name}”.`); }
    }
    if (st) st.textContent = ok ? ok + ' arquivo(s) enviado(s).' : '';
    if (ok && ctx && ctx.tipo === 'cliente' && clienteId === ctx.id) await A.salvarClienteAberto(ok + ' documento(s) anexado(s).');
  }
  A.on('doc-upload', el => { const drop = el.closest('.drop'); if (el.files && el.files.length) enviar(el.files, drop); el.value = ''; });
  document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('.drop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('.drop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer?.files?.length) enviar(e.dataTransfer.files, d); });
  A.on('doc-excluir', async el => {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Confirmar'; el.classList.add('danger'); setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = 'Excluir'; el.classList.remove('danger'); } }, 4000); return; }
    const d = A.byId('documentos', el.dataset.id); if (!d) return;
    if (await A.remove('documentos', d.id)) { if (S.assets && d.assetId) { try { await S.assets.delete(d.assetId); } catch (e) {} } A.toast('Documento excluído.'); }
  });

  function lista() { const u = ui();
    return ordenados(A.col('documentos').filter(d => (!u.cat || d.categoria === u.cat) && (!u.cli || (u.cli === 'geral' ? !d.clienteId && !d.processoId : d.clienteId === u.cli)) && (!u.proc || d.processoId === u.proc))
      .filter(d => A.match(u.busca, d.nome, d.categoria, A.cliente(d.clienteId)?.nome, A.processo(d.processoId)?.numero, A.rotuloPasta(A.processo(d.processoId))))); }
  A.exportadores.documentos = () => ({titulo: 'Documentos', linhas: lista(), colunas: [{t:'Arquivo', v:d => d.nome}, {t:'Tipo', v:d => d.categoria}, {t:'Cliente', v:d => A.cliente(d.clienteId)?.nome || ''}, {t:'Processo', v:d => A.rotuloProcId(d.processoId)},
    {t:'Enviado por', v:d => d.enviadoPor ? A.nomeDe(d.enviadoPor) : ''}, {t:'Enviado em', v:d => String(d.enviadoEm || '').slice(0, 10), tipo:'date'}, {t:'Tamanho', v:d => A.tamanho(d.sizeBytes)}]});
  function vDocs() {
    const u = ui(), arr = lista();
    return `<section class="panel"><div class="vhead"><h2>Documentos</h2><span class="muted num">${arr.length} de ${A.col('documentos').length}</span>${A.botoesExport('documentos')}</div>
      ${A.pode('documentos', 'editar') ? `<div class="filters" style="flex-direction:column;align-items:stretch"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><strong style="font-size:13px">Enviar para:</strong>
        <select id="docCli" aria-label="Cliente">${A.optsClientes('', 'Documento geral do escritório')}</select><select id="docProc" aria-label="Processo">${A.optsProcessos('', 'Sem processo')}</select></div>${upload({sel: true})}</div>` : ''}
      <div class="filters"><input id="dBusca" type="search" data-ui="documentos.busca" placeholder="Buscar arquivo, cliente ou processo…" value="${esc(u.busca)}" style="flex:1 1 240px">
        <select id="dCat" data-ui="documentos.cat">${A.opts(A.CATS_DOC, u.cat, 'Todos os tipos')}</select>
        <select id="dCli" data-ui="documentos.cli"><option value="">Todos os clientes</option><option value="geral"${u.cli === 'geral' ? ' selected' : ''}>Documentos gerais</option>${A.col('clientes').map(c => `<option value="${esc(c.id)}"${u.cli === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
        <select id="dProc" data-ui="documentos.proc">${A.optsProcessos(u.proc, 'Todos os processos')}</select></div>
      <div class="doclist" style="padding:14px">${arr.map(d => linha(d, true)).join('') || '<div class="empty">Nenhum documento ainda. Envie acima ou pela ficha de um cliente ou processo.</div>'}</div></section>`;
  }
  A.route('documentos', {label: 'Documentos', mod: 'documentos', render: vDocs});
})(window.App);
