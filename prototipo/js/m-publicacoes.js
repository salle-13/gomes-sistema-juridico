/* Módulo Publicações: registro manual, importação (JSON do DJEN ou CSV), tratamento e geração de prazos. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const ST = [['nova','Novas'],['lida','Lidas'],['tratada','Tratadas'],['descartada','Sem providência']];
  A.PUB_LABEL = {nova:'Nova', lida:'Lida', tratada:'Tratada', descartada:'Sem providência'};
  const ui = () => A.ui('publicacoes', {status: 'nova', busca: '', resp: ''});
  const procPorNumero = num => num ? A.col('processos').find(p => p.numero.replace(/\D/g, '') === String(num).replace(/\D/g, '')) : null;

  function lista() { const u = ui();
    return A.col('publicacoes').filter(p => (!u.status || p.status === u.status) && (!u.resp || p.responsavelId === u.resp))
      .filter(p => A.match(u.busca, p.numeroProcesso, A.rotuloPasta(A.processo(p.processoId)), String(A.processo(p.processoId)?.pasta || ''), p.texto, p.orgao, p.tipo, A.cliente(A.processo(p.processoId)?.clienteId)?.nome))
      .sort((a, b) => (b.disponibilizacao || '').localeCompare(a.disponibilizacao || '')); }
  A.exportadores.publicacoes = () => ({titulo: 'Publicações', filtros: 'Situação: ' + (A.PUB_LABEL[ui().status] || 'todas'), linhas: lista(), colunas: [
    {t:'Disponibilização', v:p => p.disponibilizacao, tipo:'date'}, {t:'Publicação', v:p => p.publicacao, tipo:'date'}, {t:'Tribunal', v:p => p.tribunal}, {t:'Órgão', v:p => p.orgao},
    {t:'Pasta', v:p => A.processo(p.processoId)?.pasta || ''}, {t:'Processo', v:p => p.numeroProcesso}, {t:'Cliente', v:p => A.cliente(A.processo(p.processoId)?.clienteId)?.nome || ''}, {t:'Tipo', v:p => p.tipo}, {t:'Situação', v:p => A.PUB_LABEL[p.status]},
    {t:'Responsável', v:p => A.membro(p.responsavelId)?.nome || ''}, {t:'Texto', v:p => (p.texto || '').slice(0, 300)}]});

  function vLista() {
    const u = ui(), arr = lista(), ed = A.pode('publicacoes', 'editar');
    const cont = k => A.col('publicacoes').filter(p => p.status === k).length;
    const cards = arr.map(p => { const pr = A.processo(p.processoId), cli = A.cliente(pr?.clienteId), m = A.membro(p.responsavelId), prz = A.byId('prazos', p.prazoId);
      return `<div class="pcard" style="--c:${p.status === 'nova' ? 'var(--accent)' : 'var(--line)'};cursor:default">
        <div class="meta" style="justify-content:space-between"><span><b class="num">${esc(A.fmt(p.disponibilizacao))}</b> disponibilizada · publicação ${esc(A.fmt(p.publicacao))} · ${esc(p.tribunal || '')} · ${esc(p.orgao || '')}</span><span class="tag">${esc(A.PUB_LABEL[p.status])}</span></div>
        <span class="t">${esc(p.tipo || 'Publicação')} · ${A.processo(p.processoId)?.pasta ? `<span class="evtag2">Pasta ${esc(A.processo(p.processoId).pasta)}</span> ` : ''}<span class="proc">${esc(p.numeroProcesso || 'sem número')}</span>${cli ? ' · ' + esc(cli.nome) : ''}</span>
        <span style="font-size:13px">${esc((p.texto || '').slice(0, 260))}${(p.texto || '').length > 260 ? '…' : ''}</span>
        <span class="meta">${A.avatar(m)} ${esc(m?.nome || 'Sem responsável')}${pr ? '' : ' · <b style="color:var(--warn)">processo não cadastrado</b>'}${prz ? ` · prazo gerado: ${esc(prz.tipo)} até ${esc(A.fmt(prz.vencimento))}` : ''}</span>
        <div class="rowact" style="justify-content:flex-start"><button class="btn small" data-action="abrir-pub" data-id="${esc(p.id)}">Abrir</button>
          ${ed && p.status !== 'tratada' ? `<button class="btn small primary" data-action="pub-prazo" data-id="${esc(p.id)}">Gerar prazo</button>` : ''}
          ${ed && p.status === 'nova' ? `<button class="btn small" data-action="pub-status" data-st="lida" data-id="${esc(p.id)}">Marcar como lida</button>` : ''}
          ${ed && ['nova','lida'].includes(p.status) ? `<button class="btn small" data-action="pub-status" data-st="descartada" data-id="${esc(p.id)}">Sem providência</button>` : ''}</div></div>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Publicações</h2>${A.botoesExport('publicacoes')}${ed ? '<button class="btn" data-action="pub-importar">Importar</button><button class="btn primary" data-action="pub-nova">+ Registrar publicação</button>' : ''}</div>
      <div class="filters"><div class="subtabs">${ST.map(([k, l]) => `<button data-action="pub-filtro" data-st="${k}" aria-pressed="${u.status === k}">${l} <span class="num">${cont(k)}</span></button>`).join('')}<button data-action="pub-filtro" data-st="" aria-pressed="${!u.status}">Todas</button></div>
        <input id="pbBusca" type="search" data-ui="publicacoes.busca" placeholder="Buscar no texto, processo, órgão, cliente…" value="${esc(u.busca)}" style="flex:1 1 240px"><select id="pbResp" data-ui="publicacoes.resp">${A.optsEquipe(u.resp, 'Todos os responsáveis')}</select></div>
      <div class="notice" style="margin:12px 14px 0">As publicações oficiais saem no DJEN (<a href="https://comunica.pje.jus.br/" target="_blank" rel="noopener">comunica.pje.jus.br</a>). Nesta fase, registre-as aqui colando o texto ou importe o arquivo baixado; a captura automática fica para o servidor do sistema definitivo.</div>
      <div class="plist" style="padding:14px">${cards || '<div class="empty">Nenhuma publicação nesta situação.</div>'}</div></section>`;
  }
  A.route('publicacoes', {label: 'Publicações', mod: 'publicacoes', render: vLista, badge: () => A.col('publicacoes').filter(p => p.status === 'nova').length});
  A.on('pub-filtro', el => { ui().status = el.dataset.st; A.render(); });
  A.on('pub-status', async el => { const p = A.byId('publicacoes', el.dataset.id); if (!p) return;
    if (await A.save('publicacoes', Object.assign({}, p, {status: el.dataset.st, tratadaEm: new Date().toISOString(), tratadaPor: S.meId || null}))) { A.toast('Publicação marcada como ' + A.PUB_LABEL[el.dataset.st].toLowerCase() + '.'); if (document.getElementById('fPub')) A.closeModal(); } });
  A.on('pub-prazo', el => { const p = A.byId('publicacoes', el.dataset.id); if (!p) return; A.closeModal();
    A.formPrazo(null, {processoId: p.processoId || '', processo: p.processoId ? '' : (p.numeroProcesso || ''), publicacao: p.publicacao, publicacaoId: p.id, responsavelId: p.responsavelId || '', descricao: (p.texto || '').slice(0, 120)}); });

  /* ---------- registrar / abrir ---------- */
  A.on('pub-nova', () => form(null));
  A.on('abrir-pub', el => { const p = A.byId('publicacoes', el.dataset.id); if (p) form(p); });
  function form(p) {
    const novo = !p, ed = A.pode('publicacoes', 'editar'), ro = ed ? '' : 'disabled';
    p = Object.assign({id: '', disponibilizacao: A.hoje(), publicacao: P.proximoUtil(P.addDays(A.hoje(), 1)), tribunal: 'TJMG', orgao: '', numeroProcesso: '', processoId: '', tipo: 'Intimação', texto: '', oab: '', origem: 'manual', status: 'nova', responsavelId: '', prazoId: ''}, p || {});
    A.modal(`${A.modalHead(novo ? 'Registrar publicação' : 'Publicação', !novo ? `<span class="tag">${esc(A.PUB_LABEL[p.status])}</span>` : '')}
      <form id="fPub"><div class="body">
        ${A.area('pbTexto', 'Texto da publicação (cole aqui)', p.texto, 7, `${ro} placeholder="Cole o teor da intimação. O número do processo é reconhecido automaticamente."`)}
        ${A.inp('pbDisp', 'Data de disponibilização', p.disponibilizacao, `type="date" ${ro}`)}
        ${A.inp('pbPub', 'Data da publicação (dia útil seguinte)', p.publicacao, `type="date" ${ro}`)}
        ${A.inp('pbNum', 'Nº do processo', p.numeroProcesso, ro)}
        ${A.sel('pbProc', 'Processo cadastrado', A.optsProcessos(p.processoId, 'Não vinculado'), '', ro)}
        ${A.inp('pbTrib', 'Tribunal', p.tribunal, ro)}${A.inp('pbOrg', 'Órgão / vara', p.orgao, ro)}
        ${A.inp('pbTipo', 'Tipo', p.tipo, `list="pbTipos" ${ro}`)}<datalist id="pbTipos">${['Intimação','Despacho','Decisão','Sentença','Acórdão','Edital','Certidão','Pauta de julgamento'].map(t => `<option value="${t}">`).join('')}</datalist>
        ${A.sel('pbResp', 'Responsável', A.optsEquipe(p.responsavelId), '', ro)}
        ${A.inp('pbOab', 'OAB intimada', p.oab, `placeholder="MG123456" ${ro}`)}
        <div class="calc" id="pbInfo" style="grid-column:1 / -1"></div>
      </div><footer>${!novo && ed ? '<button type="button" class="btn danger left" data-action="pub-excluir" data-id="' + esc(p.id) + '">Excluir</button>' : ''}
        <button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>
        ${ed && !novo && p.status !== 'tratada' ? `<button type="button" class="btn" data-action="pub-prazo" data-id="${esc(p.id)}">Gerar prazo</button>` : ''}${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`, {wide: true});
    const f = document.getElementById('fPub'), info = document.getElementById('pbInfo');
    const detectar = () => { const m = (f.pbTexto.value.match(A.CNJ_RE) || [])[0]; if (m && !f.pbNum.value) f.pbNum.value = m; const pr = procPorNumero(f.pbNum.value);
      if (pr) { f.pbProc.value = pr.id; if (!f.pbResp.value) f.pbResp.value = pr.responsavelId || ''; if (!f.pbOrg.value) f.pbOrg.value = [pr.vara, pr.comarca].filter(Boolean).join(' de '); info.innerHTML = 'Processo reconhecido: <b>' + esc(pr.numero) + '</b> · ' + esc(A.cliente(pr.clienteId)?.nome || ''); }
      else info.innerHTML = f.pbNum.value ? 'Este número ainda não está cadastrado em Processos. Você pode salvar mesmo assim e cadastrar o processo depois.' : 'Cole o texto: o número do processo no padrão CNJ é preenchido automaticamente.'; };
    f.pbTexto.addEventListener('input', detectar); f.pbNum.addEventListener('input', detectar);
    f.pbDisp.addEventListener('input', () => { if (f.pbDisp.value) f.pbPub.value = P.proximoUtil(P.addDays(f.pbDisp.value, 1)); });
    detectar();
    f.addEventListener('submit', async e => { e.preventDefault(); if (!ed) return;
      const obj = Object.assign({}, p, {texto: f.pbTexto.value.trim(), disponibilizacao: f.pbDisp.value, publicacao: f.pbPub.value, numeroProcesso: f.pbNum.value.trim(), processoId: f.pbProc.value, tribunal: f.pbTrib.value.trim(), orgao: f.pbOrg.value.trim(), tipo: f.pbTipo.value.trim(), responsavelId: f.pbResp.value, oab: f.pbOab.value.trim()});
      if (!obj.texto) { A.toast('Cole o texto da publicação.'); return; }
      if (await A.save('publicacoes', obj)) { A.closeModal(); A.toast('Publicação salva.'); } });
  }
  A.on('pub-excluir', el => { const id = el.dataset.id; A.confirm('Excluir publicação', 'A publicação será apagada. Prazos já gerados a partir dela continuam na agenda.', 'Excluir', async () => { if (await A.remove('publicacoes', id)) A.toast('Publicação excluída.'); }); });

  /* ---------- importação ---------- */
  A.on('pub-importar', () => {
    A.modal(`${A.modalHead('Importar publicações')}<div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px">
      <p class="muted" style="margin:0">Aceita o <b>JSON da consulta do DJEN</b> (lista de comunicações) ou uma <b>planilha CSV</b> com as colunas: data;tribunal;orgao;processo;tipo;texto. Publicações repetidas são ignoradas.</p>
      <input type="file" id="impArq" accept=".json,.csv,.txt"><textarea id="impTxt" rows="8" placeholder="…ou cole o conteúdo aqui"></textarea>
      <div id="impPrev" class="muted" style="font-size:12.5px"></div></div>
      <footer><button class="btn" data-action="modal-fechar">Cancelar</button><button class="btn primary" data-action="pub-importar-ok">Importar</button></footer>`);
    document.getElementById('impArq').addEventListener('change', async e => { const f = e.target.files[0]; if (f) { document.getElementById('impTxt').value = await f.text(); prever(); } });
    document.getElementById('impTxt').addEventListener('input', prever);
  });
  function parse(txt) {
    txt = (txt || '').trim(); if (!txt) return [];
    if (txt[0] === '{' || txt[0] === '[') { let j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.items || j.comunicacoes || j.data || []);
      return arr.map(it => ({disponibilizacao: String(it.data_disponibilizacao || it.datadisponibilizacao || it.dataDisponibilizacao || '').slice(0, 10), tribunal: it.siglaTribunal || it.tribunal || '',
        orgao: it.nomeOrgao || it.orgao || '', numeroProcesso: it.numeroprocessocommascara || it.numero_processo || it.numeroProcesso || '', tipo: it.tipoComunicacao || it.tipoDocumento || 'Intimação', texto: it.texto || ''})); }
    const linhas = txt.split(/\r?\n/).filter(Boolean); const sep = linhas[0].includes(';') ? ';' : ','; const ini = /data/i.test(linhas[0]) ? 1 : 0;
    return linhas.slice(ini).map(l => { const c = l.split(sep); let d = (c[0] || '').trim(); if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) d = d.split('/').reverse().join('-');
      return {disponibilizacao: d, tribunal: (c[1] || '').trim(), orgao: (c[2] || '').trim(), numeroProcesso: (c[3] || '').trim(), tipo: (c[4] || 'Intimação').trim(), texto: c.slice(5).join(sep).replace(/^"|"$/g, '').trim()}; });
  }
  const chave = p => (p.numeroProcesso || '').replace(/\D/g, '') + '|' + p.disponibilizacao + '|' + (p.texto || '').slice(0, 80);
  function prever() { const el = document.getElementById('impPrev'); try { const itens = parse(document.getElementById('impTxt').value); const ex = new Set(A.col('publicacoes').map(chave));
    const novos = itens.filter(i => i.disponibilizacao && i.texto && !ex.has(chave(i))); el.textContent = itens.length ? `${itens.length} encontrada(s), ${novos.length} nova(s) para importar.` : ''; } catch (e) { el.textContent = 'Não consegui ler esse conteúdo. Confira se é o JSON do DJEN ou um CSV com as colunas indicadas.'; } }
  A.on('pub-importar-ok', async () => {
    let itens; try { itens = parse(document.getElementById('impTxt').value); } catch (e) { A.toast('Conteúdo inválido.'); return; }
    const ex = new Set(A.col('publicacoes').map(chave)); let n = 0;
    for (const i of itens) { if (!i.disponibilizacao || !i.texto || ex.has(chave(i))) continue; const pr = procPorNumero(i.numeroProcesso) || procPorNumero((i.texto.match(A.CNJ_RE) || [])[0]);
      const ok = await A.save('publicacoes', Object.assign(i, {publicacao: P.proximoUtil(P.addDays(i.disponibilizacao, 1)), processoId: pr ? pr.id : '', numeroProcesso: i.numeroProcesso || (pr ? pr.numero : ''), responsavelId: pr ? pr.responsavelId : '', origem: 'importacao', status: 'nova', prazoId: '', oab: ''}));
      if (ok) { n++; ex.add(chave(i)); } }
    A.closeModal(); A.toast(n ? n + ' publicação(ões) importada(s).' : 'Nada novo para importar.'); ui().status = 'nova'; A.go('publicacoes');
  });
})(window.App);
