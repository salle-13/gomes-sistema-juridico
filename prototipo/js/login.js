/* Tela de acesso (login). Só vale no modo local: no modo compartilhado (artifact do Claude) a identidade vem da conta.
   Por enquanto SEM AUTENTICAÇÃO: "Entrar" sempre abre o sistema e nada é conferido. Se o e-mail, a OAB ou o nome digitado
   bater com alguém da Equipe, entra como essa pessoa; senão, como administrador sem nome (ADMIN_SEM_NOME).
   A autenticação de verdade virá com o backend (roadmap, item 4). */
(function (A) {
  const S = A.S;
  const CHAVE = 'gomes-eu';
  const ADMIN_SEM_NOME = '*';
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} try { sessionStorage.removeItem(k); } catch (e) {} };

  /* Id do membro logado neste navegador: primeiro a sessão da aba, depois o "Lembrar de mim". */
  A.sessaoId = () => ssGet(CHAVE) || A.lsGet(CHAVE) || '';

  const semTitulo = s => A.norm(s).replace(/^\s*dra?\.\s*/, '').replace(/\s+/g, ' ').trim();
  const soDigitos = s => String(s || '').replace(/\D/g, '');
  /* Procura o membro ativo pelo que foi digitado: e-mail, OAB (só os números), nome completo ou primeiro nome (se único). */
  function acharMembro(txt) {
    const t = String(txt || '').trim(); if (!t) return null;
    const ativos = A.col('equipe').filter(m => m.ativo !== false);
    const n = semTitulo(t), dig = soDigitos(t);
    return ativos.find(m => m.email && A.norm(m.email) === A.norm(t))
      || (dig.length >= 4 ? ativos.find(m => m.oab && soDigitos(m.oab) === dig) : null)
      || ativos.find(m => semTitulo(m.nome) === n)
      || (() => { const v = ativos.filter(m => semTitulo(m.nome).split(' ')[0] === n); return v.length === 1 ? v[0] : null; })();
  }

  const svgEmail = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>';
  const svgSenha = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  const svgOlho = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>';

  function html() {
    const cidade = A.esc(S.config.escritorioCidade || 'Araguari/MG');
    return `<main class="login-page">
  <section class="brand-panel" aria-label="Gomes Assessoria Jurídica">
    <div class="brand-top"><img src="logo.png" alt=""><span>GOMES<br><small>ASSESSORIA JURÍDICA</small></span></div>
    <div class="brand-message">
      <span class="eyebrow">GESTÃO JURÍDICA</span>
      <h1>Seu escritório.<br>Em <em>evolução.</em></h1>
      <p>Organização, clareza e eficiência para acompanhar cada detalhe da rotina jurídica.</p>
      <div class="brand-rule"><span></span><span></span><span></span></div>
    </div>
    <div class="brand-bottom"><span>${cidade}</span><span>GOMES ASSESSORIA JURÍDICA</span></div>
  </section>
  <section class="form-panel">
    <div class="form-wrap">
      <div class="mobile-brand"><img src="logo.png" alt=""><span>Gomes <small>Assessoria Jurídica</small></span></div>
      <div class="welcome"><span class="eyebrow">ÁREA RESTRITA</span><h2>Bem-vindo de volta</h2><p>Entre com seus dados para acessar o sistema.</p></div>
      <form id="loginForm" data-onsubmit="login-entrar" novalidate>
        <label for="loginId">E-mail</label>
        <div class="field">${svgEmail}<input id="loginId" name="email" type="text" placeholder="seu@email.com" autocomplete="username"></div>
        <label for="loginSenha">Senha</label>
        <div class="field">${svgSenha}<input id="loginSenha" name="password" type="password" placeholder="Digite sua senha" autocomplete="current-password"><button class="show-password" type="button" data-action="login-ver-senha" aria-label="Mostrar senha">${svgOlho}</button></div>
        <div class="form-options"><label class="remember"><input type="checkbox" id="loginLembrar"><span>Lembrar de mim</span></label><a href="#" data-action="login-esqueci">Esqueceu sua senha?</a></div>
        <button class="submit" type="submit">Entrar no sistema <span aria-hidden="true">→</span></button>
        <div class="feedback" id="loginMsg" role="status" aria-live="polite"></div>
      </form>
      <div class="security-note"><span class="shield">✓</span><span>Ambiente de acesso restrito<br><small>Protótipo sem autenticação: a senha não é conferida. Se o e-mail, a OAB ou o nome estiver em Equipe, você entra como essa pessoa; senão, como administrador.</small></span></div>
      <footer>© Gomes Assessoria Jurídica <span>·</span> Sistema Jurídico</footer>
    </div>
  </section>
</main>`;
  }

  /* Chamado por renderNow. Devolve true quando a tela de acesso está à frente (o sistema não deve ser desenhado). */
  A.renderLogin = function () {
    const el = document.getElementById('login');
    const precisa = S.mode === 'local' && !A.sessaoId();
    document.body.classList.toggle('com-login', precisa);
    if (!precisa) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; } return false; }
    if (el.hidden || !el.firstChild) { el.innerHTML = html(); el.hidden = false; const i = document.getElementById('loginId'); if (i) i.focus(); }
    return true;
  };

  function aviso(txt, erro) { const f = document.getElementById('loginMsg'); if (!f) return; f.textContent = txt; f.classList.add('visible'); f.classList.toggle('erro', !!erro); }

  A.on('login-entrar', (form, e) => {
    e.preventDefault();
    const m = acharMembro(A.v('loginId')), valor = m ? m.id : ADMIN_SEM_NOME;
    if (document.getElementById('loginLembrar').checked) A.lsSet(CHAVE, valor); else { lsDel(CHAVE); ssSet(CHAVE, valor); }
    A.render(); A.toast(m ? 'Bem-vindo(a), ' + m.nome + '.' : 'Você entrou como administrador.');
  });
  A.on('login-ver-senha', el => {
    const p = document.getElementById('loginSenha'), mostrar = p.type === 'password';
    p.type = mostrar ? 'text' : 'password';
    el.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha'); el.classList.toggle('active', mostrar);
  });
  A.on('login-esqueci', (el, e) => { e.preventDefault(); aviso('A recuperação de senha será habilitada junto com a autenticação. Por enquanto, fale com o administrador do escritório.'); });
  A.on('sair', () => { lsDel(CHAVE); A.closeModal && A.closeModal(); A.render(); });
})(window.App);
