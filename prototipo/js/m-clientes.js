/* Módulo Clientes: captação (funil), carteira de clientes ativos e arquivo de casos não aceitos. */
(function (A) {
  const S = A.S, esc = A.esc;
  const ui = () => A.ui('clientes', {aba: 'captacao', busca: '', paraMim: false, cart: 'ativo'});
  const st = c => c.status === 'aceito' ? 'ativo' : (c.status || 'novo');
  const FUNIL = [['novo','Novos cadastros'],['encaminhado','Encaminhados'],['analise','Em análise'],['aceitos','Aceitos (últimos 7 dias)']];
  const ST_LABEL = {novo:'Novo cadastro', encaminhado:'Encaminhado', analise:'Em análise', ativo:'Cliente ativo', encerrado:'Encerrado', recusado:'Não aceito'};
  const ORIGENS = ['Indicação de cliente','Site / formulário','Instagram','WhatsApp','Telefone','Atendimento presencial','Parceiro'];
  const advogadoEu = () => A.me() && ['advogado','admin'].includes(A.me().papel);
  A.aguardando = () => A.col('clientes').filter(c => st(c) === 'encaminhado' && (!advogadoEu() || (c.encaminhadoPara || []).includes(S.meId)));
  const recente = c => c.aceitoEm && (Date.now() - new Date(c.aceitoEm).getTime()) < 7 * 86400000;

  function card(c) {
    const paraMim = st(c) === 'encaminhado' && S.meId && (c.encaminhadoPara || []).includes(S.meId);
    const nd = A.col('documentos').filter(d => d.clienteId === c.id).length;
    return `<button class="ccard${paraMim ? ' paramim' : ''}" data-action="abrir-cliente" data-id="${esc(c.id)}"><span class="t">${esc(c.nome)}</span>
      <span class="meta"><span class="tag">${esc(c.area || 'Área não informada')}</span>${c.urgencia === 'alta' ? '<span class="tag alta">Urgente</span>' : ''}${paraMim ? '<span class="tag">Para você</span>' : ''}</span>
      ${c.historia ? `<span class="hist">${esc(c.historia)}</span>` : ''}<span class="meta">${nd} documento${nd === 1 ? '' : 's'} · ${esc(A.haDias(c.criadoEm))}${(c.encaminhadoPara || []).length ? ` · <span class="avs">${c.encaminhadoPara.map(id => A.avatar(A.membro(id))).join('')}</span>` : ''}</span></button>`;
  }
  function filtrados() { const u = ui(); let arr = A.col('clientes').filter(c => A.match(u.busca, c.nome, c.documento, c.area, c.historia, c.telefone, c.email));
    if (u.paraMim && S.meId) arr = arr.filter(c => (c.encaminhadoPara || []).includes(S.meId) || c.cadastradoPor === S.meId || c.responsavelId === S.meId); return arr; }
  function carteira() { const u = ui(); return filtrados().filter(c => u.cart === 'todos' ? ['ativo','encerrado'].includes(st(c)) : st(c) === u.cart).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); }
  A.exportadores.carteira = () => ({titulo: 'Carteira de clientes', linhas: carteira(), colunas: [{t:'Cliente', v:c => c.nome}, {t:'Tipo', v:c => c.tipoPessoa}, {t:'CPF/CNPJ', v:c => c.documento}, {t:'Telefone', v:c => c.telefone}, {t:'E-mail', v:c => c.email},
    {t:'Área', v:c => c.area}, {t:'Responsável', v:c => A.membro(c.responsavelId)?.nome || ''}, {t:'Processos', v:c => A.col('processos').filter(p => p.clienteId === c.id).length},
    {t:'A receber em aberto', v:c => A.col('fin_lancamentos').filter(f => f.clienteId === c.id && f.tipo === 'receber' && f.status === 'pendente').reduce((s, f) => s + f.valor, 0), tipo:'money'}, {t:'Situação', v:c => ST_LABEL[st(c)]}]});

  function vClientes() {
    const u = ui(), ed = A.pode('clientes', 'editar'), arr = filtrados();
    const abas = [['captacao','Captação'],['carteira','Carteira de clientes'],['arquivo','Não aceitos']];
    let corpo = '';
    if (u.aba === 'captacao') {
      corpo = `<div class="board" style="grid-template-columns:repeat(4,minmax(230px,1fr))">${FUNIL.map(([k, nome]) => { const l = k === 'aceitos' ? arr.filter(c => st(c) === 'ativo' && recente(c)) : arr.filter(c => st(c) === k);
        return `<div class="col"><h3><span>${esc(nome)}</span><span class="num">${l.length}</span></h3>${l.map(card).join('') || '<span class="muted" style="font-size:12px">Nenhum</span>'}</div>`; }).join('')}</div>
        <div class="legend">A assistente cadastra o cliente, conta a história do caso, anexa documentos e encaminha às advogadas. Quando a advogada aceita, o caso sai do funil e entra na Carteira de clientes (fica visível aqui por 7 dias como confirmação). Casos não aceitos vão para o arquivo.</div>`;
    } else if (u.aba === 'carteira') {
      const lst = carteira();
      corpo = `<div class="filters"><div class="subtabs">${[['ativo','Ativos'],['encerrado','Encerrados'],['todos','Todos']].map(([k, l]) => `<button data-action="cli-cart" data-v="${k}" aria-pressed="${u.cart === k}">${l}</button>`).join('')}</div>${A.botoesExport('carteira')}</div>
        <div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Área</th><th>Responsável</th><th>Processos</th><th>Prazos abertos</th>${A.pode('financeiro', 'ver') ? '<th class="money">A receber</th>' : ''}</tr></thead><tbody>
        ${lst.map(c => { const procs = A.col('processos').filter(p => p.clienteId === c.id).length, prz = A.col('prazos').filter(p => p.clienteId === c.id && p.status !== 'concluido').length, m = A.membro(c.responsavelId);
          const rec = A.col('fin_lancamentos').filter(f => f.clienteId === c.id && f.tipo === 'receber' && f.status === 'pendente').reduce((s, f) => s + f.valor, 0);
          return `<tr class="row-click" data-action="abrir-cliente" data-id="${esc(c.id)}"><td><b>${esc(c.nome)}</b><br><span class="muted" style="font-size:12px">${esc(c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF')} ${esc(c.documento || '—')}</span></td>
            <td>${esc(c.telefone || '')}<br><span class="muted" style="font-size:12px">${esc(c.email || '')}</span></td><td><span class="tag">${esc(c.area || '—')}</span></td><td><span class="who">${A.avatar(m)}${esc(m?.nome || '—')}</span></td>
            <td class="num">${procs}</td><td class="num">${prz}</td>${A.pode('financeiro', 'ver') ? `<td class="money">${rec ? A.brl(rec) : '—'}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="7" class="empty" style="padding:16px">Nenhum cliente.</td></tr>'}</tbody></table></div>`;
    } else {
      const lst = arr.filter(c => st(c) === 'recusado');
      corpo = `<div class="plist" style="padding:14px">${lst.map(c => `<button class="pcard" style="--c:var(--line)" data-action="abrir-cliente" data-id="${esc(c.id)}"><span class="t">${esc(c.nome)}</span><span class="meta">${esc(c.area || '')} · ${esc(A.haDias(c.criadoEm))}</span><span class="meta">${esc(((c.historico || []).filter(h => /não aceito/i.test(h.texto)).pop() || {}).texto || '')}</span></button>`).join('') || '<div class="empty">Nenhum caso arquivado.</div>'}</div>`;
    }
    return `<section class="panel"><div class="vhead"><h2>Clientes</h2>${ed ? '<button class="btn primary" data-action="novo-cliente">+ Cadastrar novo cliente</button>' : ''}</div>
      <div class="tabs-inline">${abas.map(([k, l]) => `<button data-action="cli-aba" data-v="${k}" aria-pressed="${u.aba === k}">${l}</button>`).join('')}</div>
      <div class="filters"><input id="clBusca" type="search" data-ui="clientes.busca" placeholder="Buscar nome, CPF/CNPJ, área, história…" value="${esc(u.busca)}" style="flex:1 1 260px">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="clMim" data-ui="clientes.paraMim" ${u.paraMim ? 'checked' : ''} ${S.meId ? '' : 'disabled'}> Só os meus</label></div>${corpo}</section>`;
  }
  A.route('clientes', {label: 'Clientes', mod: 'clientes', render: vClientes, badge: () => A.aguardando().length});
  A.on('cli-aba', el => { ui().aba = el.dataset.v; A.render(); });
  A.on('cli-cart', el => { ui().cart = el.dataset.v; A.render(); });

  /* ---------- ficha ---------- */
  let cli = null;
  A.on('novo-cliente', () => abrir(null));
  A.on('abrir-cliente', el => { const c = A.cliente(el.dataset.id); if (c) abrir(c); });
  function abrir(c) {
    cli = c ? JSON.parse(JSON.stringify(c)) : {id: A.uid(), _novo: true, nome: '', tipoPessoa: 'PF', documento: '', telefone: '', email: '', endereco: '', origem: '', area: '', urgencia: 'normal', historia: '', status: 'novo', encaminhadoPara: [], responsavelId: '', cadastradoPor: S.meId || null, criadoEm: new Date().toISOString(), historico: []};
    cli.status = st(cli); S.ui._modalCtx = {tipo: 'cliente', id: cli.id}; desenhar();
  }
  function desenhar() {
    const c = cli, s = c.status, ed = A.pode('clientes', 'editar'), ro = ed ? '' : 'disabled', funil = ['novo','encaminhado','analise','recusado'].includes(s);
    const acoes = !ed ? '' : [
      (s === 'novo' || s === 'recusado') ? '<button type="button" class="btn primary small" data-action="cl-encaminhar">Encaminhar para as selecionadas</button>' : '',
      s === 'encaminhado' ? '<button type="button" class="btn small" data-action="cl-encaminhar">Atualizar encaminhamento</button><button type="button" class="btn primary small" data-action="cl-status" data-st="analise">Assumir análise</button>' : '',
      (s === 'encaminhado' || s === 'analise') ? '<button type="button" class="btn small" data-action="cl-status" data-st="ativo">Aceitar caso</button><button type="button" class="btn danger small" data-action="cl-status" data-st="recusado">Não aceitar</button>' : '',
      s === 'ativo' ? '<button type="button" class="btn small" data-action="cl-status" data-st="encerrado">Encerrar atendimento</button>' : '', s === 'encerrado' ? '<button type="button" class="btn small" data-action="cl-status" data-st="ativo">Reativar cliente</button>' : ''].join('');
    const body = `${A.modalHead(c._novo ? 'Cadastrar novo cliente' : c.nome, `<span class="tag">${esc(ST_LABEL[s])}</span>`).replace('data-action="modal-fechar"', 'data-action="modal-fechar"')}
    <form id="fCliente"><div class="cgrid"><div>
      ${A.inp('cNome', 'Nome / razão social', c.nome, `required ${ro}`)}
      <div class="two">${A.sel('cTipo', 'Pessoa', A.opts([['PF','Física'],['PJ','Jurídica']], c.tipoPessoa), '', `${ro} data-onchange="cl-tipo"`)}${A.inp('cDoc', 'CPF / CNPJ', c.documento, ro)}
        ${A.inp('cTel', 'Telefone / WhatsApp', c.telefone, ro)}${A.inp('cEmail', 'E-mail', c.email, `type="email" ${ro}`)}
        ${A.sel('cArea', 'Área', A.opts(A.AREAS, c.area, 'Selecione'), '', ro)}${A.inp('cOrig', 'Como chegou', c.origem, `list="origList" ${ro}`)}<datalist id="origList">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        ${A.sel('cUrg', 'Urgência', A.opts([['normal','Normal'],['alta','Alta (prazo correndo, audiência próxima…)']], c.urgencia), '', ro)}${A.sel('cResp', 'Advogado(a) responsável', A.optsEquipe(c.responsavelId), '', ro)}</div>
      ${A.inp('cEnd', 'Endereço', c.endereco, ro, 'full')}
      <div id="cliPF" class="two" style="${c.tipoPessoa === 'PJ' ? 'display:none' : ''}">
        ${A.inp('cNac', 'Nacionalidade', c.nacionalidade, `list="nacList" placeholder="brasileiro(a)" ${ro}`)}<datalist id="nacList"><option value="brasileiro"><option value="brasileira"></datalist>
        ${A.inp('cEstCiv', 'Estado civil', c.estadoCivil, `list="ecList" ${ro}`)}<datalist id="ecList">${['solteiro','solteira','casado','casada','divorciado','divorciada','viúvo','viúva','em união estável'].map(o => `<option value="${o}">`).join('')}</datalist>
        ${A.inp('cProf', 'Profissão', c.profissao, ro)}${A.inp('cRg', 'RG (nº e órgão emissor)', c.rg, `placeholder="MG-12.345.678 SSP/MG" ${ro}`)}</div>
      <div id="cliPJ" class="two" style="${c.tipoPessoa === 'PJ' ? '' : 'display:none'}">
        ${A.inp('cRepNome', 'Representante legal', c.representanteNome, ro)}${A.inp('cRepCpf', 'CPF do representante', c.representanteCpf, ro)}
        ${A.inp('cRepCargo', 'Cargo do representante', c.representanteCargo, `list="cargoRepList" placeholder="sócio-administrador" ${ro}`)}<datalist id="cargoRepList">${['sócio-administrador','sócia-administradora','diretor','diretora','procurador','procuradora'].map(o => `<option value="${o}">`).join('')}</datalist></div>
      <div class="muted" style="font-size:12px;margin-top:-6px">Os dados acima entram na qualificação das procurações, contratos e declarações (Modelos de documentos).</div>
      ${A.area('cHist', 'História do caso', c.historia, 8, `${ro} placeholder="O que aconteceu, quando, quem é a outra parte, o que o cliente quer, provas que tem, prazos que já correm…"`)}
      <div class="muted" style="font-size:12px">Cadastrado por ${esc(c.cadastradoPor ? A.nomeDe(c.cadastradoPor) : '—')} em ${esc(A.quando(c.criadoEm))}</div>
    </div><div>
      ${funil || ed ? `<div class="box"><h4>${funil ? 'Encaminhar para' : 'Andamento do cliente'}</h4>${funil ? `<div class="checks">${A.col('equipe').filter(m => ['advogado','admin'].includes(m.papel)).map(m => `<label><input type="checkbox" name="enc" value="${esc(m.id)}"${(c.encaminhadoPara || []).includes(m.id) ? ' checked' : ''} ${ro}>${A.avatar(m)} ${esc(m.nome)}</label>`).join('') || '<span class="muted">Cadastre advogados na Equipe.</span>'}</div>` : ''}<div class="statusbar">${acoes}</div></div>` : ''}
      <div id="clRel"></div>
      <div class="box"><h4>Histórico</h4><ul class="timeline">${(c.historico || []).slice().reverse().map(h => `<li>${A.avatar(A.membro(h.por))}<div>${esc(h.texto)}<small>${esc(h.por ? A.nomeDe(h.por) : 'Equipe')} · ${esc(A.quando(h.em))}</small></div></li>`).join('') || '<li class="muted">Sem registros ainda.</li>'}</ul>
        ${ed ? '<div style="display:flex;gap:6px"><input id="cNota" placeholder="Anotação ou motivo (ex.: pedir CTPS ao cliente)" style="flex:1" aria-label="Anotação"><button type="button" class="btn small" data-action="cl-nota">Anotar</button></div>' : ''}</div>
    </div></div>
    <footer>${!c._novo && ed ? '<button type="button" class="btn danger left" data-action="cl-excluir">Excluir cadastro</button>' : ''}<button type="button" class="btn" data-action="modal-fechar">${ed ? 'Cancelar' : 'Fechar'}</button>${ed ? '<button type="submit" class="btn primary">Salvar</button>' : ''}</footer></form>`;
    const ex = document.querySelector('.modal.wide'); if (ex && document.getElementById('fCliente')) ex.innerHTML = body; else A.modal(body, {wide: true});
    relacionados();
    document.getElementById('fCliente').addEventListener('submit', async e => { e.preventDefault(); if (await salvar()) { A.closeModal(); A.toast('Cliente salvo.'); } });
  }
  function ler() { const v = A.v; if (!document.getElementById('fCliente')) return cli;
    Object.assign(cli, {nome: v('cNome'), tipoPessoa: v('cTipo'), documento: v('cDoc'), telefone: v('cTel'), email: v('cEmail'), area: v('cArea'), origem: v('cOrig'), urgencia: v('cUrg'), responsavelId: v('cResp'), endereco: v('cEnd'), historia: v('cHist'),
      nacionalidade: v('cNac'), estadoCivil: v('cEstCiv'), profissao: v('cProf'), rg: v('cRg'), representanteNome: v('cRepNome'), representanteCpf: v('cRepCpf'), representanteCargo: v('cRepCargo'),
      encaminhadoPara: document.querySelector('input[name="enc"]') ? [...document.querySelectorAll('input[name="enc"]:checked')].map(i => i.value) : cli.encaminhadoPara}); return cli; }
  async function salvar(extra, registro) { const c = ler(); if (!c.nome) { A.toast('Informe o nome do cliente.'); return null; }
    const hist = [...(c.historico || [])], agora = new Date().toISOString();
    if (c._novo) hist.push({em: agora, por: S.meId || null, texto: 'Cliente cadastrado.'}); if (registro) hist.push({em: agora, por: S.meId || null, texto: registro});
    const obj = Object.assign({}, c, extra || {}, {historico: hist}); delete obj._novo; const r = await A.save('clientes', obj); if (r) cli = JSON.parse(JSON.stringify(r)); return r; }
  A.salvarClienteAberto = async txt => { if (cli && S.ui._modalCtx && S.ui._modalCtx.tipo === 'cliente') { if (cli._novo || txt) { const r = await salvar(null, txt); if (r) desenhar(); return r; } return cli; } return null; };
  A.on('cl-encaminhar', async () => { const c = ler(); if (!c.encaminhadoPara.length) { A.toast('Marque ao menos uma advogada.'); return; }
    if (await salvar({status: 'encaminhado'}, 'Encaminhado para ' + c.encaminhadoPara.map(A.nomeDe).join(', ') + '.')) { A.toast('Caso encaminhado.'); desenhar(); } });
  A.on('cl-status', async el => { const s = el.dataset.st, nota = (document.getElementById('cNota')?.value || '').trim();
    if (s === 'recusado' && !nota) { A.toast('Escreva o motivo no campo de anotação antes de marcar como não aceito.'); document.getElementById('cNota')?.focus(); return; }
    const extra = {status: s}; if (s === 'ativo' && !cli.aceitoEm) { extra.aceitoEm = new Date().toISOString(); extra.responsavelId = cli.responsavelId || (advogadoEu() ? S.meId : (cli.encaminhadoPara || [])[0] || ''); }
    const txt = {analise: 'Assumiu a análise do caso.', ativo: cli.status === 'encerrado' ? 'Cliente reativado.' : 'Caso aceito: cliente entrou na carteira.', recusado: 'Caso não aceito: ' + nota, encerrado: 'Atendimento encerrado.' + (nota ? ' ' + nota : '')}[s];
    if (await salvar(extra, txt)) { A.toast(ST_LABEL[s] + '.'); desenhar(); } });
  A.on('cl-tipo', el => { const pj = el.value === 'PJ', a = document.getElementById('cliPF'), b = document.getElementById('cliPJ'); if (a) a.style.display = pj ? 'none' : ''; if (b) b.style.display = pj ? '' : 'none'; });
  A.on('cl-nota', async () => { const n = (document.getElementById('cNota')?.value || '').trim(); if (n && await salvar(null, n)) desenhar(); });
  A.on('cl-excluir', () => { const id = cli.id; A.confirm('Excluir cadastro', 'O cadastro e o histórico deste cliente serão apagados. Processos, prazos, documentos e lançamentos continuam, sem vínculo.', 'Excluir', async () => { if (await A.remove('clientes', id)) A.toast('Cadastro excluído.'); }); });
  A.on('cl-novo-processo', async () => { if (cli._novo && !(await salvar())) return; const id = cli.id; A.closeModal(); A.abrirProcessoNovo ? A.abrirProcessoNovo({clienteId: id}) : null; });
  function relacionados() {
    const el = document.getElementById('clRel'); if (!el || !cli) return; const id = cli.id, s = cli.status;
    const procs = A.col('processos').filter(p => p.clienteId === id), prz = A.col('prazos').filter(p => p.clienteId === id && p.status !== 'concluido').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const fin = A.col('fin_lancamentos').filter(f => f.clienteId === id && f.status === 'pendente');
    el.innerHTML = `${['ativo','encerrado'].includes(s) ? `<div class="box"><h4>Processos</h4>${procs.map(p => `<button type="button" class="pcard" style="--c:var(--accent)" data-action="abrir-processo" data-id="${esc(p.id)}"><span class="t proc">${esc(p.numero)}</span><span class="meta">${esc(p.classe || '')} · ${esc(p.vara || '')} · x ${esc(p.parteContraria || '')}</span></button>`).join('') || '<span class="muted" style="font-size:12px">Nenhum processo.</span>'}
        ${A.pode('processos', 'editar') ? '<div><button type="button" class="btn small" data-action="cl-novo-processo">+ Novo processo para este cliente</button></div>' : ''}</div>
      <div class="box"><h4>Prazos em aberto</h4><div class="plist">${prz.slice(0, 5).map(A.pcardPrazo).join('') || '<span class="muted" style="font-size:12px">Nenhum.</span>'}</div></div>
      ${A.pode('financeiro', 'ver') ? `<div class="box"><h4>Financeiro em aberto</h4><dl class="dl"><dt>A receber</dt><dd class="num">${A.brl(fin.filter(f => f.tipo === 'receber').reduce((a, f) => a + f.valor, 0))}</dd><dt>Despesas a reembolsar</dt><dd class="num">${A.brl(A.col('fin_lancamentos').filter(f => f.clienteId === id && f.tipo === 'pagar' && f.reembolsavel && f.status !== 'cancelado').reduce((a, f) => a + f.valor, 0))}</dd></dl></div>` : ''}` : ''}
      ${A.pode('documentos', 'ver') && A.blocoDocumentos ? `<div class="box"><h4>Documentos do cliente</h4>${A.blocoDocumentos({clienteId: id})}</div>` : ''}
      ${A.blocoGerarDocumento ? A.blocoGerarDocumento('cliente') : ''}`;
  }
  const prev = A.aoAtualizar; A.aoAtualizar = c => { prev && prev(c); if (S.ui._modalCtx && S.ui._modalCtx.tipo === 'cliente' && ['processos','prazos','fin_lancamentos','documentos'].includes(c)) relacionados(); };
})(window.App);
