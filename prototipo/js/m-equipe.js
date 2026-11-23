/* Módulo Equipe e permissões + Configurações (alertas, feriados, contas financeiras). */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const ui = () => A.ui('equipe', {aba: 'pessoas', anoFer: new Date().getFullYear()});

  function vEquipe() {
    const u = ui(), ed = A.pode('equipe', 'editar');
    const abas = `<div class="tabs-inline">${[['pessoas','Pessoas'],['permissoes','Permissões por papel']].map(([k, l]) => `<button data-action="eq-aba" data-v="${k}" aria-pressed="${u.aba === k}">${l}</button>`).join('')}</div>`;
    let corpo;
    if (u.aba === 'pessoas') {
      const ab = A.col('prazos').filter(p => p.status !== 'concluido');
      corpo = `<div class="team">${A.col('equipe').slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => { const meus = ab.filter(p => p.responsavelId === m.id); const urg = meus.filter(p => ['vencido','hoje','critico'].includes(A.sitPrazo(p))).length;
        const conta = m.contaId ? `<span class="tag">Conta vinculada${m.contaId === S.contaId ? ' (você)' : ''}</span>` : m.contaPendente ? '<span class="tag alta">Pedido de vínculo pendente</span>' : '<span class="muted" style="font-size:12px">Sem conta vinculada</span>';
        return `<div class="member"${m.ativo === false ? ' style="opacity:.6"' : ''}><div class="hd">${A.avatar(m, true)}<div><div class="nm">${esc(m.nome)}</div><div class="cg">${esc(m.cargo)}</div></div></div>
          <div class="stats"><span class="tag">${esc(A.PAPEL_LABEL[m.papel] || 'Sem papel')}</span>${conta}</div>
          <div class="info">${esc(m.oab || '')}${m.oab && m.email ? '<br>' : ''}${esc(m.email || '')}</div>
          <div class="stats"><span class="count" style="border-color:var(--line)">${meus.length} prazo(s) em aberto</span>${urg ? `<span class="count s-critico">${urg} urgente(s)</span>` : ''}</div>
          <div class="rowact" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn small" data-action="eq-ver-prazos" data-id="${esc(m.id)}">Ver prazos</button>
            ${ed ? `<button class="btn small" data-action="eq-editar" data-id="${esc(m.id)}">Editar</button>` : ''}
            ${ed && m.contaPendente ? `<button class="btn small primary" data-action="eq-aprovar" data-id="${esc(m.id)}">Aprovar vínculo</button><button class="btn small" data-action="eq-recusar" data-id="${esc(m.id)}">Recusar</button>` : ''}
            ${ed && m.contaId && m.contaId !== S.contaId ? `<button class="btn small" data-action="eq-desvincular" data-id="${esc(m.id)}">Desvincular conta</button>` : ''}</div></div>`; }).join('') || '<div class="empty">Ninguém cadastrado ainda.</div>'}</div>
        <div class="legend">Cada pessoa entra no sistema com a própria conta e clica em “Identificar-me na equipe”. O administrador aprova o vínculo aqui, e o papel da pessoa passa a definir o que ela vê e edita.</div>`;
    } else {
      const tab = (S.permissoes && S.permissoes.papeis) || A.PERM_PADRAO;
      corpo = `<div class="section-body"><p class="muted" style="margin:0">Defina o que cada papel pode fazer em cada módulo. <b>Nenhum</b> esconde o módulo, <b>Ver</b> permite consultar e <b>Editar</b> permite cadastrar, alterar e excluir. O dono do sistema sempre tem acesso total.</p>
        <div class="tablewrap"><table class="matrix"><thead><tr><th>Módulo</th>${A.PAPEIS.map(([k, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>
        ${A.MODULOS.map(([mod, nome]) => `<tr><td>${esc(nome)}</td>${A.PAPEIS.map(([pp]) => { const v = (tab[pp] && tab[pp][mod]) || A.PERM_PADRAO[pp][mod];
          return `<td>${ed && pp !== 'admin' ? `<select data-onchange="eq-perm" data-papel="${pp}" data-mod="${mod}" aria-label="${esc(nome)} para ${esc(A.PAPEL_LABEL[pp])}">${A.opts([['nenhum','Nenhum'],['ver','Ver'],['editar','Editar']], v)}</select>` : esc({nenhum:'Nenhum', ver:'Ver', editar:'Editar'}[v])}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        ${ed ? '<div><button class="btn small" data-action="eq-perm-padrao">Restaurar permissões padrão</button></div>' : ''}
        <p class="muted" style="font-size:12px;margin:0">Nesta versão as permissões controlam o que aparece e o que pode ser salvo na interface. No sistema definitivo, com servidor próprio, elas também serão aplicadas diretamente no banco de dados.</p></div>`;
    }
    return `<section class="panel"><div class="vhead"><h2>Equipe e permissões</h2><span class="muted">${A.col('equipe').length} pessoa(s)</span>${ed && u.aba === 'pessoas' ? '<button class="btn primary" data-action="eq-novo">+ Adicionar pessoa</button>' : ''}</div>${abas}${corpo}</section>`;
  }
  A.route('equipe', {label: 'Equipe e permissões', mod: 'equipe', render: vEquipe, badge: () => A.pode('equipe', 'editar') ? A.col('equipe').filter(m => m.contaPendente).length : 0});
  A.on('eq-aba', el => { ui().aba = el.dataset.v; A.render(); });
  A.on('eq-ver-prazos', el => { A.ui('agenda').resp = el.dataset.id; A.go('prazos'); });
  A.on('eq-perm', async el => { const base = JSON.parse(JSON.stringify((S.permissoes && S.permissoes.papeis) || A.PERM_PADRAO)); base[el.dataset.papel] = Object.assign({}, A.PERM_PADRAO[el.dataset.papel], base[el.dataset.papel], {[el.dataset.mod]: el.value});
    if (await A.saveDoc('config/permissoes', {papeis: base})) A.toast('Permissão atualizada.'); });
  A.on('eq-perm-padrao', () => A.confirm('Restaurar permissões', 'As permissões de todos os papéis voltam ao padrão do sistema.', 'Restaurar', async () => { await A.saveDoc('config/permissoes', {papeis: A.PERM_PADRAO}); A.toast('Permissões restauradas.'); }));
  A.on('eq-aprovar', async el => { const m = A.membro(el.dataset.id); if (!m || !m.contaPendente) return; const outro = A.col('equipe').find(x => x.contaId === m.contaPendente.id);
    if (outro) await A.save('equipe', Object.assign({}, outro, {contaId: null}));
    if (await A.save('equipe', Object.assign({}, m, {contaId: m.contaPendente.id, contaPendente: null}))) A.toast('Vínculo aprovado.'); });
  A.on('eq-recusar', async el => { const m = A.membro(el.dataset.id); if (m && await A.save('equipe', Object.assign({}, m, {contaPendente: null}))) A.toast('Pedido recusado.'); });
  A.on('eq-desvincular', el => { const m = A.membro(el.dataset.id); if (!m) return; A.confirm('Desvincular conta', `${m.nome} deixará de ter acesso com as permissões de ${A.PAPEL_LABEL[m.papel] || 'seu papel'} até um novo vínculo.`, 'Desvincular', async () => { await A.save('equipe', Object.assign({}, m, {contaId: null})); A.toast('Conta desvinculada.'); }); });
  A.on('eq-novo', () => form(null));
  A.on('eq-editar', el => form(A.membro(el.dataset.id)));
  function form(m) {
    const novo = !m; m = Object.assign({nome: '', cargo: '', papel: 'advogado', oab: '', email: '', cor: A.CORES[A.col('equipe').length % A.CORES.length], ativo: true}, m || {});
    const qtd = A.col('prazos').filter(p => p.responsavelId === m.id && p.status !== 'concluido').length;
    A.modal(`${A.modalHead(novo ? 'Adicionar pessoa' : 'Editar pessoa')}<form id="fMembro"><div class="body">
      ${A.inp('mNome', 'Nome', m.nome, 'required', 'full')}
      ${A.inp('mCargo', 'Cargo / função', m.cargo, 'list="cargosList"')}<datalist id="cargosList">${['Advogado(a) sócio(a)','Advogado(a)','Estagiário(a)','Assistente administrativa (captação)','Gerente','Controladoria jurídica','Secretário(a)'].map(c => `<option value="${c}">`).join('')}</datalist>
      ${A.sel('mPapel', 'Papel (define as permissões)', A.opts(A.PAPEIS, m.papel), '', m.id && m.contaId === S.contaId && m.papel === 'admin' && !S.isOwner ? 'disabled' : '')}
      ${A.inp('mOab', 'OAB', m.oab, 'placeholder="OAB/MG 123.456"')}${A.inp('mEmail', 'E-mail', m.email, 'type="email"')}
      ${A.sel('mGenero', 'Gênero (Dr./Dra. nos documentos)', A.opts([['','Não informado (Dr(a).)'],['F','Feminino (Dra., advogada)'],['M','Masculino (Dr., advogado)']], m.genero || ''))}
      ${A.field('mCor', 'Cor no calendário', `<input id="mCor" type="color" value="${esc(m.cor)}" style="height:36px;padding:2px">`)}
      ${A.sel('mAtivo', 'Situação', A.opts([['1','Ativo'],['0','Inativo (não recebe novos prazos)']], m.ativo === false ? '0' : '1'))}
    </div><footer>${!novo ? `<button type="button" class="btn danger left" data-action="eq-remover" data-id="${esc(m.id)}" data-qtd="${qtd}">Remover</button>` : ''}<button type="button" class="btn" data-action="modal-fechar">Cancelar</button><button type="submit" class="btn primary">Salvar</button></footer></form>`);
    document.getElementById('fMembro').addEventListener('submit', async e => { e.preventDefault();
      const obj = Object.assign({}, m, {nome: A.v('mNome'), cargo: A.v('mCargo'), papel: document.getElementById('mPapel').value, oab: A.v('mOab'), email: A.v('mEmail'), genero: A.v('mGenero'), cor: document.getElementById('mCor').value, ativo: A.v('mAtivo') === '1'});
      if (!obj.nome) return; if (await A.save('equipe', obj)) { A.closeModal(); A.toast('Equipe atualizada.'); } });
  }
  A.on('eq-remover', el => { const id = el.dataset.id, q = Number(el.dataset.qtd); A.confirm('Remover pessoa', q ? `Esta pessoa tem ${q} prazo(s) em aberto, que ficarão sem responsável. Para manter o histórico, prefira marcá-la como inativa.` : 'Esta pessoa será removida da equipe.', 'Remover', async () => { if (await A.remove('equipe', id)) A.toast('Pessoa removida.'); }); });

  /* ---------- configurações ---------- */
  function vConfig() {
    const u = ui(), ed = A.pode('equipe', 'editar'), edFin = ed || A.pode('financeiro', 'editar'), cfg = S.config;
    const nac = [...P.feriadosAno(u.anoFer)].filter(([, n]) => !n.endsWith('(local)')).sort();
    const loc = (cfg.feriadosLocais || []).slice().sort((a, b) => a.data.localeCompare(b.data));
    const contas = cfg.contas || [];
    return `<section class="panel"><div class="vhead"><h2>Configurações</h2></div><div class="hgrid">
      <div class="hbox"><h3>Escritório (usado nos modelos)</h3><p class="muted" style="margin:0 0 8px;font-size:12px">Preenchem os campos {{escritorio.nome}} e {{escritorio.cidade}} dos modelos de documentos e o cabeçalho dos documentos gerados.</p>
        <div class="form-inline"><input id="cEscNome" value="${esc(cfg.escritorioNome || '')}" placeholder="Nome do escritório" aria-label="Nome do escritório" style="flex:1 1 180px" ${ed ? '' : 'disabled'}><input id="cEscCidade" value="${esc(cfg.escritorioCidade || '')}" placeholder="Cidade/UF (ex.: Araguari/MG)" aria-label="Cidade e UF" style="flex:1 1 140px" ${ed ? '' : 'disabled'}>${ed ? '<button class="btn small" data-action="cfg-escritorio">Salvar</button>' : ''}</div></div>
      <div class="hbox"><h3>Alerta de prazos em tela</h3><p class="muted" style="margin:0 0 10px">A faixa do topo e o aviso de abertura destacam prazos vencidos, os que vencem hoje, os de até 2 dias úteis e os que vencem dentro desta antecedência.</p>
        <div class="form-inline"><label for="cAnt" class="muted" style="align-self:center">Avisar com</label><input id="cAnt" type="number" min="1" max="30" value="${esc(cfg.antecedencia)}" style="width:70px" ${ed ? '' : 'disabled'}><span class="muted" style="align-self:center">dias úteis</span>${ed ? '<button class="btn small" data-action="cfg-ant">Salvar</button>' : ''}</div>
        <p class="muted" style="margin:14px 0 0;font-size:12px">Contagem em dias úteis (CPC art. 219), a partir do 1º dia útil após a publicação (art. 224, §3º), sem fins de semana, feriados e o recesso de 20/12 a 20/01 (art. 220).</p></div>
      <div class="hbox"><h3 style="display:flex;justify-content:space-between;align-items:center">Feriados nacionais e forenses <span><button class="iconbtn" data-action="cfg-ano" data-d="-1" aria-label="Ano anterior">‹</button> <b class="num">${u.anoFer}</b> <button class="iconbtn" data-action="cfg-ano" data-d="1" aria-label="Próximo ano">›</button></span></h3>
        <ul class="hlist">${nac.map(([d, n]) => `<li><span class="num">${esc(A.fmtCurto(d))}</span><span>${esc(n)}</span></li>`).join('')}</ul></div>
      <div class="hbox"><h3>Feriados locais e suspensões de expediente</h3><ul class="hlist">${loc.map(f => `<li><span class="num">${esc(A.fmt(f.data))}</span><span>${esc(f.nome)} ${ed ? `<button class="btn small" data-action="cfg-rm-fer" data-data="${esc(f.data)}" aria-label="Remover ${esc(f.nome)}">×</button>` : ''}</span></li>`).join('') || '<li class="muted">Nenhum cadastrado.</li>'}</ul>
        ${ed ? '<form class="form-inline" id="fFer"><input id="ferData" type="date" required aria-label="Data"><input id="ferNome" placeholder="Ex.: suspensão de expediente TJMG" required aria-label="Nome" style="flex:1 1 140px"><button class="btn small primary" type="submit">Adicionar</button></form>' : ''}</div>
      <div class="hbox"><h3>Contas e caixas (financeiro)</h3><p class="muted" style="margin:0 0 8px;font-size:12px">Usadas nas baixas e no fluxo de caixa. O saldo inicial é o ponto de partida do fluxo.</p>
        <ul class="hlist">${contas.map(c => { const si = (cfg.saldosIniciais || {})[c] || {}; return `<li><span>${esc(c)}</span><span class="num">${si.valor != null ? A.brl(si.valor) + ' em ' + A.fmt(si.data) : '<span class="muted">sem saldo inicial</span>'} ${edFin ? `<button class="btn small" data-action="cfg-rm-conta" data-conta="${esc(c)}" aria-label="Remover ${esc(c)}">×</button>` : ''}</span></li>`; }).join('')}</ul>
        ${edFin ? `<form class="form-inline" id="fConta"><input id="ctNome" placeholder="Nome da conta (ex.: Banco X)" required aria-label="Nome da conta" style="flex:1 1 140px"><input id="ctData" type="date" value="${A.hoje()}" aria-label="Data do saldo inicial"><input id="ctValor" placeholder="Saldo inicial (R$)" inputmode="decimal" aria-label="Saldo inicial" style="width:140px"><button class="btn small primary" type="submit">Salvar conta</button></form>` : ''}</div>
    </div></section>`;
  }
  A.route('config', {label: 'Configurações', mod: 'equipe', render: vConfig});
  A.on('cfg-ano', el => { ui().anoFer += Number(el.dataset.d); A.render(); });
  A.on('cfg-ant', async () => { const v = Math.min(30, Math.max(1, Number(A.v('cAnt')) || 5)); await A.saveDoc('config/geral', Object.assign({}, S.config, {antecedencia: v})); A.toast('Antecedência salva.'); });
  A.on('cfg-escritorio', async () => { const nome = A.v('cEscNome'), cidade = A.v('cEscCidade'); if (!nome || !cidade) { A.toast('Informe o nome e a cidade do escritório.'); return; }
    if (await A.saveDoc('config/geral', Object.assign({}, S.config, {escritorioNome: nome, escritorioCidade: cidade}))) A.toast('Dados do escritório salvos.'); });
  A.on('cfg-rm-fer', async el => { await A.saveDoc('config/geral', Object.assign({}, S.config, {feriadosLocais: (S.config.feriadosLocais || []).filter(f => f.data !== el.dataset.data)})); });
  A.on('cfg-rm-conta', el => { const c = el.dataset.conta; A.confirm('Remover conta', `“${c}” deixa de aparecer nas baixas. Lançamentos já registrados nela continuam.`, 'Remover', async () => { const si = Object.assign({}, S.config.saldosIniciais); delete si[c]; await A.saveDoc('config/geral', Object.assign({}, S.config, {contas: (S.config.contas || []).filter(x => x !== c), saldosIniciais: si})); }); });
  document.addEventListener('submit', async e => {
    if (e.target.id === 'fFer') { e.preventDefault(); const d = A.v('ferData'), n = A.v('ferNome'); if (!d || !n) return;
      await A.saveDoc('config/geral', Object.assign({}, S.config, {feriadosLocais: [...(S.config.feriadosLocais || []).filter(f => f.data !== d), {data: d, nome: n}]})); A.toast('Feriado adicionado.'); }
    if (e.target.id === 'fConta') { e.preventDefault(); const n = A.v('ctNome'); if (!n) return; const si = Object.assign({}, S.config.saldosIniciais, {[n]: {data: A.v('ctData') || A.hoje(), valor: A.cents(A.v('ctValor'))}});
      await A.saveDoc('config/geral', Object.assign({}, S.config, {contas: [...new Set([...(S.config.contas || []), n])], saldosIniciais: si})); A.toast('Conta salva.'); }
  });
})(window.App);
