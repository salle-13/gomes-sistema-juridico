/* Módulo Clientes: captação em 10 etapas (kanban), carteira de clientes ativos e arquivo.
   Fluxo: o escritório não recusa casos e não há aceite pela advogada. O cliente percorre as etapas de Regras.ETAPAS
   (rótulos e limites em config/operacional); concluir a etapa 10 leva à carteira (status "ativo", aceitoEm e
   responsavelId obrigatório). Única saída fora do fluxo: "Arquivar: contato não seguiu" (status "recusado", motivo obrigatório).
   Os status antigos novo/encaminhado/analise continuam valendo como "em captação"; encaminhadoPara e clientes.historico
   ficam gravados, só leitura. O histórico novo vai para a coleção "historico". */
(function (A) {
  const S = A.S, R = A.R, esc = A.esc;
  const ui = () => A.ui('clientes', {aba: 'captacao', busca: '', paraMim: false, cart: 'ativo'});
  const st = c => c.status === 'aceito' ? 'ativo' : (c.status || 'novo');
  const noFunil = c => R.FUNIL.includes(st(c));
  const ST_LABEL = {novo: 'Em captação', encaminhado: 'Em captação', analise: 'Em captação', ativo: 'Cliente ativo', encerrado: 'Encerrado', recusado: 'Arquivado'};
  const ST_HIST = {novo: 'Em captação', encaminhado: 'Encaminhado (fluxo antigo)', analise: 'Em análise (fluxo antigo)', ativo: 'Cliente ativo', encerrado: 'Encerrado', recusado: 'Arquivado'};
  const ORIGENS = ['Indicação de cliente', 'Site / formulário', 'Instagram', 'WhatsApp', 'Telefone', 'Atendimento presencial', 'Parceiro'];
  const DEMANDAS = ['Aposentadoria por idade', 'Aposentadoria rural', 'Aposentadoria especial', 'Auxílio por incapacidade', 'BPC/LOAS', 'Pensão por morte', 'Revisão de benefício',
    'Reclamação trabalhista', 'Verbas rescisórias', 'Cobrança', 'Indenização', 'Revisão de contrato', 'Divórcio', 'Pensão alimentícia', 'Inventário', 'Consultoria'];
  A.datalistDemandas = () => `<datalist id="tiposDemanda">${[...new Set([...DEMANDAS, ...A.col('checklist_modelos').map(m => m.tipoDemanda).filter(Boolean)])].map(d => `<option value="${esc(d)}">`).join('')}</datalist>`;
  const etapa = c => R.etapaDe(c) || 'novo_contato';
  const rot = k => (A.op().etapas[k] || {}).rotulo || k || '—';
  const lim = k => (A.op().etapas[k] || {}).limiteUteis || 1;
  const pos = k => R.ETAPAS.indexOf(k);
  A.etapaDe = c => R.etapaDe(c); A.rotuloEtapa = rot;
  const desdeEtapa = c => R.dataDe(c.etapaDesde) || R.dataDe(c.dataEntrada) || R.dataDe(c.criadoEm) || A.hoje();
  const diasNaEtapa = c => R.uteisEscritorio(desdeEtapa(c), A.hoje());
  const meu = c => !!S.meId && [c.atendimentoResponsavelId, c.cadastradoPor, c.responsavelId].includes(S.meId) || (c.encaminhadoPara || []).includes(S.meId);
  const gargalosCli = () => A.memo('gargalos-cli', () => { const m = new Map(); (A.gargalos ? A.gargalos() : []).filter(g => g.entidade === 'clientes').forEach(g => { if (!m.has(g.id)) m.set(g.id, []); m.get(g.id).push(g); }); return m; });
  /* Clientes em captação que pedem providência (gargalo), para quem é deles; administrador e visão geral veem todos. */
  A.aguardando = () => A.col('clientes').filter(c => noFunil(c) && gargalosCli().has(c.id) && (!S.meId || A.papel() === 'admin' || meu(c)));

  /* ---------- kanban ---------- */
  function card(c) {
    const et = etapa(c), dias = diasNaEtapa(c), passou = dias > lim(et), at = A.membro(c.atendimentoResponsavelId), ed = A.pode('clientes', 'editar'), i = pos(et), g = gargalosCli().get(c.id) || [];
    return `<div class="ccard${passou ? ' atrasado' : ''}${S.meId && c.atendimentoResponsavelId === S.meId ? ' paramim' : ''}">
      <button type="button" class="ccard-abrir" data-action="abrir-cliente" data-id="${esc(c.id)}"><span class="t">${esc(c.nome)}</span></button>
      <span class="meta">${c.area ? `<span class="tag">${esc(c.area)}</span>` : ''}${c.tipoDemanda && c.tipoDemanda !== c.area ? `<span class="tag">${esc(c.tipoDemanda)}</span>` : ''}${c.urgencia === 'alta' ? '<span class="tag alta">Urgente</span>' : ''}</span>
      <span class="meta">${A.avatar(at)} ${esc(at ? at.nome : 'Sem responsável pelo atendimento')}</span>
      <span class="meta"><span class="cdias${passou ? ' late' : ''}" title="Dias úteis na etapa (limite ${lim(et)})">${dias} dia(s) útil(eis) na etapa${passou ? ' · limite ' + lim(et) : ''}</span>${g.some(x => x.tipo === 'documentacao_conferencia') ? '<span class="tag alta">Conferir documentos</span>' : ''}</span>
      ${c.proximaProvidencia ? `<span class="hist"><b>Próximo:</b> ${esc(c.proximaProvidencia)}</span>` : ''}
      ${ed ? `<span class="cmove"><button type="button" class="btn small" data-action="cl-voltar" data-id="${esc(c.id)}"${i <= 0 ? ' disabled' : ''} aria-label="Voltar para a etapa anterior" title="Voltar etapa">←</button><button type="button" class="btn small${i === R.ETAPAS.length - 1 ? ' primary' : ''}" data-action="cl-avancar" data-id="${esc(c.id)}">${i === R.ETAPAS.length - 1 ? 'Levar à carteira' : 'Avançar →'}</button></span>` : ''}</div>`;
  }
  function filtrados() { const u = ui(); let arr = A.col('clientes').filter(c => A.match(u.busca, c.nome, c.documento, String(c.documento || '').replace(/\D/g, ''), c.area, c.tipoDemanda, c.historia, c.telefone, c.email, c.obs, c.proximaProvidencia));
    if (u.paraMim && S.meId) arr = arr.filter(meu); return arr; }
  function carteira() { const u = ui(); return filtrados().filter(c => u.cart === 'todos' ? ['ativo', 'encerrado'].includes(st(c)) : st(c) === u.cart).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); }
  const funil = () => filtrados().filter(noFunil);
  A.exportadores.carteira = () => ({titulo: 'Carteira de clientes', linhas: carteira(), colunas: [{t: 'Cliente', v: c => c.nome}, {t: 'Tipo', v: c => c.tipoPessoa}, {t: 'CPF/CNPJ', v: c => c.documento}, {t: 'Telefone', v: c => c.telefone}, {t: 'E-mail', v: c => c.email},
    {t: 'Área', v: c => c.area}, {t: 'Responsável', v: c => A.membro(c.responsavelId)?.nome || ''}, {t: 'Processos', v: c => A.doIdx('processos', 'clienteId', c.id).length},
    {t: 'A receber em aberto', v: c => A.doIdx('fin_lancamentos', 'clienteId', c.id).filter(f => f.tipo === 'receber' && f.status === 'pendente').reduce((s, f) => s + f.valor, 0), tipo: 'money'}, {t: 'Situação', v: c => ST_LABEL[st(c)]}]});
  A.exportadores.captacao = () => ({titulo: 'Captação', linhas: funil().sort((a, b) => pos(etapa(a)) - pos(etapa(b)) || diasNaEtapa(b) - diasNaEtapa(a)), colunas: [
    {t: 'Cliente', v: c => c.nome}, {t: 'Etapa', v: c => (pos(etapa(c)) + 1) + '. ' + rot(etapa(c))}, {t: 'Dias úteis na etapa', v: diasNaEtapa}, {t: 'Limite', v: c => lim(etapa(c))},
    {t: 'Atendimento', v: c => A.membro(c.atendimentoResponsavelId)?.nome || ''}, {t: 'Advogado(a)', v: c => A.membro(c.responsavelId)?.nome || ''}, {t: 'Área', v: c => c.area || ''},
    {t: 'Tipo de demanda', v: c => c.tipoDemanda || ''}, {t: 'Próxima providência', v: c => c.proximaProvidencia || ''}, {t: 'Entrada', v: c => R.dataDe(c.dataEntrada) || R.dataDe(c.criadoEm), tipo: 'date'},
    {t: 'Telefone', v: c => c.telefone || ''}]});

  function vClientes() {
    const u = ui(), ed = A.pode('clientes', 'editar'), arr = filtrados();
    const abas = [['captacao', 'Captação'], ['carteira', 'Carteira de clientes'], ['arquivo', 'Arquivados']];
    let corpo = '';
    if (u.aba === 'captacao') {
      const lst = arr.filter(noFunil);
      corpo = `<div class="filters" style="padding-top:0"><span class="muted" style="font-size:12px">${lst.length} cliente(s) em captação</span><span style="flex:1"></span>${A.botoesExport('captacao')}</div>
        <div class="board board-etapas">${R.ETAPAS.map((k, i) => { const l = lst.filter(c => etapa(c) === k).sort((a, b) => diasNaEtapa(b) - diasNaEtapa(a));
        return `<div class="col"><h3><span>${i + 1}. ${esc(rot(k))}</span><span class="num">${l.length}</span></h3>${l.map(card).join('') || '<span class="muted" style="font-size:12px">Nenhum</span>'}</div>`; }).join('')}</div>
        <div class="legend">O cliente percorre as 10 etapas com “Avançar” e “Voltar” (ou pela lista de etapas na ficha). Os dias contam em dias úteis do escritório; o destaque aparece quando passa do limite da etapa (Configurações › Limites operacionais). Ao concluir a última etapa, o cliente entra na Carteira com o(a) advogado(a) responsável. Quem não seguiu é arquivado com o motivo.</div>`;
    } else if (u.aba === 'carteira') {
      const todos = carteira(), LIM = 300, lst = todos.slice(0, LIM);
      corpo = `<div class="filters"><div class="subtabs">${[['ativo', 'Ativos'], ['encerrado', 'Encerrados'], ['todos', 'Todos']].map(([k, l]) => `<button data-action="cli-cart" data-v="${k}" aria-pressed="${u.cart === k}">${l}</button>`).join('')}</div>${A.botoesExport('carteira')}</div>
        <div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Área</th><th>Responsável</th><th>Processos</th><th>Prazos abertos</th>${A.pode('financeiro', 'ver') ? '<th class="money">A receber</th>' : ''}</tr></thead><tbody>
        ${lst.map(c => { const procs = A.doIdx('processos', 'clienteId', c.id).length, prz = A.doIdx('prazos', 'clienteId', c.id).filter(p => p.status !== 'concluido').length, m = A.membro(c.responsavelId);
          const rec = A.doIdx('fin_lancamentos', 'clienteId', c.id).filter(f => f.tipo === 'receber' && f.status === 'pendente').reduce((s, f) => s + f.valor, 0);
          return `<tr class="row-click" data-action="abrir-cliente" data-id="${esc(c.id)}"><td><b>${esc(c.nome)}</b><br><span class="muted" style="font-size:12px">${esc(c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF')} ${esc(c.documento || '—')}</span></td>
            <td>${esc(c.telefone || '')}<br><span class="muted" style="font-size:12px">${esc(c.email || '')}</span></td><td><span class="tag">${esc(c.area || '—')}</span></td><td><span class="who">${A.avatar(m)}${esc(m?.nome || '—')}</span></td>
            <td class="num">${procs}</td><td class="num">${prz}</td>${A.pode('financeiro', 'ver') ? `<td class="money">${rec ? A.brl(rec) : '—'}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhum cliente.</td></tr>'}</tbody></table></div>${todos.length > LIM ? `<p class="muted" style="padding:10px 14px">Mostrando ${LIM} de ${todos.length} clientes. Use a busca para encontrar os demais (a exportação traz todos).</p>` : ''}`;
    } else {
      const lst = arr.filter(c => st(c) === 'recusado').sort((a, b) => String(b.arquivadoEm || b.atualizadoEm || '').localeCompare(String(a.arquivadoEm || a.atualizadoEm || '')));
      corpo = `<div class="plist" style="padding:14px">${lst.map(c => `<button class="pcard" style="--c:var(--line)" data-action="abrir-cliente" data-id="${esc(c.id)}"><span class="t">${esc(c.nome)}</span><span class="meta">${esc(c.area || '')}${c.arquivadoEm ? ' · arquivado ' + esc(A.haDias(c.arquivadoEm)) : ' · ' + esc(A.haDias(c.criadoEm))}</span><span class="meta">${esc(motivoArquivo(c))}</span></button>`).join('') || '<div class="empty">Nenhum cliente arquivado.</div>'}</div>
        <div class="legend">Clientes cujo contato não seguiu. Os casos “não aceitos” do fluxo antigo também ficam aqui. É possível reabrir na captação pela ficha.</div>`;
    }
    return `<section class="panel"><div class="vhead"><h2>Clientes</h2>${ed ? '<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-action="imp-abrir">Importar do Projuris</button><button class="btn primary" data-action="novo-cliente">+ Cadastrar novo cliente</button></span>' : ''}</div>
      <div class="tabs-inline">${abas.map(([k, l]) => `<button data-action="cli-aba" data-v="${k}" aria-pressed="${u.aba === k}">${l}</button>`).join('')}</div>
      <div class="filters"><input id="clBusca" type="search" data-ui="clientes.busca" placeholder="Buscar nome, CPF/CNPJ, telefone, demanda, observações…" value="${esc(u.busca)}" style="flex:1 1 260px">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="clMim" data-ui="clientes.paraMim" ${u.paraMim ? 'checked' : ''} ${S.meId ? '' : 'disabled'}> Só os meus</label></div>${corpo}</section>`;
  }
  const motivoArquivo = c => c.motivoArquivamento || ((c.historico || []).filter(h => /não aceito/i.test(h.texto)).pop() || {}).texto || '';
  A.route('clientes', {label: 'Clientes', mod: 'clientes', render: vClientes, badge: () => A.aguardando().length});
  A.on('cli-aba', el => { ui().aba = el.dataset.v; A.render(); });
  A.on('cli-cart', el => { ui().cart = el.dataset.v; A.render(); });

  /* ---------- ficha ---------- */
  let cli = null;
  const aberto = id => cli && S.ui._modalCtx && S.ui._modalCtx.tipo === 'cliente' && S.ui._modalCtx.id === id && document.getElementById('fCliente');
  A.on('novo-cliente', () => abrir(null));
  A.on('abrir-cliente', el => { const c = A.cliente(el.dataset.id); if (c) abrir(c); });
  function abrir(c) {
    cli = c ? JSON.parse(JSON.stringify(c)) : {id: A.uid(), _novo: true, nome: '', tipoPessoa: 'PF', documento: '', telefone: '', email: '', endereco: '', origem: '', area: '', urgencia: 'normal', historia: '', status: 'novo',
      etapa: 'novo_contato', etapaDesde: null, dataEntrada: A.hoje(), atendimentoResponsavelId: S.meId || '', tipoDemanda: '', proximaProvidencia: '', encaminhadoPara: [], responsavelId: '', cadastradoPor: S.meId || null, criadoEm: new Date().toISOString()};
    cli.status = st(cli); S.ui._modalCtx = {tipo: 'cliente', id: cli.id}; desenhar();
  }
  function boxCaptacao(c, ed, ro) {
    const s = c.status;
    if (noFunil(c)) {
      const et = etapa(c), i = pos(et), dias = c._novo ? 0 : diasNaEtapa(c), passou = dias > lim(et);
      return `<div class="box"><h4>Captação · etapa ${i + 1} de ${R.ETAPAS.length}</h4>
        <ol class="etapas-trilha" aria-label="Etapas da captação">${R.ETAPAS.map((k, n) => `<li class="${n < i ? 'feita' : n === i ? 'atual' : ''}" title="${n + 1}. ${esc(rot(k))}"><span>${n + 1}</span></li>`).join('')}</ol>
        <p style="margin:0"><b>${esc(rot(et))}</b>${c._novo ? '' : ` · <span class="${passou ? 'late' : 'muted'}">${dias} dia(s) útil(eis) na etapa (limite ${lim(et)})</span>`}</p>
        ${ed ? `<div class="statusbar"><select id="cEtapa" data-onchange="cl-etapa-sel" aria-label="Mudar etapa">${A.opts(R.ETAPAS.map((k, n) => [k, (n + 1) + '. ' + rot(k)]), et)}</select>
          <button type="button" class="btn small" data-action="cl-voltar" data-id="${esc(c.id)}"${i <= 0 ? ' disabled' : ''}>← Voltar</button>
          <button type="button" class="btn small primary" data-action="cl-avancar" data-id="${esc(c.id)}">${i === R.ETAPAS.length - 1 ? 'Concluir e levar à carteira' : 'Avançar →'}</button></div>` : ''}
        <div class="two">${A.sel('cAtend', 'Responsável pelo atendimento', A.optsEquipe(c.atendimentoResponsavelId), '', ro)}${A.inp('cEntrada', 'Data de entrada', R.dataDe(c.dataEntrada) || R.dataDe(c.criadoEm), `type="date" ${ro}`)}</div>
        ${A.inp('cProx', 'Próxima providência', c.proximaProvidencia, `${ro} placeholder="${esc(R.PROVIDENCIA_ETAPA[et] || '')}"`, 'full')}
        ${ed && !c._novo ? '<div><button type="button" class="btn small danger" data-action="cl-arquivar">Arquivar: contato não seguiu</button></div>' : ''}</div>`;
    }
    if (s === 'recusado') return `<div class="box"><h4>Arquivado</h4><p style="margin:0">${esc(motivoArquivo(c) || 'Sem motivo registrado.')}</p>${c.arquivadoEm ? `<p class="muted" style="margin:0;font-size:12px">Arquivado em ${esc(A.quando(c.arquivadoEm))}</p>` : ''}
      ${ed ? '<div class="statusbar"><button type="button" class="btn small" data-action="cl-reabrir">Reabrir na captação</button></div>' : ''}</div>`;
    return `<div class="box"><h4>Andamento do cliente</h4>${c.aceitoEm ? `<p class="muted" style="margin:0;font-size:12px">Na carteira desde ${esc(A.quando(c.aceitoEm))}</p>` : ''}
      ${ed ? `<div class="statusbar">${s === 'ativo' ? '<button type="button" class="btn small" data-action="cl-status" data-st="encerrado">Encerrar atendimento</button>' : ''}${s === 'encerrado' ? '<button type="button" class="btn small" data-action="cl-status" data-st="ativo">Reativar cliente</button>' : ''}</div>` : ''}</div>`;
  }
  function desenhar() {
    const c = cli, ed = A.pode('clientes', 'editar'), ro = ed ? '' : 'disabled';
    const body = `${A.modalHead(c._novo ? 'Cadastrar novo cliente' : c.nome, `<span class="tag">${esc(noFunil(c) ? 'Captação · ' + rot(etapa(c)) : ST_LABEL[c.status])}</span>`)}
    <form id="fCliente"><div class="cgrid"><div>
      ${A.inp('cNome', 'Nome / razão social', c.nome, `required ${ro}`)}
      <div class="two">${A.sel('cTipo', 'Pessoa', A.opts([['PF', 'Física'], ['PJ', 'Jurídica']], c.tipoPessoa), '', `${ro} data-onchange="cl-tipo"`)}${A.inp('cDoc', 'CPF / CNPJ', c.documento, ro)}
        ${A.inp('cTel', 'Telefone / WhatsApp', c.telefone, ro)}${A.inp('cEmail', 'E-mail', c.email, `type="email" ${ro}`)}
        ${A.sel('cArea', 'Área', A.opts(A.AREAS, c.area, 'Selecione'), '', ro)}${A.inp('cTipoDem', 'Tipo de demanda', c.tipoDemanda, `list="tiposDemanda" ${ro} placeholder="Ex.: Aposentadoria rural"`)}${A.datalistDemandas()}
        ${A.inp('cOrig', 'Como chegou', c.origem, `list="origList" ${ro}`)}<datalist id="origList">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        ${A.sel('cUrg', 'Urgência', A.opts([['normal', 'Normal'], ['alta', 'Alta (prazo correndo, audiência próxima…)']], c.urgencia), '', ro)}
        ${A.sel('cResp', noFunil(c) ? 'Advogado(a) responsável (obrigatório para a carteira)' : 'Advogado(a) responsável', A.optsEquipe(c.responsavelId), 'full', ro)}</div>
      ${A.inp('cEnd', 'Endereço', c.endereco, ro, 'full')}
      <div id="cliPF" class="two" style="${c.tipoPessoa === 'PJ' ? 'display:none' : ''}">
        ${A.inp('cNac', 'Nacionalidade', c.nacionalidade, `list="nacList" placeholder="brasileiro(a)" ${ro}`)}<datalist id="nacList"><option value="brasileiro"><option value="brasileira"></datalist>
        ${A.inp('cEstCiv', 'Estado civil', c.estadoCivil, `list="ecList" ${ro}`)}<datalist id="ecList">${['solteiro', 'solteira', 'casado', 'casada', 'divorciado', 'divorciada', 'viúvo', 'viúva', 'em união estável'].map(o => `<option value="${o}">`).join('')}</datalist>
        ${A.inp('cProf', 'Profissão', c.profissao, ro)}${A.inp('cRg', 'RG (nº e órgão emissor)', c.rg, `placeholder="MG-12.345.678 SSP/MG" ${ro}`)}
        ${A.inp('cNasc', 'Data de nascimento', c.dataNascimento, `type="date" ${ro}`)}${A.inp('cNatur', 'Naturalidade', c.naturalidade, `placeholder="Araguari/MG" ${ro}`)}
        ${A.inp('cMae', 'Nome da mãe', c.nomeMae, ro)}${A.inp('cPai', 'Nome do pai', c.nomePai, ro)}
        ${A.inp('cEmpresa', 'Empresa (empregador)', c.empresa, ro)}${A.inp('cCtps', 'CTPS', c.ctps, ro)}${A.inp('cPis', 'PIS/PASEP', c.pis, ro)}</div>
      <div id="cliPJ" class="two" style="${c.tipoPessoa === 'PJ' ? '' : 'display:none'}">
        ${A.inp('cRepNome', 'Representante legal', c.representanteNome, ro)}${A.inp('cRepCpf', 'CPF do representante', c.representanteCpf, ro)}
        ${A.inp('cRepCargo', 'Cargo do representante', c.representanteCargo, `list="cargoRepList" placeholder="sócio-administrador" ${ro}`)}<datalist id="cargoRepList">${['sócio-administrador', 'sócia-administradora', 'diretor', 'diretora', 'procurador', 'procuradora'].map(o => `<option value="${o}">`).join('')}</datalist></div>
      <div class="muted" style="font-size:12px;margin-top:-6px">Os dados acima entram na qualificação das procurações, contratos e declarações (Modelos de documentos).</div>
      ${A.area('cObs', 'Observações', c.obs, 3, `${ro} placeholder="CNH, título de eleitor, inscrições, pendências de cadastro…"`)}
      ${A.area('cHist', 'História do caso', c.historia, 8, `${ro} placeholder="O que aconteceu, quando, quem é a outra parte, o que o cliente quer, provas que tem, prazos que já correm…"`)}
      <div class="muted" style="font-size:12px">Cadastrado por ${esc(c.cadastradoPor ? A.nomeDe(c.cadastradoPor) : '—')} em ${esc(A.quando(c.criadoEm))}${(c.encaminhadoPara || []).length ? ' · encaminhado no fluxo antigo para ' + esc(c.encaminhadoPara.map(A.nomeDe).join(', ')) : ''}</div>
    </div><div>
      ${boxCaptacao(c, ed, ro)}
      <div id="clRel"></div>
      <div class="box"><h4>Linha do tempo</h4><div id="clHist"></div>
        ${ed ? '<div style="display:flex;gap:6px"><input id="cNota" placeholder="Anotação (ex.: pedir CTPS ao cliente)" style="flex:1" aria-label="Anotação"><button type="button" class="btn small" data-action="cl-nota">Anotar</button></div>' : ''}</div>
    </div></div>
    <footer>${!c._novo && ed ? '<button type="button" class="btn danger left" data-action="cl-excluir">Excluir cadastro</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`;
    const ex = document.querySelector('.modal.wide'); if (ex && document.getElementById('fCliente')) ex.innerHTML = body; else A.modal(body, {wide: true});
    relacionados(); linhaDoTempo();
    document.getElementById('fCliente').addEventListener('submit', async e => { e.preventDefault(); if (!A.exigir('clientes')) return; if (await salvar()) { A.closeModal(); A.toast('Cliente salvo.'); } });
  }
  // Lê o formulário para o rascunho "cli". Campo ausente na tela mantém o valor atual (ex.: etapa de quem já está na carteira).
  function ler() { if (!document.getElementById('fCliente')) return cli;
    const v = (id, atual) => document.getElementById(id) ? A.v(id) : atual;
    Object.assign(cli, {nome: v('cNome', cli.nome), tipoPessoa: v('cTipo', cli.tipoPessoa), documento: v('cDoc', cli.documento), telefone: v('cTel', cli.telefone), email: v('cEmail', cli.email), area: v('cArea', cli.area),
      tipoDemanda: v('cTipoDem', cli.tipoDemanda), origem: v('cOrig', cli.origem), urgencia: v('cUrg', cli.urgencia), responsavelId: v('cResp', cli.responsavelId), endereco: v('cEnd', cli.endereco), historia: v('cHist', cli.historia),
      nacionalidade: v('cNac', cli.nacionalidade), estadoCivil: v('cEstCiv', cli.estadoCivil), profissao: v('cProf', cli.profissao), rg: v('cRg', cli.rg), dataNascimento: v('cNasc', cli.dataNascimento), naturalidade: v('cNatur', cli.naturalidade),
      nomeMae: v('cMae', cli.nomeMae), nomePai: v('cPai', cli.nomePai), empresa: v('cEmpresa', cli.empresa), ctps: v('cCtps', cli.ctps), pis: v('cPis', cli.pis), obs: v('cObs', cli.obs),
      representanteNome: v('cRepNome', cli.representanteNome), representanteCpf: v('cRepCpf', cli.representanteCpf), representanteCargo: v('cRepCargo', cli.representanteCargo),
      atendimentoResponsavelId: v('cAtend', cli.atendimentoResponsavelId), dataEntrada: v('cEntrada', cli.dataEntrada), proximaProvidencia: v('cProx', cli.proximaProvidencia)}); return cli; }
  async function salvar(extra, opts) { const c = ler(); if (!c.nome) { A.toast('Informe o nome do cliente.'); document.getElementById('cNome')?.focus(); return null; }
    const obj = Object.assign({}, c, extra || {}); const novo = obj._novo; delete obj._novo;
    if (novo && noFunil(obj)) { obj.etapa = obj.etapa || 'novo_contato'; obj.etapaDesde = obj.etapaDesde || new Date().toISOString(); obj.dataEntrada = obj.dataEntrada || A.hoje(); }
    const r = await A.save('clientes', obj, opts); if (r) cli = JSON.parse(JSON.stringify(r)); return r; }
  // Usado por Documentos e Checklists: garante que o cliente novo esteja salvo; com texto, registra no histórico.
  A.salvarClienteAberto = async txt => { if (cli && S.ui._modalCtx && S.ui._modalCtx.tipo === 'cliente') {
    if (cli._novo) { const r = await salvar(); if (!r) return null; desenhar(); }
    if (txt) await A.registrar({entidade: 'clientes', entidadeId: cli.id, acao: 'documento', texto: txt});
    return cli; } return null; };

  /* ---------- etapas ---------- */
  /* Muda a etapa de um cliente. Se a ficha dele está aberta, grava junto o que foi digitado nela. */
  async function mudarEtapa(id, nova) {
    if (!A.exigir('clientes')) return;
    if (!R.ETAPAS.includes(nova)) return;
    if (aberto(id)) { if (etapa(ler()) === nova && !cli._novo) return; if (await salvar({etapa: nova, etapaDesde: new Date().toISOString()})) { desenhar(); A.toast('Etapa: ' + rot(nova) + '.'); } return; }
    const c = A.cliente(id); if (!c || !noFunil(c) || etapa(c) === nova) return;
    if (await A.save('clientes', Object.assign({}, c, {etapa: nova, etapaDesde: new Date().toISOString()}))) A.toast(c.nome + ': ' + rot(nova) + '.');
  }
  /* Conclusão da etapa 10: entra na carteira. Exige o(a) advogado(a) responsável. */
  async function levarACarteira(id) {
    if (!A.exigir('clientes')) return;
    if (!aberto(id)) { const c = A.cliente(id); if (!c) return; if (!c.responsavelId) { abrir(c); A.toast('Defina o(a) advogado(a) responsável para levar o cliente à carteira.'); document.getElementById('cResp')?.focus(); return; }
      if (await A.save('clientes', Object.assign({}, c, {status: 'ativo', aceitoEm: c.aceitoEm || new Date().toISOString()}), {texto: 'Captação concluída: cliente entrou na carteira'})) A.toast(c.nome + ' entrou na carteira de clientes.'); return; }
    const c = ler(); if (!c.responsavelId) { A.toast('Defina o(a) advogado(a) responsável para levar o cliente à carteira.'); document.getElementById('cResp')?.focus(); return; }
    if (await salvar({status: 'ativo', aceitoEm: c.aceitoEm || new Date().toISOString()}, {texto: 'Captação concluída: cliente entrou na carteira'})) { desenhar(); A.toast('Cliente entrou na carteira.'); }
  }
  const alvo = id => aberto(id) ? ler() : A.cliente(id);
  A.on('cl-avancar', el => { const c = alvo(el.dataset.id); if (!c || !noFunil(c)) return; const i = pos(etapa(c));
    if (i >= R.ETAPAS.length - 1) levarACarteira(c.id); else mudarEtapa(c.id, R.ETAPAS[i + 1]); });
  A.on('cl-voltar', el => { const c = alvo(el.dataset.id); if (!c || !noFunil(c)) return; const i = pos(etapa(c)); if (i > 0) mudarEtapa(c.id, R.ETAPAS[i - 1]); });
  A.on('cl-etapa-sel', el => { if (!cli) return; if (!A.pode('clientes', 'editar')) { el.value = etapa(cli); A.exigir('clientes'); return; }
    if (!A.v('cNome')) { el.value = etapa(cli); A.toast('Informe o nome do cliente antes de mudar a etapa.'); return; } mudarEtapa(cli.id, el.value); });

  /* ---------- arquivar / reabrir / encerrar ---------- */
  A.on('cl-arquivar', () => { if (!A.exigir('clientes') || !cli) return; ler(); const nome = cli.nome;
    A.modal(`${A.modalHead('Arquivar: contato não seguiu')}<form id="fArquivar" data-onsubmit="cl-arquivar-ok"><div class="body">
      <p class="full" style="margin:0">${esc(nome)} sai da captação e vai para “Arquivados”. Dá para reabrir depois.</p>
      ${A.area('arqMotivo', 'Motivo (obrigatório)', '', 3, 'required placeholder="Ex.: cliente não retornou após três contatos; preferiu outro escritório…"')}</div>
      <footer><button type="button" class="btn" data-action="cl-arquivar-cancelar">Voltar</button><button type="submit" class="btn danger">Arquivar</button></footer></form>`); });
  A.on('cl-arquivar-cancelar', () => desenhar());
  A.on('cl-arquivar-ok', async (el, e) => { if (e) e.preventDefault(); if (!A.exigir('clientes') || !cli) return; const motivo = A.v('arqMotivo');
    if (!motivo) { A.toast('Escreva o motivo do arquivamento.'); return; }
    const r = await salvar({status: 'recusado', motivoArquivamento: motivo.slice(0, 1000), arquivadoEm: new Date().toISOString(), arquivadoPor: S.meId || null}, {texto: 'Arquivado: contato não seguiu. Motivo: ' + motivo});
    if (r) { A.closeModal(); A.toast(r.nome + ' arquivado.'); } });
  A.on('cl-reabrir', async () => { if (!A.exigir('clientes') || !cli) return;
    if (await salvar({status: 'novo', etapa: R.ETAPAS.includes(cli.etapa) ? cli.etapa : 'novo_contato', etapaDesde: new Date().toISOString()}, {texto: 'Reaberto na captação'})) { desenhar(); A.toast('Cliente reaberto na captação.'); } });
  A.on('cl-status', async el => { if (!A.exigir('clientes') || !cli) return; const s = el.dataset.st; if (!['ativo', 'encerrado'].includes(s) || noFunil(cli)) return;
    const nota = (document.getElementById('cNota')?.value || '').trim();
    if (await salvar({status: s}, {texto: s === 'encerrado' ? 'Atendimento encerrado.' + (nota ? ' ' + nota : '') : 'Cliente reativado.'})) { A.toast(ST_LABEL[s] + '.'); desenhar(); } });
  A.on('cl-tipo', el => { const pj = el.value === 'PJ', a = document.getElementById('cliPF'), b = document.getElementById('cliPJ'); if (a) a.style.display = pj ? 'none' : ''; if (b) b.style.display = pj ? '' : 'none'; });
  A.on('cl-nota', async () => { if (!A.exigir('clientes') || !cli) return; const n = (document.getElementById('cNota')?.value || '').trim(); if (!n) return;
    if (cli._novo && !(await salvar())) return; if (cli._novo === undefined && !A.cliente(cli.id)) return;
    if (await A.registrar({entidade: 'clientes', entidadeId: cli.id, acao: 'nota', texto: n.slice(0, 2000)})) { const i = document.getElementById('cNota'); if (i) i.value = ''; linhaDoTempo(); } });
  A.on('cl-excluir', () => { if (!A.exigir('clientes')) return; const id = cli.id; A.confirm('Excluir cadastro', 'O cadastro deste cliente será apagado. Processos, prazos, tarefas, documentos e lançamentos continuam, sem vínculo; o histórico continua guardado.', 'Excluir', async () => { if (A.exigir('clientes') && await A.remove('clientes', id)) A.toast('Cadastro excluído.'); }); });
  A.on('cl-novo-processo', async () => { if (!A.exigir('processos')) return; if (cli._novo && !(await salvar())) return; const id = cli.id; A.closeModal(); A.abrirProcessoNovo ? A.abrirProcessoNovo({clienteId: id}) : null; });
  A.on('cl-nova-tarefa', async () => { if (!A.exigir('tarefas')) return; if (cli._novo && !(await salvar())) return; const id = cli.id; A.closeModal();
    A.formTarefa(null, {clienteId: id, responsavelId: cli.atendimentoResponsavelId || A.me()?.id || '', origem: {tipo: 'cliente', ref: id}, _voltar: {tipo: 'cliente', id}}); });
  A.on('cl-agendar-reuniao', async () => { if (!A.exigir('prazos')) return; if (cli._novo && !(await salvar())) return; ler(); const c = cli; A.closeModal();
    A.formComp(null, {tipo: 'Reunião', clienteId: c.id, titulo: 'Reunião · ' + c.nome, responsavelId: c.atendimentoResponsavelId || A.me()?.id || '', _voltar: {tipo: 'cliente', id: c.id}}); });

  /* ---------- blocos relacionados e linha do tempo ---------- */
  function relacionados() {
    const el = document.getElementById('clRel'); if (!el || !cli) return; const id = cli.id, s = cli.status, salvo = !cli._novo && !!A.cliente(id);
    const procs = A.doIdx('processos', 'clienteId', id), prz = A.doIdx('prazos', 'clienteId', id).filter(p => p.status !== 'concluido').sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    const fin = A.doIdx('fin_lancamentos', 'clienteId', id).filter(f => f.status === 'pendente');
    const reun = A.doIdx('compromissos', 'clienteId', id).slice().sort((a, b) => (b.data + (b.horaInicio || '')).localeCompare(a.data + (a.horaInicio || '')));
    const hora = c => c.diaInteiro || !c.horaInicio ? 'dia todo' : c.horaInicio;
    el.innerHTML = `${A.pode('prazos', 'ver') ? `<div class="box"><h4>Reuniões e compromissos</h4>${reun.slice(0, 6).map(c => `<button type="button" class="pcard" style="--c:${c.status === 'concluido' ? 'var(--line)' : 'var(--accent)'}" data-action="editar-comp" data-id="${esc(c.id)}"><span class="t">${esc(c.tipo)} · ${esc(c.titulo)}</span><span class="meta">${esc(A.fmt(c.data))} · ${esc(hora(c))} · ${c.status === 'concluido' ? 'realizado' : 'agendado'}${c.responsavelId ? ' · ' + esc(A.nomeDe(c.responsavelId)) : ''}</span></button>`).join('') || '<span class="muted" style="font-size:12px">Nenhuma reunião ou compromisso.</span>'}
        ${A.pode('prazos', 'editar') ? '<div><button type="button" class="btn small" data-action="cl-agendar-reuniao">+ Agendar reunião</button></div>' : ''}</div>` : ''}
      ${A.blocoTarefas && A.pode('tarefas', 'ver') ? `<div class="box"><h4>Tarefas</h4>${salvo ? A.blocoTarefas({clienteId: id}) : (A.pode('tarefas', 'editar') ? '<div><button type="button" class="btn small" data-action="cl-nova-tarefa">+ Nova tarefa</button></div>' : '')}</div>` : ''}
      ${A.blocoChecklist ? `<div class="box"><h4>Checklist de documentos</h4>${A.blocoChecklist(cli)}</div>` : ''}
      ${['ativo', 'encerrado'].includes(s) ? `<div class="box"><h4>Processos</h4>${procs.map(p => `<button type="button" class="pcard" style="--c:var(--accent)" data-action="abrir-processo" data-id="${esc(p.id)}"><span class="t">${esc(A.rotuloPasta(p) || 'Sem pasta')}</span><span class="meta proc">${esc(p.numero || 'Sem nº (não ajuizado)')}</span><span class="meta">${esc(p.classe || '')} · ${esc(p.vara || '')} · x ${esc(p.parteContraria || '')}</span></button>`).join('') || '<span class="muted" style="font-size:12px">Nenhum processo.</span>'}
        ${A.pode('processos', 'editar') ? '<div><button type="button" class="btn small" data-action="cl-novo-processo">+ Novo processo para este cliente</button></div>' : ''}</div>
      <div class="box"><h4>Prazos em aberto</h4><div class="plist">${prz.slice(0, 5).map(A.pcardPrazo).join('') || '<span class="muted" style="font-size:12px">Nenhum.</span>'}</div></div>
      ${A.pode('financeiro', 'ver') ? `<div class="box"><h4>Financeiro em aberto</h4><dl class="dl"><dt>A receber</dt><dd class="num">${A.brl(fin.filter(f => f.tipo === 'receber').reduce((a, f) => a + f.valor, 0))}</dd><dt>Despesas a reembolsar</dt><dd class="num">${A.brl(A.doIdx('fin_lancamentos', 'clienteId', id).filter(f => f.tipo === 'pagar' && f.reembolsavel && f.status !== 'cancelado').reduce((a, f) => a + f.valor, 0))}</dd></dl></div>` : ''}` : ''}
      ${A.pode('documentos', 'ver') && A.blocoDocumentos ? `<div class="box"><h4>Documentos do cliente</h4>${A.blocoDocumentos({clienteId: id})}</div>` : ''}
      ${A.blocoGerarDocumento ? A.blocoGerarDocumento('cliente') : ''}`;
  }
  const SIT = () => A.SIT_CHECKLIST || {};
  function textoHist(h) {
    const ant = h.antes, dep = h.depois, nome = id => id ? A.nomeDe(id) : 'ninguém';
    if (h.entidade === 'clientes') {
      if (h.acao === 'cadastro') return 'Cliente cadastrado';
      if (h.acao === 'etapa') return `Etapa: ${ant ? rot(ant) : 'sem etapa'} → ${rot(dep)}`;
      if (h.acao === 'status') return `Situação: ${ST_HIST[ant] || ant || '—'} → ${ST_HIST[dep] || dep || '—'}`;
      if (h.acao === 'responsavel') return `${h.campo === 'atendimentoResponsavelId' ? 'Responsável pelo atendimento' : 'Advogado(a) responsável'}: ${nome(ant)} → ${nome(dep)}`;
      return h.texto || h.acao;
    }
    if (h.entidade === 'checklist_itens') { const i = A.byId('checklist_itens', h.entidadeId), n = i ? i.nome : 'documento';
      if (h.acao === 'situacao') return `Documento “${n}”: ${SIT()[ant] || ant || '—'} → ${SIT()[dep] || dep || '—'}`;
      if (h.acao === 'documentoId') { const d = dep ? A.byId('documentos', dep) : null; return `Documento “${n}”: ${!dep ? 'arquivo desvinculado' : ant ? 'arquivo substituído por ' : 'arquivo vinculado: '}${d ? d.nome : ''}`; }
      return h.texto || h.acao; }
    if (h.entidade === 'tarefas') { const t = A.byId('tarefas', h.entidadeId), n = t ? t.titulo : 'tarefa', STT = A.ST_TAREFA || {};
      if (h.acao === 'criacao') return `Tarefa criada: ${n}`;
      if (h.acao === 'status') return `Tarefa “${n}”: ${STT[ant] || ant} → ${STT[dep] || dep}`;
      if (h.acao === 'prazo') return `Tarefa “${n}”: prazo ${ant ? A.fmt(ant) : 'sem prazo'} → ${dep ? A.fmt(dep) : 'sem prazo'}`;
      if (h.acao === 'responsavel') return `Tarefa “${n}”: responsável ${nome(ant)} → ${nome(dep)}`;
      return h.texto || h.acao; }
    return h.texto || h.acao;
  }
  function linhaDoTempo() {
    const el = document.getElementById('clHist'); if (!el || !cli) return; const id = cli.id;
    const ids = new Set([...A.doIdx('checklist_itens', 'clienteId', id).map(i => 'checklist_itens:' + i.id), ...A.doIdx('tarefas', 'clienteId', id).map(t => 'tarefas:' + t.id)]);
    const novos = A.col('historico').filter(h => (h.entidade === 'clientes' && h.entidadeId === id) || ids.has(h.entidade + ':' + h.entidadeId))
      .map(h => { const t = textoHist(h); return {em: h.em, por: h.por, texto: t + (h.texto && h.texto !== t ? ' — ' + h.texto : ''), auto: h.origem === 'automacao'}; });
    const antigos = (cli.historico || []).map(h => ({em: h.em, por: h.por, texto: h.texto, legado: true}));
    const todos = [...novos, ...antigos].sort((a, b) => String(b.em).localeCompare(String(a.em)));
    el.innerHTML = `<ul class="timeline">${todos.slice(0, 60).map(h => `<li>${A.avatar(A.membro(h.por))}<div>${esc(h.texto)}<small>${esc(h.por ? A.nomeDe(h.por) : h.auto ? 'Automação' : 'Equipe')} · ${esc(A.quando(h.em))}${h.legado ? ' · registro antigo' : ''}${h.auto ? ' · automático' : ''}</small></div></li>`).join('') || '<li class="muted">Sem registros ainda.</li>'}</ul>${todos.length > 60 ? `<p class="muted" style="font-size:12px">Mostrando os 60 registros mais recentes de ${todos.length}.</p>` : ''}`;
  }
  const prev = A.aoAtualizar; A.aoAtualizar = c => { prev && prev(c); if (!(S.ui._modalCtx && S.ui._modalCtx.tipo === 'cliente')) return;
    if (['processos', 'prazos', 'fin_lancamentos', 'documentos', 'compromissos', 'tarefas', 'checklist_itens', 'checklist_modelos'].includes(c)) relacionados();
    if (['historico', 'checklist_itens', 'tarefas'].includes(c)) linhaDoTempo(); };

  /* ---------- migração do funil antigo (ao carregar; idempotente) ----------
     novo -> etapa 1; encaminhado/analise -> etapa 2, com registro "migrado do fluxo antigo, conferir etapa".
     ativo, encerrado e recusado não mudam. O status e o encaminhamento antigos continuam gravados. */
  A.migracoes.push(async () => {
    if (!A.pode('clientes', 'editar')) return;
    for (const c of A.col('clientes').slice()) {
      const m = R.migracaoCliente(c); if (!m) continue;
      const {conferir, ...campos} = m;
      if (!(await A.save('clientes', Object.assign({}, c, campos), {semHistorico: true}))) return;
      if (conferir) await A.registrar({id: 'mig-etapa-' + c.id, entidade: 'clientes', entidadeId: c.id, acao: 'migracao', campo: 'etapa', antes: null, depois: campos.etapa, origem: 'automacao',
        texto: `Migrado do fluxo antigo (${c.status === 'analise' ? 'em análise' : 'encaminhado'}): conferir a etapa`});
    }
  });
})(window.App);
