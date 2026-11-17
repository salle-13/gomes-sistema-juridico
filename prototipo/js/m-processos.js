/* Módulo Processos: lista, ficha completa (dados, andamentos, prazos, publicações, documentos e financeiro do processo). */
(function (A) {
  const S = A.S, esc = A.esc;
  const ui = () => A.ui('processos', {busca: '', status: 'ativo', area: '', resp: ''});
  const STATUS = [['ativo','Ativo'],['suspenso','Suspenso'],['arquivado','Arquivado'],['encerrado','Encerrado']];
  const ST_LABEL = Object.fromEntries(STATUS);
  A.AREAS = ['Assessoria jurídica','Direito Civil','Direito Trabalhista','Direito Previdenciário','Família e Sucessões','Cobrança','Consumidor','LGPD'];
  const abertosDe = id => A.col('prazos').filter(p => p.processoId === id && p.status !== 'concluido');

  function lista() { const u = ui();
    return A.col('processos').filter(p => (!u.status || p.status === u.status) && (!u.area || p.area === u.area) && (!u.resp || p.responsavelId === u.resp))
      .filter(p => A.match(u.busca, p.numero, A.cliente(p.clienteId)?.nome, p.parteContraria, p.vara, p.classe))
      .sort((a, b) => (A.cliente(a.clienteId)?.nome || '').localeCompare(A.cliente(b.clienteId)?.nome || '', 'pt-BR')); }
  A.exportadores.processos = () => ({titulo: 'Processos', filtros: 'Situação: ' + (ST_LABEL[ui().status] || 'todas'), linhas: lista(), colunas: [
    {t:'Número', v:p => p.numero}, {t:'Cliente', v:p => A.cliente(p.clienteId)?.nome || ''}, {t:'Parte contrária', v:p => p.parteContraria}, {t:'Polo', v:p => p.polo},
    {t:'Órgão', v:p => [p.tribunal, p.vara, p.comarca].filter(Boolean).join(' · ')}, {t:'Área', v:p => p.area}, {t:'Valor da causa', v:p => p.valorCausa, tipo:'money'},
    {t:'Responsável', v:p => A.membro(p.responsavelId)?.nome || ''}, {t:'Situação', v:p => ST_LABEL[p.status]}, {t:'Prazos em aberto', v:p => abertosDe(p.id).length}]});

  function vLista() {
    const u = ui(), arr = lista(), ed = A.pode('processos', 'editar');
    const rows = arr.map(p => { const c = A.cliente(p.clienteId), m = A.membro(p.responsavelId), ab = abertosDe(p.id);
      const urg = ab.filter(x => ['vencido','hoje','critico'].includes(A.sitPrazo(x))).length;
      return `<tr class="row-click" data-action="abrir-processo" data-id="${esc(p.id)}"><td><span class="proc">${esc(p.numero)}</span><br><span class="muted" style="font-size:12px">${esc(p.classe || '')}</span></td>
        <td>${esc(c?.nome || '—')}<br><span class="muted" style="font-size:12px">x ${esc(p.parteContraria || '—')}</span></td><td>${esc([p.vara, p.comarca].filter(Boolean).join(' · '))}<br><span class="muted" style="font-size:12px">${esc(p.tribunal || '')}</span></td>
        <td><span class="tag">${esc(p.area || '—')}</span></td><td><span class="who">${A.avatar(m)}${esc(m?.nome || '—')}</span></td>
        <td class="num">${ab.length}${urg ? ` <span class="pill s-vencido">${urg} urgente${urg > 1 ? 's' : ''}</span>` : ''}</td><td>${esc(ST_LABEL[p.status] || p.status)}</td></tr>`; }).join('');
    return `<section class="panel"><div class="vhead"><h2>Processos</h2><span class="muted num">${arr.length} processo(s)</span>${A.botoesExport('processos')}${ed ? '<button class="btn primary" data-action="novo-processo">+ Novo processo</button>' : ''}</div>
      <div class="filters"><input id="prBusca" type="search" data-ui="processos.busca" placeholder="Buscar número, cliente, parte contrária, vara…" value="${esc(u.busca)}" style="flex:1 1 260px">
        <select id="prSt" data-ui="processos.status">${A.opts(STATUS, u.status, 'Todas as situações')}</select><select id="prArea" data-ui="processos.area">${A.opts(A.AREAS, u.area, 'Todas as áreas')}</select>
        <select id="prResp" data-ui="processos.resp">${A.optsEquipe(u.resp, 'Todos os responsáveis')}</select></div>
      <div class="tablewrap"><table><thead><tr><th>Número</th><th>Cliente x parte contrária</th><th>Órgão</th><th>Área</th><th>Responsável</th><th>Prazos abertos</th><th>Situação</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhum processo encontrado.</td></tr>'}</tbody></table></div></section>`;
  }
  A.route('processos', {label: 'Processos', mod: 'processos', render: vLista});

  /* ---------- ficha do processo ---------- */
  let atual = null;
  A.on('novo-processo', () => abrir(null));
  A.on('abrir-processo', el => { const p = A.processo(el.dataset.id); if (p) abrir(p); });
  A.abrirProcesso = id => { const p = A.processo(id); if (p) abrir(p); };
  A.abrirProcessoNovo = preset => abrir(null, preset);
  function abrir(p, preset) {
    const novo = !p, ed = A.pode('processos', 'editar'), ro = ed ? '' : 'disabled';
    atual = Object.assign({id: A.uid(), _novo: true, numero: '', clienteId: '', parteContraria: '', polo: 'ativo', tribunal: 'TJMG', comarca: 'Araguari', vara: '', classe: '', area: '', valorCausa: 0, responsavelId: A.me()?.id || '', status: 'ativo', distribuidoEm: '', obs: '', andamentos: []}, p ? JSON.parse(JSON.stringify(p)) : {}, preset || {});
    if (p) delete atual._novo;
    S.ui._modalCtx = {tipo: 'processo', id: atual.id};
    A.modal(`${A.modalHead(novo ? 'Novo processo' : atual.numero, !novo ? `<span class="tag">${esc(ST_LABEL[atual.status])}</span>` : '')}
    <form id="fProc"><div class="cgrid"><div>
      <div class="two">
        ${A.inp('prNum', 'Nº do processo (CNJ)', atual.numero, `required placeholder="0000000-00.0000.0.00.0000" ${ro}`)}
        ${A.sel('prCli', 'Cliente', A.optsClientes(atual.clienteId, 'Selecione'), '', ro)}
        ${A.inp('prParte', 'Parte contrária', atual.parteContraria, ro)}
        ${A.sel('prPolo', 'Nosso cliente é', A.opts([['ativo','Autor / requerente'],['passivo','Réu / requerido']], atual.polo), '', ro)}
        ${A.inp('prTrib', 'Tribunal', atual.tribunal, `list="tribList" ${ro}`)}<datalist id="tribList">${['TJMG','TRT3','TRF6','STJ','TST','STF','JEF'].map(t => `<option value="${t}">`).join('')}</datalist>
        ${A.inp('prCom', 'Comarca', atual.comarca, ro)}
        ${A.inp('prVara', 'Vara / órgão', atual.vara, ro)}
        ${A.inp('prClasse', 'Classe / ação', atual.classe, ro)}
        ${A.sel('prArea', 'Área', A.opts(A.AREAS, atual.area, 'Selecione'), '', ro)}
        ${A.inp('prValor', 'Valor da causa (R$)', atual.valorCausa ? A.num(atual.valorCausa) : '', `inputmode="decimal" ${ro}`)}
        ${A.sel('prResp', 'Responsável', A.optsEquipe(atual.responsavelId), '', ro)}
        ${A.inp('prDist', 'Distribuído em', atual.distribuidoEm, `type="date" ${ro}`)}
        ${A.sel('prSt', 'Situação', A.opts(STATUS, atual.status), '', ro)}
      </div>
      ${A.area('prObs', 'Observações / estratégia', atual.obs, 3, ro)}
      <div class="box"><h4>Andamentos</h4><ul class="timeline">${(atual.andamentos || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(a => `<li>${A.avatar(A.membro(a.por))}<div>${esc(a.texto)}<small>${esc(A.fmt(a.data))} · ${esc(a.por ? A.nomeDe(a.por) : 'Equipe')}</small></div></li>`).join('') || '<li class="muted">Nenhum andamento registrado.</li>'}</ul>
        ${ed ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><input id="anData" type="date" value="${A.hoje()}" aria-label="Data do andamento"><input id="anTxt" placeholder="Ex.: audiência designada para 10/12" style="flex:1 1 180px" aria-label="Andamento"><button type="button" class="btn small" data-action="pr-andamento">Registrar</button></div>` : ''}</div>
    </div><div id="prRel"></div></div>
    <footer>${!novo && ed ? '<button type="button" class="btn danger left" data-action="pr-excluir">Excluir processo</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`, {wide: true});
    relacionados();
    document.getElementById('fProc').addEventListener('submit', async e => { e.preventDefault(); if (await salvar()) { A.closeModal(); A.toast('Processo salvo.'); } });
  }
  function ler() { const v = A.v;
    Object.assign(atual, {numero: v('prNum'), clienteId: v('prCli'), parteContraria: v('prParte'), polo: v('prPolo'), tribunal: v('prTrib'), comarca: v('prCom'), vara: v('prVara'), classe: v('prClasse'),
      area: v('prArea'), valorCausa: A.cents(v('prValor')), responsavelId: v('prResp'), distribuidoEm: v('prDist'), status: v('prSt'), obs: v('prObs')}); return atual; }
  async function salvar(extra) { const p = ler(); if (!p.numero) { A.toast('Informe o número do processo.'); return null; }
    if (!A.CNJ_RE.test(p.numero)) A.toast('Atenção: o número não está no padrão CNJ (0000000-00.0000.0.00.0000).');
    const obj = Object.assign({}, p, extra || {}); delete obj._novo; const r = await A.save('processos', obj); if (r) { atual = JSON.parse(JSON.stringify(r)); } return r; }
  A.on('pr-andamento', async () => { const txt = A.v('anTxt'); if (!txt) return; ler(); atual.andamentos = [...(atual.andamentos || []), {data: A.v('anData') || A.hoje(), texto: txt, por: S.meId || null}];
    if (await salvar()) { abrir(atual); A.toast('Andamento registrado.'); } });
  A.on('pr-excluir', () => { const id = atual.id; const n = A.col('prazos').filter(p => p.processoId === id).length;
    A.confirm('Excluir processo', `O processo será apagado.${n ? ' Os ' + n + ' prazo(s) vinculados continuam na agenda, sem vínculo.' : ''} Para processos finalizados, prefira mudar a situação para Encerrado.`, 'Excluir', async () => { if (await A.remove('processos', id)) A.toast('Processo excluído.'); }); });
  A.on('pr-novo-prazo', async () => { if (atual._novo && !(await salvar())) return; const id = atual.id; A.closeModal(); A.formPrazo(null, {processoId: id}); });
  A.on('pr-lancar', async el => { if (atual._novo && !(await salvar())) return; const id = atual.id, cli = atual.clienteId; A.closeModal();
    A.formLancamento && A.formLancamento(null, {tipo: el.dataset.tipo, natureza: el.dataset.nat, categoria: el.dataset.cat, processoId: id, clienteId: cli, reembolsavel: el.dataset.nat !== 'honorarios'}); });

  function relacionados() {
    const el = document.getElementById('prRel'); if (!el || !atual) return; const id = atual.id;
    const prazos = A.col('prazos').filter(p => p.processoId === id).sort((a, b) => (a.status === 'concluido') - (b.status === 'concluido') || (a.vencimento || '').localeCompare(b.vencimento || ''));
    const pubs = A.col('publicacoes').filter(p => p.processoId === id).sort((a, b) => (b.disponibilizacao || '').localeCompare(a.disponibilizacao || ''));
    const fin = A.col('fin_lancamentos').filter(f => f.processoId === id && f.status !== 'cancelado');
    const soma = (f) => fin.filter(f).reduce((s, x) => s + (x.valor || 0), 0);
    const custas = soma(f => f.tipo === 'pagar' && ['custas','despesa_processual'].includes(f.natureza)), reemb = soma(f => f.tipo === 'pagar' && f.reembolsavel), honor = soma(f => f.tipo === 'receber' && f.natureza === 'honorarios');
    const podeFin = A.pode('financeiro', 'ver'), edFin = A.pode('financeiro', 'editar');
    el.innerHTML = `<div class="box"><h4>Prazos do processo</h4><div class="plist">${prazos.slice(0, 6).map(A.pcardPrazo).join('') || '<span class="muted" style="font-size:12px">Nenhum prazo.</span>'}</div>
        ${A.pode('prazos', 'editar') ? '<div><button type="button" class="btn small" data-action="pr-novo-prazo">+ Novo prazo neste processo</button></div>' : ''}</div>
      <div class="box"><h4>Publicações</h4>${pubs.slice(0, 5).map(p => `<div style="font-size:12.5px;border-bottom:1px dashed var(--line);padding-bottom:6px"><b>${esc(A.fmt(p.disponibilizacao))}</b> · ${esc(p.tipo || '')} · <span class="tag">${esc(A.PUB_LABEL ? A.PUB_LABEL[p.status] : p.status)}</span><div class="muted">${esc((p.texto || '').slice(0, 140))}${(p.texto || '').length > 140 ? '…' : ''}</div></div>`).join('') || '<span class="muted" style="font-size:12px">Nenhuma publicação vinculada.</span>'}</div>
      ${podeFin ? `<div class="box"><h4>Financeiro do processo</h4><dl class="dl"><dt>Custas e despesas</dt><dd class="num">${A.brl(custas)}</dd><dt>A reembolsar pelo cliente</dt><dd class="num">${A.brl(reemb)}</dd><dt>Honorários lançados</dt><dd class="num">${A.brl(honor)}</dd></dl>
        ${fin.slice(0, 6).map(f => `<div style="font-size:12.5px;display:flex;justify-content:space-between;gap:8px"><span>${esc(A.fmt(f.vencimento))} · ${esc(f.descricao)}</span><span class="num ${f.tipo === 'receber' ? 'pos' : 'neg'}">${f.tipo === 'receber' ? '+' : '−'} ${A.brl(f.valor)}</span></div>`).join('')}
        ${edFin ? `<div class="statusbar"><button type="button" class="btn small" data-action="pr-lancar" data-tipo="pagar" data-nat="custas" data-cat="Custas processuais">+ Custa</button><button type="button" class="btn small" data-action="pr-lancar" data-tipo="pagar" data-nat="despesa_processual" data-cat="Despesas processuais">+ Despesa</button><button type="button" class="btn small" data-action="pr-lancar" data-tipo="receber" data-nat="honorarios" data-cat="Honorários contratuais">+ Honorários</button></div>` : ''}</div>` : ''}
      ${A.pode('documentos', 'ver') && A.blocoDocumentos ? `<div class="box"><h4>Documentos do processo</h4>${A.blocoDocumentos({processoId: id, clienteId: atual.clienteId})}</div>` : ''}`;
  }
  const prev = A.aoAtualizar; A.aoAtualizar = c => { prev && prev(c); if (S.ui._modalCtx && S.ui._modalCtx.tipo === 'processo' && ['prazos','publicacoes','fin_lancamentos','documentos'].includes(c)) relacionados(); };
})(window.App);
