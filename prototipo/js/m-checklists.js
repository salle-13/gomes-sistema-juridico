/* Checklists documentais.
   - checklist_modelos: {nome, area, tipoDemanda, itens: [{nome, obrigatorio}], ativo}. Tela em Gestão › Checklists,
     só para quem edita "Equipe, permissões e configurações".
   - checklist_itens: um registro por documento do cliente {clienteId, processoId, modeloId, ordem, nome, obrigatorio, situacao,
     documentoId, recebidoPor, recebidoEm, conferidoPor, conferidoEm, obs, situacaoDesde}. Cada mudança de situação
     (e de documento vinculado) vai para o histórico pelo A.save.
   - A.blocoChecklist(cliente): bloco da ficha do cliente (aplicar modelo, mudar situação, vincular documento já enviado).
   Documentação completa = todos os itens obrigatórios aprovados (Regras.documentacaoCompleta). */
(function (A) {
  const S = A.S, R = A.R, esc = A.esc;
  const SIT = [['pendente', 'Pendente'], ['solicitado', 'Solicitado'], ['recebido', 'Recebido'], ['conferencia', 'Em conferência'], ['aprovado', 'Aprovado'], ['rejeitado', 'Rejeitado'], ['substituir', 'Substituir']];
  const SIT_L = A.SIT_CHECKLIST = Object.fromEntries(SIT);
  const ui = () => A.ui('checklists', {busca: ''});

  /* ---------- tela de modelos ---------- */
  function vModelos() {
    const u = ui(), arr = A.col('checklist_modelos').filter(m => A.match(u.busca, m.nome, m.area, m.tipoDemanda, (m.itens || []).map(i => i.nome).join(' ')))
      .sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return `<section class="panel"><div class="vhead"><h2>Checklists de documentos</h2><span class="muted num">${arr.length} modelo(s)</span><button class="btn primary" data-action="chkm-novo">+ Novo modelo</button></div>
      <div class="filters"><input id="chkBusca" type="search" data-ui="checklists.busca" placeholder="Buscar modelo, área, tipo de demanda ou documento…" value="${esc(u.busca)}" style="flex:1 1 260px"></div>
      <div class="tablewrap"><table><thead><tr><th>Modelo</th><th>Área</th><th>Tipo de demanda</th><th class="num">Itens</th><th class="num">Obrigatórios</th><th class="num">Em uso</th><th>Situação</th></tr></thead><tbody>
      ${arr.map(m => { const it = m.itens || [], uso = new Set(A.col('checklist_itens').filter(i => i.modeloId === m.id).map(i => i.clienteId)).size;
        return `<tr class="row-click" data-action="chkm-editar" data-id="${esc(m.id)}"${m.ativo === false ? ' style="opacity:.6"' : ''}><td><b>${esc(m.nome)}</b></td><td>${esc(m.area || '—')}</td><td>${esc(m.tipoDemanda || '—')}</td>
          <td class="num">${it.length}</td><td class="num">${it.filter(i => i.obrigatorio).length}</td><td class="num">${uso ? uso + ' cliente(s)' : '—'}</td><td>${m.ativo === false ? 'Inativo' : 'Ativo'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhum modelo. Crie o primeiro com “+ Novo modelo”.</td></tr>'}</tbody></table></div>
      <div class="legend">Na ficha do cliente, “Aplicar checklist” sugere o modelo pela área e pelo tipo de demanda. Mudar um modelo não altera checklists já aplicados.</div></section>`;
  }
  A.route('checklists', {label: 'Checklists', mod: 'equipe', nivel: 'editar', render: vModelos});

  const linhaItem = (i, ro) => `<div class="chkm-item"><input class="chkm-nome" value="${esc(i.nome || '')}" placeholder="Nome do documento" aria-label="Documento" ${ro}>
    <label class="chk"><input type="checkbox" class="chkm-obr"${i.obrigatorio ? ' checked' : ''} ${ro}> obrigatório</label>${ro ? '' : '<button type="button" class="iconbtn" data-action="chkm-rm-item" aria-label="Remover item">×</button>'}</div>`;
  function form(m) {
    const novo = !m, ed = A.pode('equipe', 'editar'), ro = ed ? '' : 'disabled';
    m = Object.assign({id: A.uid(), nome: '', area: '', tipoDemanda: '', itens: [{nome: '', obrigatorio: true}], ativo: true}, m ? JSON.parse(JSON.stringify(m)) : {});
    A.modal(`${A.modalHead(novo ? 'Novo modelo de checklist' : 'Modelo de checklist')}<form id="fChkModelo"><div class="body">
      ${A.inp('cmNome', 'Nome', m.nome, `required ${ro} placeholder="Ex.: Aposentadoria por idade rural"`, 'full')}
      ${A.sel('cmArea', 'Área', A.opts(A.AREAS || [], m.area, 'Qualquer área'), '', ro)}
      ${A.inp('cmTipo', 'Tipo de demanda', m.tipoDemanda, `${ro} list="tiposDemanda" placeholder="Ex.: Aposentadoria rural"`)}${A.datalistDemandas ? A.datalistDemandas() : ''}
      ${A.sel('cmAtivo', 'Situação', A.opts([['1', 'Ativo (aparece em “Aplicar checklist”)'], ['0', 'Inativo']], m.ativo === false ? '0' : '1'), 'full', ro)}
      ${A.field('cmItens', 'Documentos', `<div id="cmItens" class="chkm-itens">${(m.itens || []).map(i => linhaItem(i, ro)).join('')}</div>${ed ? '<button type="button" class="btn small" data-action="chkm-add-item">+ Documento</button>' : ''}`, 'full')}
    </div><footer>${!novo && ed ? '<button type="button" class="btn danger left" data-action="chkm-excluir">Excluir</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`, {wide: true});
    S.ui._modalCtx = {tipo: 'chkmodelo', id: m.id, modelo: m};
    document.getElementById('fChkModelo').addEventListener('submit', async e => { e.preventDefault(); if (!A.exigir('equipe')) return;
      const itens = [...document.querySelectorAll('#cmItens .chkm-item')].map(r => ({nome: r.querySelector('.chkm-nome').value.trim(), obrigatorio: r.querySelector('.chkm-obr').checked})).filter(i => i.nome);
      const nome = A.v('cmNome'); if (!nome) { A.toast('Informe o nome do modelo.'); return; } if (!itens.length) { A.toast('Inclua ao menos um documento.'); return; }
      if (await A.save('checklist_modelos', Object.assign({}, m, {nome, area: A.v('cmArea'), tipoDemanda: A.v('cmTipo'), ativo: A.v('cmAtivo') === '1', itens}))) { A.closeModal(); A.toast('Modelo salvo.'); }
    });
  }
  A.on('chkm-novo', () => { if (A.exigir('equipe')) form(null); });
  A.on('chkm-editar', el => { const m = A.byId('checklist_modelos', el.dataset.id); if (m) form(m); });
  A.on('chkm-add-item', () => { const box = document.getElementById('cmItens'); if (!box) return; box.insertAdjacentHTML('beforeend', linhaItem({nome: '', obrigatorio: true}, '')); box.lastElementChild.querySelector('input').focus(); });
  A.on('chkm-rm-item', el => { const r = el.closest('.chkm-item'); if (r) r.remove(); });
  A.on('chkm-excluir', () => { if (!A.exigir('equipe')) return; const ctx = S.ui._modalCtx; if (!ctx || ctx.tipo !== 'chkmodelo') return; const id = ctx.id;
    const uso = A.col('checklist_itens').filter(i => i.modeloId === id).length;
    A.confirm('Excluir modelo', uso ? `Há ${uso} item(ns) de checklist de clientes criados com este modelo; eles continuam nas fichas. Para só tirar o modelo da lista, prefira “Inativo”.` : 'O modelo será apagado.', 'Excluir', async () => {
      if (A.exigir('equipe') && await A.remove('checklist_modelos', id)) A.toast('Modelo excluído.'); }); });

  /* ---------- bloco da ficha do cliente ---------- */
  const itensDe = clienteId => A.doIdx('checklist_itens', 'clienteId', clienteId).slice().sort((a, b) => String(a.modeloId || '~').localeCompare(String(b.modeloId || '~')) || (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  A.checklistDe = itensDe;
  A.documentacaoCompleta = clienteId => R.documentacaoCompleta(itensDe(clienteId));
  A.blocoChecklist = function (c) {
    const ed = A.pode('clientes', 'editar') && c.status !== 'recusado', ro = ed ? '' : 'disabled', itens = itensDe(c.id);
    const obr = itens.filter(i => i.obrigatorio), ok = obr.filter(i => i.situacao === 'aprovado').length, completa = R.documentacaoCompleta(itens);
    const docs = A.pode('documentos', 'ver') ? A.doIdx('documentos', 'clienteId', c.id) : [];
    const sug = R.sugerirModelos(A.col('checklist_modelos'), c);
    const resumo = !itens.length ? '<span class="muted" style="font-size:12px">Nenhum checklist aplicado.</span>'
      : completa ? '<span class="tag ok">Documentação completa</span>' : `<span class="tag${ok < obr.length ? ' alta' : ''}">${ok} de ${obr.length} obrigatório(s) aprovado(s)</span>`;
    const linha = i => { const d = i.documentoId ? A.byId('documentos', i.documentoId) : null;
      return `<div class="chk-i s-${esc(i.situacao)}"><div class="chk-n"><b>${esc(i.nome)}</b>${i.obrigatorio ? ' <span class="muted">(obrigatório)</span>' : ''}
          <small class="muted">${esc([i.recebidoEm ? 'recebido ' + A.quando(i.recebidoEm) + (i.recebidoPor ? ' por ' + A.nomeDe(i.recebidoPor) : '') : '', i.conferidoEm ? 'conferido ' + A.quando(i.conferidoEm) + (i.conferidoPor ? ' por ' + A.nomeDe(i.conferidoPor) : '') : ''].filter(Boolean).join(' · '))}</small></div>
        <select data-onchange="chk-situacao" data-id="${esc(i.id)}" aria-label="Situação de ${esc(i.nome)}" ${ro}>${A.opts(SIT, i.situacao)}</select>
        ${A.pode('documentos', 'ver') ? `<select data-onchange="chk-doc" data-id="${esc(i.id)}" aria-label="Documento de ${esc(i.nome)}" ${ro}><option value="">${docs.length ? 'Vincular documento…' : 'Nenhum documento enviado'}</option>${docs.map(x => `<option value="${esc(x.id)}"${x.id === i.documentoId ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}${d || !i.documentoId ? '' : '<option value="' + esc(i.documentoId) + '" selected>(documento removido)</option>'}</select>` : ''}
        <input value="${esc(i.obs || '')}" placeholder="Observação" data-onchange="chk-obs" data-id="${esc(i.id)}" aria-label="Observação de ${esc(i.nome)}" ${ro}></div>`; };
    return `<div class="chk-res">${resumo}</div><div class="chk-lista">${itens.map(linha).join('')}</div>
      ${ed ? `<div class="chk-acoes"><select id="chkModelo" aria-label="Modelo de checklist">${sug.length ? sug.map((s, n) => `<option value="${esc(s.modelo.id)}">${esc(s.modelo.nome)}${n === 0 && s.pontos > 0 ? ' (sugerido)' : ''}</option>`).join('') : '<option value="">Nenhum modelo ativo</option>'}</select>
        <button type="button" class="btn small" data-action="chk-aplicar"${sug.length ? '' : ' disabled'}>Aplicar checklist</button>
        <input id="chkNovoItem" placeholder="Documento avulso" aria-label="Documento avulso" style="flex:1 1 140px"><button type="button" class="btn small" data-action="chk-item-novo">+ Item</button></div>` : ''}`;
  };

  const clienteAberto = () => { const ctx = S.ui._modalCtx; return ctx && ctx.tipo === 'cliente' ? ctx.id : ''; };
  async function garantirCliente() { const id = clienteAberto(); if (!id) return null; if (A.cliente(id)) return id; return (await A.salvarClienteAberto()) ? id : null; }
  A.on('chk-aplicar', async () => { if (!A.exigir('clientes')) return; const id = await garantirCliente(); if (!id) return;
    const m = A.byId('checklist_modelos', A.v('chkModelo')); if (!m) return;
    const novos = R.itensDoModelo(m, id, new Date().toISOString()).filter(i => !A.byId('checklist_itens', i.id));
    if (!novos.length) { A.toast('Este checklist já foi aplicado a este cliente.'); return; }
    const c = A.cliente(id); if (c && c.exemplo) novos.forEach(i => { i.exemplo = true; });
    for (const i of novos) if (!(await A.save('checklist_itens', i, {semHistorico: true}))) return;
    await A.registrar({entidade: 'clientes', entidadeId: id, acao: 'checklist', texto: `Checklist “${m.nome}” aplicado (${novos.length} documento(s))`});
    A.toast('Checklist aplicado.'); });
  A.on('chk-item-novo', async () => { if (!A.exigir('clientes')) return; const nome = A.v('chkNovoItem'); if (!nome) return; const id = await garantirCliente(); if (!id) return;
    const it = {clienteId: id, processoId: '', modeloId: '', nome: nome.slice(0, 120), obrigatorio: false, situacao: 'pendente', situacaoDesde: new Date().toISOString(), documentoId: '', recebidoPor: null, recebidoEm: null, conferidoPor: null, conferidoEm: null, obs: ''};
    if (A.cliente(id)?.exemplo) it.exemplo = true;
    if (await A.save('checklist_itens', it, {semHistorico: true})) A.registrar({entidade: 'clientes', entidadeId: id, acao: 'checklist', texto: `Documento avulso incluído no checklist: ${it.nome}`}); });
  A.on('chk-situacao', async el => {
    const i = A.byId('checklist_itens', el.dataset.id); if (!i) return; if (!A.exigir('clientes')) { el.value = i.situacao; return; }
    const s = el.value, agora = new Date().toISOString(), me = S.meId || null, antes = A.documentacaoCompleta(i.clienteId);
    const n = Object.assign({}, i, {situacao: s, situacaoDesde: agora});
    if (s === 'pendente' || s === 'solicitado') Object.assign(n, {recebidoEm: null, recebidoPor: null, conferidoEm: null, conferidoPor: null});
    if ((s === 'recebido' || s === 'conferencia') && !i.recebidoEm) Object.assign(n, {recebidoEm: agora, recebidoPor: me});
    if (s === 'recebido') Object.assign(n, {conferidoEm: null, conferidoPor: null});
    if (['aprovado', 'rejeitado', 'substituir'].includes(s)) Object.assign(n, {conferidoEm: agora, conferidoPor: me, recebidoEm: i.recebidoEm || agora, recebidoPor: i.recebidoPor || me});
    if (await A.save('checklist_itens', n) && !antes && A.documentacaoCompleta(i.clienteId)) A.toast('Documentação completa: todos os obrigatórios aprovados.');
  });
  A.on('chk-doc', async el => { const i = A.byId('checklist_itens', el.dataset.id); if (!i) return; if (!A.exigir('clientes')) { el.value = i.documentoId || ''; return; }
    const n = Object.assign({}, i, {documentoId: el.value});
    // Documento novo em item pendente, rejeitado ou a substituir (ou troca de arquivo em item já aprovado) volta para "recebido": precisa de conferência.
    if (el.value && (['pendente', 'solicitado', 'substituir', 'rejeitado'].includes(i.situacao) || (['aprovado', 'conferencia'].includes(i.situacao) && i.documentoId && i.documentoId !== el.value))) Object.assign(n, {situacao: 'recebido', situacaoDesde: new Date().toISOString(), recebidoEm: new Date().toISOString(), recebidoPor: S.meId || null, conferidoEm: null, conferidoPor: null});
    await A.save('checklist_itens', n); });
  A.on('chk-obs', async el => { const i = A.byId('checklist_itens', el.dataset.id); if (!i) return; if (!A.exigir('clientes')) return;
    await A.save('checklist_itens', Object.assign({}, i, {obs: el.value.trim().slice(0, 500)})); });
})(window.App);
