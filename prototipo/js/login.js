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

  const svgOlho = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>';

  function html() {
    return `<div class="lg-login-page">
  <section class="lg-login-card" role="main" aria-label="Acesso ao Gomes Sistema Jurídico">
    <div class="lg-brand">
      <img src="logo.png" alt="Gomes Assessoria Jurídica">
      <span class="lg-brand-subtitle">Sistema Jurídico</span>
    </div>
    <div class="lg-gold-rule" aria-hidden="true"></div>
    <div class="lg-heading">
      <h1>Acesso ao sistema</h1>
      <p>Entre com suas credenciais para continuar.</p>
    </div>
    <form id="loginForm" data-onsubmit="login-entrar" novalidate>
      <div class="lg-field">
        <label for="loginId">E-mail profissional</label>
        <div class="lg-input-wrap"><input id="loginId" name="email" type="text" placeholder="nome@escritorio.com.br" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
      </div>
      <div class="lg-field">
        <label for="loginSenha">Senha</label>
        <div class="lg-input-wrap"><input class="lg-password-input" id="loginSenha" name="password" type="password" placeholder="Digite sua senha" autocomplete="current-password"><button class="lg-toggle-password" type="button" data-action="login-ver-senha" aria-label="Mostrar senha" title="Mostrar senha">${svgOlho}</button></div>
      </div>
      <div class="lg-options">
        <label class="lg-remember"><input type="checkbox" id="loginLembrar"> Lembrar de mim</label>
        <a class="lg-forgot" href="#" data-action="login-esqueci">Esqueceu a senha?</a>
      </div>
      <button class="lg-submit-btn" type="submit">Entrar</button>
      <div class="lg-notice" id="loginMsg" role="status" aria-live="polite"></div>
    </form>
    <p class="lg-prototipo-aviso">Protótipo sem autenticação: a senha não é conferida. Se o e-mail, a OAB ou o nome estiver em Equipe, você entra como essa pessoa; senão, como administrador.</p>
    <div class="lg-footer"><span class="lg-lock" aria-hidden="true">◆</span>Ambiente de acesso restrito</div>
  </section>
</div>`;
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

  function aviso(txt, erro) { const f = document.getElementById('loginMsg'); if (!f) return; f.textContent = txt; f.classList.add('lg-show'); f.classList.toggle('erro', !!erro); }

  A.on('login-entrar', (form, e) => {
    e.preventDefault();
    const m = acharMembro(A.v('loginId')), valor = m ? m.id : ADMIN_SEM_NOME;
    if (document.getElementById('loginLembrar').checked) A.lsSet(CHAVE, valor); else { lsDel(CHAVE); ssSet(CHAVE, valor); }
    A.render(); A.toast(m ? 'Bem-vindo(a), ' + m.nome + '.' : 'Você entrou como administrador.');
  });
  A.on('login-ver-senha', el => {
    const p = document.getElementById('loginSenha'), mostrar = p.type === 'password';
    p.type = mostrar ? 'text' : 'password';
    const r = mostrar ? 'Ocultar senha' : 'Mostrar senha'; el.setAttribute('aria-label', r); el.title = r; el.classList.toggle('lg-ativo', mostrar);
  });
  A.on('login-esqueci', (el, e) => { e.preventDefault(); aviso('A recuperação de senha será habilitada junto com a autenticação. Por enquanto, fale com o administrador do escritório.'); });
  A.on('sair', () => { lsDel(CHAVE); A.closeModal && A.closeModal(); A.render(); });
})(window.App);
