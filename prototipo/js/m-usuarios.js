/* Usuários do sistema: cadastro e estado de acesso, separado dos dados operacionais da Equipe. */
(function (A) {
  const esc = A.esc;
  const PERFIS = [['admin', 'Administrador'], ['advogado', 'Advogado'], ['assistente', 'Assistente'], ['consulta', 'Consulta']];
  const ESTADOS = [['todos', 'Todos os status'], ['ativo', 'Ativo'], ['inativo', 'Inativo'], ['pendente', 'Convite pendente']];
  const ui = () => A.ui('usuarios', { busca: '', perfil: 'todos', status: 'todos' });
  const rotuloStatus = s => ({ ativo: 'Ativo', inativo: 'Inativo', pendente: 'Convite pendente' }[s] || 'Convite pendente');
  const icone = (nome) => ({
    usuarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.8a4 4 0 0 1 0 7.6M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    editar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    chave: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 9-9 2 2-3 3 2 2-3 3-2-2-2.5 2.5"/></svg>',
  }[nome]);

  function vUsuarios() {
    const estado = ui(), todos = A.col('usuarios'), edita = A.pode('equipe', 'editar');
    const visiveis = todos.filter(u => A.match(estado.busca, u.nome, u.email)
      && (estado.perfil === 'todos' || u.perfil === estado.perfil)
      && (estado.status === 'todos' || (u.status || 'pendente') === estado.status))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    const ativos = todos.filter(u => u.status === 'ativo').length;
    const inativos = todos.filter(u => u.status === 'inativo').length;
    const pendentes = todos.filter(u => !u.status || u.status === 'pendente').length;
    const cards = [
      ['Total de usuários', todos.length, 'usuarios', 'azul'],
      ['Ativos', ativos, 'usuarios', 'verde'],
      ['Inativos', inativos, 'usuarios', 'dourado'],
      ['Perfis de acesso', PERFIS.length, 'chave', 'azul'],
    ].map(([label, n, i, cor]) => `<article class="u-stat"><span class="u-stat-icon ${cor}">${icone(i)}</span><span class="u-stat-copy"><span>${label}</span><strong>${n}</strong></span></article>`).join('');
    const linhas = visiveis.map(u => {
      const perfil = PERFIS.find(([id]) => id === u.perfil)?.[1] || 'Consulta';
      const status = u.status || 'pendente';
      return `<tr>
        <td><div class="u-person"><span class="u-avatar">${esc(A.iniciais(u.nome))}</span><span><strong>${esc(u.nome)}</strong><small>${esc(u.email)}</small></span></div></td>
        <td><span class="u-profile p-${esc(u.perfil)}">${esc(perfil)}</span></td>
        <td><span class="u-status s-${esc(status)}"><i></i>${rotuloStatus(status)}</span></td>
        <td class="u-date">${u.criadoEm ? esc(A.fmt(u.criadoEm)) : '—'}</td>
        <td>${edita ? `<div class="u-actions"><button class="btn small" data-action="usr-editar" data-id="${esc(u.id)}" aria-label="Editar ${esc(u.nome)}">Editar</button><button class="btn small ${status === 'ativo' ? 'u-disable' : 'primary'}" data-action="usr-status" data-id="${esc(u.id)}">${status === 'ativo' ? 'Desativar' : 'Ativar'}</button></div>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');
    const resultado = linhas || `<tr><td colspan="5"><div class="u-empty">${todos.length ? 'Nenhum usuário corresponde aos filtros.' : 'Nenhum usuário cadastrado. Use “Cadastrar usuário” para adicionar o primeiro.'}</div></td></tr>`;
    return `<div class="u-page">
      <div class="u-page-head"><div class="u-title"><span class="u-title-icon">${icone('usuarios')}</span><span><h2>Usuários</h2><p>Gerencie os funcionários que terão acesso ao sistema.</p></span></div>${edita ? '<button class="btn primary u-add" data-action="usr-novo"><span aria-hidden="true">+</span> Cadastrar usuário</button>' : ''}</div>
      <div class="u-stats">${cards}</div>
      <section class="panel u-panel"><div class="u-panel-head"><h3>Usuários cadastrados</h3><span class="muted">${todos.length} ${todos.length === 1 ? 'usuário' : 'usuários'}${pendentes ? ` · ${pendentes} convite(s) pendente(s)` : ''}</span></div>
        <div class="filters u-filters"><label class="u-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="Buscar por nome ou e-mail..." aria-label="Buscar usuários por nome ou e-mail" value="${esc(estado.busca)}" data-ui="usuarios.busca"></label>
          <select aria-label="Filtrar por perfil" data-ui="usuarios.perfil">${A.opts([['todos', 'Todos os perfis'], ...PERFIS], estado.perfil)}</select>
          <select aria-label="Filtrar por status" data-ui="usuarios.status">${A.opts(ESTADOS, estado.status)}</select>
        </div>
        <div class="tablewrap u-table-wrap"><table class="u-table"><thead><tr><th>Funcionário</th><th>Perfil de acesso</th><th>Status</th><th>Data de cadastro</th><th>Ações</th></tr></thead><tbody>${resultado}</tbody></table></div>
        <p class="u-invite-note">${pendentes ? `${pendentes} cadastro(s) aguardando convite. ` : ''}O envio do convite por e-mail e a criação de senha no primeiro acesso serão habilitados com a autenticação do sistema.</p>
      </section>
    </div>`;
  }

  A.route('usuarios', { label: 'Usuários', mod: 'equipe', render: vUsuarios });
  A.on('usr-novo', () => { if (A.pode('equipe', 'editar')) form(null); });
  A.on('usr-editar', el => { if (A.pode('equipe', 'editar')) form(A.byId('usuarios', el.dataset.id)); });
  A.on('usr-status', async el => {
    if (!A.pode('equipe', 'editar')) return;
    const usuario = A.byId('usuarios', el.dataset.id); if (!usuario) return;
    const status = usuario.status === 'ativo' ? 'inativo' : 'ativo';
    if (await A.save('usuarios', Object.assign({}, usuario, { status }))) A.toast(status === 'ativo' ? 'Usuário ativado.' : 'Usuário desativado.');
  });

  function form(usuario) {
    const novo = !usuario;
    const atual = Object.assign({ nome: '', email: '', perfil: 'advogado', status: 'pendente', convite: null }, usuario || {});
    A.modal(`${A.modalHead(novo ? 'Cadastrar usuário' : 'Editar usuário')}<form id="fUsuario"><div class="body">
      ${A.inp('uNome', 'Nome completo', atual.nome, 'autocomplete="name" required', 'full')}
      ${A.inp('uEmail', 'E-mail profissional', atual.email, 'type="email" autocomplete="email" required', 'full')}
      ${A.sel('uPerfil', 'Perfil de acesso', A.opts(PERFIS, atual.perfil), 'full')}
      ${novo ? '<p class="u-modal-hint">O cadastro será salvo como <strong>Convite pendente</strong>. O envio por e-mail e a definição de senha serão conectados futuramente.</p>' : `<p class="u-modal-hint">Status atual: <strong>${rotuloStatus(atual.status)}</strong>. ${atual.convite?.status === 'enviado' ? 'Convite enviado; aguardando primeiro acesso.' : ''}</p>`}
    </div><footer><button type="button" class="btn" data-action="modal-fechar">Cancelar</button><button type="submit" class="btn primary">${novo ? 'Cadastrar' : 'Salvar alterações'}</button></footer></form>`);
    document.getElementById('fUsuario').addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.pode('equipe', 'editar')) return;
      const email = A.v('uEmail').toLowerCase();
      const duplicado = A.col('usuarios').some(x => x.id !== atual.id && String(x.email || '').toLowerCase() === email);
      if (duplicado) { A.toast('Já existe um usuário cadastrado com este e-mail.'); document.getElementById('uEmail').focus(); return; }
      const obj = Object.assign({}, atual, { nome: A.v('uNome'), email, perfil: A.v('uPerfil') });
      if (novo) {
        obj.status = 'pendente';
        obj.convite = { status: 'nao_enviado', criadoEm: new Date().toISOString(), enviadoEm: null, aceitoEm: null };
      }
      if (await A.save('usuarios', obj)) { A.closeModal(); A.toast(novo ? 'Usuário cadastrado como convite pendente.' : 'Usuário atualizado.'); }
    });
  }
})(window.App);
