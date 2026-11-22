/* Módulo Publicações: registro manual, importação (JSON do DJEN ou CSV), tratamento e geração de prazos. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const ST = [['nova','Novas'],['lida','Lidas'],['tratada','Tratadas'],['descartada','Sem providência']];
  A.PUB_LABEL = {nova:'Nova', lida:'Lida', tratada:'Tratada', descartada:'Sem providência'};
  const ui = () => A.ui('publicacoes', {status: 'nova', busca: '', resp: ''});
  const procPorNumero = num => { const d = String(num || '').replace(/\D/g, ''); return d ? A.col('processos').find(p => (p.numero || '').replace(/\D/g, '') === d) : null; };

  /* ---------- DJEN: texto limpo, OAB e prazo sugerido ---------- */
  /* O DJEN entrega muitas intimações em HTML (TJMG/eproc, TRF). Converte para texto simples, mantendo as linhas da tabela de partes. */
  A.textoLimpo = function (t) {
    t = String(t || ''); if (!/<[a-z!?/][^>]*>/i.test(t) && !/&[a-z#0-9]+;/i.test(t)) return t.trim();
    let doc; try { doc = new DOMParser().parseFromString(t, 'text/html'); } catch (e) { return t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
    doc.querySelectorAll('head,style,script,meta,title').forEach(n => n.remove());
    doc.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    doc.querySelectorAll('p,div,section,tr,li,h1,h2,h3,h4,header,footer,article,center,table').forEach(n => { n.prepend('\n'); n.append('\n'); });
    doc.querySelectorAll('td,th').forEach(n => n.append(' '));
    return (doc.body ? doc.body.textContent : '').replace(/ /g, ' ').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1].trim()))
      .join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+:\s+/g, ': ').trim();
  };
  /* Chave de OAB comparável: UF + número sem zeros à esquerda (aceita "OAB/MG 181.253", "MG181253", "181253/MG", "9395A/AL"). */
  A.oabChave = function (s) { s = String(s || '').toUpperCase(); const uf = (s.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SE|SP|TO)\b|(?:^|[^A-Z])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SE|SP|TO)(?=\d)/) || []);
    const u = uf[1] || uf[2] || '', n = (s.replace(/\b(OAB)\b/g, '').match(/\d[\d.]*/) || [''])[0].replace(/\D/g, '').replace(/^0+/, ''); return u && n ? u + n : ''; };
  const oabsDoTexto = t => [...String(t || '').matchAll(/OAB[\s/:]*([A-Z]{2})?\s*([\d.]{3,9}[A-Z]?)(?:\s*\/\s*([A-Z]{2}))?/gi)].map(m => A.oabChave((m[1] || m[3] || '') + ' ' + m[2])).filter(Boolean);
  const membroPorOab = () => new Map(A.col('equipe').filter(m => m.oab && m.ativo !== false).map(m => [A.oabChave(m.oab), m]).filter(([k]) => k));
  const EXT = {um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, sessenta: 60, noventa: 90};
  /* Lê no texto um prazo em dias. Só sugere: quem confirma é sempre uma pessoa. */
  A.prazoSugerido = function (texto) { const t = A.textoLimpo(texto).toLowerCase(); let m;
    const re = /(?:prazo(?:\s+(?:comum|sucessivo|preclusivo|improrrog[aá]vel))?\s+(?:de\s+)?(?:at[eé]\s+)?|em\s+(?:at[eé]\s+)?|no\s+prazo\s+de\s+)(\d{1,3}|[a-zçêé]+)\s*(?:\(\s*[a-zçêé\s]+\s*\)\s*)?dias?(\s+[uú]teis|\s+corridos)?/i;
    if ((m = t.match(re))) { const n = /^\d+$/.test(m[1]) ? +m[1] : EXT[m[1]]; if (n && n <= 365) return {dias: n, contagem: /corrid/.test(m[2] || '') ? 'corridos' : 'uteis', trecho: m[0].trim()}; }
    if ((m = t.match(/(\d{1,3})\s*\(\s*[a-zçêé\s]+\)\s*dias?(\s+[uú]teis|\s+corridos)?/))) return {dias: +m[1], contagem: /corrid/.test(m[2] || '') ? 'corridos' : 'uteis', trecho: m[0].trim()};
    if (/prazo\s+legal/.test(t)) return {legal: true, trecho: 'prazo legal'};
    return null; };
  const rotuloSug = s => s ? (s.legal ? 'Prazo legal (definir dias)' : `Prazo sugerido: ${s.dias} dias ${s.contagem === 'corridos' ? 'corridos' : 'úteis'}`) : '';


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
    const cards = arr.map(p => { const pr = A.processo(p.processoId), cli = A.cliente(pr?.clienteId), m = A.membro(p.responsavelId), prz = A.byId('prazos', p.prazoId), txt = A.textoLimpo(p.texto), sug = A.prazoSugerido(txt);
      return `<div class="pcard" style="--c:${p.status === 'nova' ? 'var(--accent)' : 'var(--line)'};cursor:default">
        <div class="meta" style="justify-content:space-between"><span><b class="num">${esc(A.fmt(p.disponibilizacao))}</b> disponibilizada · publicação ${esc(A.fmt(p.publicacao))} · ${esc(p.tribunal || '')} · ${esc(p.orgao || '')}</span><span class="tag">${esc(A.PUB_LABEL[p.status])}</span></div>
        <span class="t">${esc(p.tipo || 'Publicação')} · ${A.processo(p.processoId)?.pasta ? `<span class="evtag2">Pasta ${esc(A.processo(p.processoId).pasta)}</span> ` : ''}<span class="proc">${esc(p.numeroProcesso || 'sem número')}</span>${cli ? ' · ' + esc(cli.nome) : ''}</span>
        <span style="font-size:13px;white-space:pre-line">${esc(txt.slice(0, 320))}${txt.length > 320 ? '…' : ''}</span>${sug && p.status !== 'tratada' && !prz ? `<span class="sugprazo">${esc(rotuloSug(sug))} · “${esc(sug.trecho)}”</span>` : ''}
        <span class="meta">${A.avatar(m)} ${esc(m?.nome || 'Sem responsável')}${pr ? '' : ' · <b style="color:var(--warn)">processo não cadastrado</b>'}${prz ? ` · prazo gerado: ${esc(prz.tipo)} até ${esc(A.fmt(prz.vencimento))}` : ''}</span>
        <div class="rowact" style="justify-content:flex-start"><button class="btn small" data-action="abrir-pub" data-id="${esc(p.id)}">Abrir</button>
          ${ed && p.status !== 'tratada' ? `<button class="btn small primary" data-action="pub-prazo" data-id="${esc(p.id)}">Gerar prazo</button>` : ''}
          ${ed && p.status === 'nova' ? `<button class="btn small" data-action="pub-status" data-st="lida" data-id="${esc(p.id)}">Marcar como lida</button>` : ''}
          ${ed && ['nova','lida'].includes(p.status) ? `<button class="btn small" data-action="pub-status" data-st="descartada" data-id="${esc(p.id)}">Sem providência</button>` : ''}</div></div>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Publicações</h2>${A.botoesExport('publicacoes')}${ed ? '<button class="btn" data-action="pub-djen">Buscar no DJEN</button><button class="btn" data-action="pub-importar">Importar</button><button class="btn primary" data-action="pub-nova">+ Registrar publicação</button>' : ''}</div>
      <div class="filters"><div class="subtabs">${ST.map(([k, l]) => `<button data-action="pub-filtro" data-st="${k}" aria-pressed="${u.status === k}">${l} <span class="num">${cont(k)}</span></button>`).join('')}<button data-action="pub-filtro" data-st="" aria-pressed="${!u.status}">Todas</button></div>
        <input id="pbBusca" type="search" data-ui="publicacoes.busca" placeholder="Buscar no texto, processo, órgão, cliente…" value="${esc(u.busca)}" style="flex:1 1 240px"><select id="pbResp" data-ui="publicacoes.resp">${A.optsEquipe(u.resp, 'Todos os responsáveis')}</select></div>
      <div class="notice" style="margin:12px 14px 0"><span>Use <b>Buscar no DJEN</b> para trazer as publicações de cada advogado(a) pela OAB (<a href="https://comunica.pje.jus.br/" target="_blank" rel="noopener">comunica.pje.jus.br</a>). O sistema limpa o texto, liga ao advogado e ao processo e sugere o prazo; quem confirma o prazo é sempre uma pessoa. A busca automática diária fica para o servidor definitivo.</span></div>
      <div class="plist" style="padding:14px">${cards || '<div class="empty">Nenhuma publicação nesta situação.</div>'}</div></section>`;
  }
  A.route('publicacoes', {label: 'Publicações', mod: 'publicacoes', render: vLista, badge: () => A.col('publicacoes').filter(p => p.status === 'nova').length});
  A.on('pub-filtro', el => { ui().status = el.dataset.st; A.render(); });
  A.on('pub-status', async el => { const p = A.byId('publicacoes', el.dataset.id); if (!p) return;
    if (await A.save('publicacoes', Object.assign({}, p, {status: el.dataset.st, tratadaEm: new Date().toISOString(), tratadaPor: S.meId || null}))) { A.toast('Publicação marcada como ' + A.PUB_LABEL[el.dataset.st].toLowerCase() + '.'); if (document.getElementById('fPub')) A.closeModal(); } });
  A.on('pub-prazo', el => { const p = A.byId('publicacoes', el.dataset.id); if (!p) return; A.closeModal();
    const sug = A.prazoSugerido(p.texto), extra = sug && !sug.legal ? {dias: sug.dias, contagem: sug.contagem} : {};
    A.formPrazo(null, Object.assign({processoId: p.processoId || '', processo: p.processoId ? '' : (p.numeroProcesso || ''), publicacao: p.publicacao, publicacaoId: p.id, responsavelId: p.responsavelId || '', descricao: A.textoLimpo(p.texto).replace(/\s+/g, ' ').slice(0, 120)}, extra));
    if (sug) A.toast(sug.legal ? 'O texto fala em "prazo legal": informe os dias.' : `Dias preenchidos pelo texto (${sug.trecho}). Confira antes de salvar.`); });

  /* ---------- registrar / abrir ---------- */
  A.on('pub-nova', () => form(null));
  A.on('abrir-pub', el => { const p = A.byId('publicacoes', el.dataset.id); if (p) form(p); });
  function form(p) {
    const novo = !p, ed = A.pode('publicacoes', 'editar'), ro = ed ? '' : 'disabled';
    p = Object.assign({id: '', disponibilizacao: A.hoje(), publicacao: P.proximoUtil(P.addDays(A.hoje(), 1)), tribunal: 'TJMG', orgao: '', numeroProcesso: '', processoId: '', tipo: 'Intimação', texto: '', oab: '', origem: 'manual', status: 'nova', responsavelId: '', prazoId: ''}, p || {});
    A.modal(`${A.modalHead(novo ? 'Registrar publicação' : 'Publicação', !novo ? `<span class="tag">${esc(A.PUB_LABEL[p.status])}</span>` : '')}
      <form id="fPub"><div class="body">
        ${A.area('pbTexto', 'Texto da publicação (cole aqui)', A.textoLimpo(p.texto), 9, `${ro} placeholder="Cole o teor da intimação. O número do processo é reconhecido automaticamente."`)}
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
      return arr.map(it => ({djenId: String(it.id || it.hash || ''), oabs: [...new Set([...(it.destinatarioadvogados || it.destinatarioAdvogados || []).map(d => { const a = d.advogado || d; return A.oabChave((a.uf_oab || a.ufOab || '') + ' ' + (a.numero_oab || a.numeroOab || '')); }), ...oabsDoTexto(A.textoLimpo(it.texto))].filter(Boolean))], disponibilizacao: String(it.data_disponibilizacao || it.datadisponibilizacao || it.dataDisponibilizacao || '').slice(0, 10), tribunal: it.siglaTribunal || it.tribunal || '',
        orgao: it.nomeOrgao || it.orgao || '', numeroProcesso: it.numeroprocessocommascara || it.numero_processo || it.numeroProcesso || '', tipo: it.tipoComunicacao || it.tipoDocumento || 'Intimação', texto: A.textoLimpo(it.texto || ''), link: it.link || ''})); }
    const linhas = txt.split(/\r?\n/).filter(Boolean); const sep = linhas[0].includes(';') ? ';' : ','; const ini = /data/i.test(linhas[0]) ? 1 : 0;
    return linhas.slice(ini).map(l => { const c = l.split(sep); let d = (c[0] || '').trim(); if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) d = d.split('/').reverse().join('-');
      return {disponibilizacao: d, tribunal: (c[1] || '').trim(), orgao: (c[2] || '').trim(), numeroProcesso: (c[3] || '').trim(), tipo: (c[4] || 'Intimação').trim(), texto: c.slice(5).join(sep).replace(/^"|"$/g, '').trim()}; });
  }
  const chave = p => p.djenId ? 'djen:' + p.djenId : (p.numeroProcesso || '').replace(/\D/g, '') + '|' + p.disponibilizacao + '|' + A.textoLimpo(p.texto).replace(/\s+/g, ' ').slice(0, 80);
  const chaves = () => { const s = new Set(); for (const p of A.col('publicacoes')) { s.add(chave(p)); s.add(chave(Object.assign({}, p, {djenId: ''}))); } return s; };
  function prever() { const el = document.getElementById('impPrev'); try { const itens = parse(document.getElementById('impTxt').value); const ex = chaves();
    const novos = itens.filter(i => i.disponibilizacao && i.texto && !ex.has(chave(i)) && !ex.has(chave(Object.assign({}, i, {djenId: ''})))); el.textContent = itens.length ? `${itens.length} encontrada(s), ${novos.length} nova(s) para importar.` : ''; } catch (e) { el.textContent = 'Não consegui ler esse conteúdo. Confira se é o JSON do DJEN ou um CSV com as colunas indicadas.'; } }
  /* Grava as publicações lidas (JSON do DJEN ou CSV): sem duplicar, ligando ao processo pelo número e ao advogado pela OAB. */
  async function importarItens(itens, progresso) {
    const ex = chaves(), porOab = membroPorOab(); let n = 0, semResp = 0; const lote = [];
    for (const i of itens) { if (!i.disponibilizacao || !i.texto || ex.has(chave(i)) || ex.has(chave(Object.assign({}, i, {djenId: ''})))) continue;
      const pr = procPorNumero(i.numeroProcesso) || procPorNumero((i.texto.match(A.CNJ_RE) || [])[0]);
      const oabs = i.oabs || oabsDoTexto(i.texto), adv = oabs.map(k => porOab.get(k)).find(Boolean) || (i.buscaAdv ? A.membro(i.buscaAdv) : null);
      const obj = Object.assign({}, i, {id: A.uid(), publicacao: P.proximoUtil(P.addDays(i.disponibilizacao, 1)), processoId: pr ? pr.id : '', numeroProcesso: i.numeroProcesso || (pr ? pr.numero : ''),
        responsavelId: (pr && pr.responsavelId) || (adv ? adv.id : ''), oab: adv ? A.oabChave(adv.oab) : (oabs[0] || ''), oabs, origem: i.djenId ? 'djen' : 'importacao', status: 'nova', prazoId: ''});
      if (!obj.responsavelId) semResp++; lote.push(obj); ex.add(chave(i)); }
    if (lote.length && !(await A.saveLote('publicacoes', lote, progresso))) return null;
    n = lote.length; return {n, semResp};
  }
  A.on('pub-importar-ok', async () => {
    let itens; try { itens = parse(document.getElementById('impTxt').value); } catch (e) { A.toast('Conteúdo inválido.'); return; }
    const r = await importarItens(itens); if (!r) return;
    A.closeModal(); A.toast(r.n ? `${r.n} publicação(ões) importada(s)${r.semResp ? `; ${r.semResp} sem responsável (cadastre a OAB na Equipe)` : ''}.` : 'Nada novo para importar.'); ui().status = 'nova'; A.go('publicacoes');
  });

  /* ---------- Buscar no DJEN ---------- */
  const API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  const urlDjen = (oabKey, ini, fim, pag) => { const uf = oabKey.slice(0, 2), num = oabKey.slice(2);
    return `${API}?numeroOab=${num}&ufOab=${uf}&dataDisponibilizacaoInicio=${ini}&dataDisponibilizacaoFim=${fim}&itensPorPagina=100&pagina=${pag}`; };
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  A.on('pub-djen', () => {
    const advs = A.col('equipe').filter(m => m.ativo !== false && A.oabChave(m.oab));
    const h = A.hoje();
    A.modal(`${A.modalHead('Buscar no DJEN')}<div class="body" style="display:block">
      ${advs.length ? `<div class="two"><label class="field"><span>Advogado(a)</span><select id="djAdv">${advs.length > 1 ? '<option value="*">Todos com OAB cadastrada</option>' : ''}${advs.map(m => `<option value="${esc(m.id)}">${esc(m.nome)} · ${esc(m.oab)}</option>`).join('')}</select></label>
        <label class="field"><span>De</span><input id="djIni" type="date" value="${P.addDays(h, -7)}"></label><label class="field"><span>Até</span><input id="djFim" type="date" value="${h}"></label></div>
        <p class="muted" style="font-size:12.5px">A consulta é pública (API do CNJ). Publicações já importadas não entram de novo.</p>
        <div id="djRes" class="djres"></div>`
      : '<p>Nenhum membro da Equipe tem OAB cadastrada. Cadastre em <b>Equipe e permissões</b> (campo OAB, ex.: OAB/MG 181.253).</p>'}
    </div><footer>${A.col('publicacoes').some(p => p.origem === 'djen') ? `<button class="btn danger left" data-action="pub-djen-desfazer">Apagar as ${A.col('publicacoes').filter(p => p.origem === 'djen').length} importadas do DJEN</button>` : ''}<button class="btn" data-action="modal-fechar">Fechar</button>${advs.length ? '<button class="btn primary" data-action="pub-djen-buscar">Buscar</button>' : ''}</footer>`, {wide: true});
  });
  A.on('pub-djen-buscar', async el => {
    const res = document.getElementById('djRes'), ini = document.getElementById('djIni').value, fim = document.getElementById('djFim').value, sel = document.getElementById('djAdv').value;
    if (!ini || !fim || ini > fim) { A.toast('Confira o período.'); return; }
    const advs = A.col('equipe').filter(m => m.ativo !== false && A.oabChave(m.oab) && (sel === '*' || m.id === sel));
    el.disabled = true; const itens = [], falhas = []; let bloqueado = false;
    for (const [k, m] of advs.entries()) { const oab = A.oabChave(m.oab);
      for (let pag = 1; pag <= 100; pag++) { res.innerHTML = `Buscando ${esc(m.nome)}… página ${pag}`;
        try { const resp = await fetch(urlDjen(oab, ini, fim, pag), {headers: {Accept: 'application/json'}});
          if (resp.status === 429) { falhas.push(`${m.nome}: limite de consultas do DJEN atingido; espere 1 minuto e tente de novo.`); break; }
          if (!resp.ok) { falhas.push(`${m.nome}: o DJEN respondeu com erro ${resp.status}.`); break; }
          const j = await resp.json(), arr = j.items || []; itens.push(...parse(JSON.stringify({items: arr})).map(x => Object.assign(x, {buscaAdv: m.id})));
          if (arr.length < 100 || pag * 100 >= (j.count || 0)) break; await esperar(1500); }
        catch (e) { bloqueado = true; break; } }
      if (bloqueado) break; if (k < advs.length - 1) await esperar(2000); }
    el.disabled = false;
    if (bloqueado) { /* navegador ou ambiente bloqueou a chamada direta: mostra os links para abrir e colar */
      res.innerHTML = `<p><b>A busca direta foi bloqueada por este navegador.</b> Faça assim: abra o link, copie todo o texto da página e cole na caixa abaixo.</p>
        <ul class="djlinks">${advs.map(m => `<li>${esc(m.nome)}: <a href="${esc(urlDjen(A.oabChave(m.oab), ini, fim, 1))}" target="_blank" rel="noopener">abrir publicações de ${esc(A.fmt(ini))} a ${esc(A.fmt(fim))}</a></li>`).join('')}</ul>
        <p class="muted" style="font-size:12px">Se a página mostrar "count" maior que 100, abra também o mesmo link trocando o final <code>pagina=1</code> por <code>pagina=2</code>.</p>
        <textarea id="djCola" rows="6" placeholder="Cole aqui o texto da página do DJEN"></textarea>
        <div style="margin-top:8px"><button class="btn primary" data-action="pub-djen-colar">Importar o que colei</button></div>`; return; }
    const r = await importarItens(itens, (n, t) => { res.textContent = `Gravando… ${n} de ${t}`; }); if (!r) return;
    res.innerHTML = `<p><b>${itens.length}</b> publicação(ões) encontradas, <b>${r.n}</b> nova(s) importada(s).${r.semResp ? ` ${r.semResp} ficaram sem responsável.` : ''}</p>${falhas.map(f => `<p class="erro">${esc(f)}</p>`).join('')}`;
    ui().status = 'nova'; A.render();
  });
  A.on('pub-djen-desfazer', () => { const ids = A.col('publicacoes').filter(p => p.origem === 'djen' && !p.prazoId).map(p => p.id), comPrazo = A.col('publicacoes').filter(p => p.origem === 'djen' && p.prazoId).length;
    A.confirm('Apagar publicações do DJEN', `Serão apagadas ${ids.length} publicação(ões) trazidas do DJEN${comPrazo ? ` (as ${comPrazo} que já geraram prazo ficam)` : ''}. As cadastradas à mão e as de exemplo continuam. Dá para buscar de novo depois.`, 'Apagar', async () => {
      if (await A.removeLote('publicacoes', ids)) A.toast(ids.length + ' publicação(ões) do DJEN apagada(s).'); }); });
  A.on('pub-djen-colar', async () => { const t = document.getElementById('djCola')?.value || ''; let itens;
    try { itens = parse(t); const sel = document.getElementById('djAdv')?.value; if (sel && sel !== '*') itens.forEach(x => { x.buscaAdv = sel; }); } catch (e) { A.toast('Não reconheci o texto. Copie a página inteira do DJEN, começando por {"status"...'); return; }
    const r = await importarItens(itens); if (!r) return; document.getElementById('djCola').value = '';
    A.toast(`${itens.length} encontrada(s), ${r.n} nova(s) importada(s)${r.semResp ? `; ${r.semResp} sem responsável` : ''}.`); ui().status = 'nova'; A.render(); });
})(window.App);
