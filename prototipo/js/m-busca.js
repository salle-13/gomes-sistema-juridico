/* Busca global no cabeçalho: pastas, números de processo (CNJ) e pessoas (clientes, partes contrárias e equipe).
   O campo fica fixo no index.html (para não perder o foco ao redesenhar); só a lista de resultados é redesenhada.
   Respeita as permissões: cada grupo só aparece para quem pode ver o módulo. */
(function (A) {
  const esc = A.esc;
  const MAX = 6;
  const ui = () => A.ui('busca', {q: '', aberto: false, sel: 0});
  const dig = s => String(s || '').replace(/\D/g, '');
  const ST_CLI = {novo: 'Em captação', encaminhado: 'Em captação', analise: 'Em captação', ativo: 'Ativo', aceito: 'Ativo', encerrado: 'Encerrado', recusado: 'Arquivado'};
  const ST_PROC = {ativo: 'Ativo', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado'};

  /* Pontuação: quanto menor, mais relevante. -1 = não combina. */
  function pontuarTexto(q, ...campos) {
    const n = A.norm(q).trim(); if (!n) return -1;
    let melhor = -1;
    campos.forEach((c, i) => { const t = A.norm(c); if (!t) return;
      const p = t.startsWith(n) ? 0 : t.split(/[\s.,()/-]+/).some(w => w.startsWith(n)) ? 1 : t.includes(n) ? 2 : -1;
      if (p >= 0) { const s = p * 10 + i; if (melhor < 0 || s < melhor) melhor = s; } });
    return melhor;
  }

  A.buscar = function (q) {
    q = String(q || '').trim(); if (q.length < 2 && !/^\d+$/.test(q)) return [];
    const d = dig(q), soNum = /^[\d\s./-]+$/.test(q);
    const pastaQ = (q.match(/^(?:pasta\s*)?(\d{1,6})$/i) || [])[1];
    const grupos = [];

    if (A.pode('processos', 'ver')) {
      const r = [];
      A.col('processos').forEach(p => {
        const cli = A.cliente(p.clienteId)?.nome || '';
        let s = -1, motivo = '';
        if (pastaQ && Number(p.pasta) === Number(pastaQ)) { s = 0; motivo = 'pasta'; }
        else if (pastaQ && String(p.pasta || '').startsWith(pastaQ)) { s = 5; motivo = 'pasta'; }
        if (d.length >= 4 && dig(p.numero).includes(d)) { const v = dig(p.numero).startsWith(d) ? 3 : 8; if (s < 0 || v < s) { s = v; motivo = 'número'; } }
        if (!soNum) { const t = pontuarTexto(q, cli, p.parteContraria, p.classe, p.vara); if (t >= 0 && (s < 0 || 20 + t < s)) { s = 20 + t; motivo = t % 10 === 1 ? 'parte contrária' : t % 10 === 0 ? 'cliente' : ''; } }
        if (s >= 0) r.push({s, tipo: 'processo', id: p.id, motivo,
          titulo: (p.pasta ? 'Pasta ' + p.pasta : 'Sem pasta') + ' · ' + (p.numero || 'sem nº (não ajuizado)'),
          sub: [cli, p.parteContraria && 'x ' + p.parteContraria, ST_PROC[p.status]].filter(Boolean).join(' · ')});
      });
      if (r.length) grupos.push({k: 'processos', titulo: 'Pastas e processos', itens: r.sort((a, b) => a.s - b.s || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR', {numeric: true}))});
    }

    if (A.pode('clientes', 'ver')) {
      const r = [];
      A.col('clientes').forEach(c => {
        let s = soNum ? -1 : pontuarTexto(q, c.nome, c.representanteNome, c.email);
        if (d.length >= 3 && (dig(c.documento).includes(d) || dig(c.telefone).includes(d))) s = s < 0 ? 4 : Math.min(s, 4);
        if (s < 0) return;
        const procs = A.col('processos').filter(p => p.clienteId === c.id).length;
        r.push({s, tipo: 'cliente', id: c.id, titulo: c.nome,
          sub: [c.documento, c.telefone, ST_CLI[c.status || 'novo'], procs ? procs + (procs > 1 ? ' pastas' : ' pasta') : ''].filter(Boolean).join(' · ')});
      });
      if (r.length) grupos.push({k: 'clientes', titulo: 'Clientes', itens: r.sort((a, b) => a.s - b.s || a.titulo.localeCompare(b.titulo, 'pt-BR'))});
    }

    if (A.pode('equipe', 'ver') && !soNum) {
      const r = [];
      A.col('equipe').forEach(m => { const s = pontuarTexto(q, m.nome, m.oab, m.cargo, m.email); if (s < 0) return;
        r.push({s, tipo: 'equipe', id: m.id, titulo: m.nome, sub: [m.cargo, m.oab && 'OAB ' + m.oab].filter(Boolean).join(' · '), membro: m}); });
      if (r.length) grupos.push({k: 'equipe', titulo: 'Equipe', itens: r.sort((a, b) => a.s - b.s)});
    } else if (A.pode('equipe', 'ver') && d.length >= 3) {
      const r = A.col('equipe').filter(m => dig(m.oab).includes(d)).map(m => ({s: 0, tipo: 'equipe', id: m.id, titulo: m.nome, sub: [m.cargo, 'OAB ' + m.oab].join(' · '), membro: m}));
      if (r.length) grupos.push({k: 'equipe', titulo: 'Equipe', itens: r});
    }
    return grupos;
  };

  /* ---------- resultados ---------- */
  let visiveis = []; // itens na ordem em que aparecem, para navegar com as setas
  A.renderBusca = function () {
    const box = document.getElementById('buscaRes'), inp = document.getElementById('buscaQ'); if (!box || !inp) return;
    const u = ui(), q = u.q.trim();
    inp.setAttribute('aria-expanded', String(u.aberto && !!q));
    if (!u.aberto || !q) { box.hidden = true; box.innerHTML = ''; visiveis = []; return; }
    const grupos = A.buscar(q); visiveis = [];
    if (u.sel >= grupos.reduce((n, g) => n + Math.min(g.itens.length, MAX), 0)) u.sel = 0;
    const html = grupos.map(g => {
      const itens = g.itens.slice(0, MAX).map(it => { const i = visiveis.push(it) - 1;
        const ic = it.tipo === 'equipe' ? A.avatar(it.membro) : `<span class="bico ${it.tipo}" aria-hidden="true">${it.tipo === 'processo' ? '▤' : '●'}</span>`;
        return `<button type="button" class="bitem" role="option" id="bopt${i}" aria-selected="${i === u.sel}" data-action="busca-abrir" data-tipo="${it.tipo}" data-id="${esc(it.id)}">
          ${ic}<span class="btxt"><b>${esc(it.titulo)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.motivo ? `<span class="bmot">${esc(it.motivo)}</span>` : ''}</button>`; }).join('');
      const mais = g.itens.length > MAX && g.k !== 'equipe' ? `<button type="button" class="bmais" data-action="busca-todos" data-mod="${g.k}">Ver os ${g.itens.length} resultados em ${g.k === 'processos' ? 'Processos' : 'Clientes'} →</button>` : '';
      return `<div class="bgrp" role="group" aria-label="${esc(g.titulo)}"><div class="bgtit">${esc(g.titulo)} <span class="num">${g.itens.length}</span></div>${itens}${mais}</div>`;
    }).join('');
    box.innerHTML = html || `<div class="bvazio"><b>Nada encontrado para “${esc(q)}”</b><span>Procure pelo nº da pasta, nº do processo (com ou sem pontos), nome do cliente, parte contrária, CPF/CNPJ, telefone ou pessoa da equipe.</span></div>`;
    box.hidden = false;
    inp.setAttribute('aria-activedescendant', visiveis.length ? 'bopt' + u.sel : '');
    const at = document.getElementById('bopt' + u.sel); if (at && at.scrollIntoView) at.scrollIntoView({block: 'nearest'});
  };

  function abrir(tipo, id) {
    const u = ui(); u.aberto = false; u.q = ''; u.sel = 0;
    const inp = document.getElementById('buscaQ'); if (inp) { inp.value = ''; inp.blur(); }
    A.renderBusca();
    if (tipo === 'processo') { A.go('processos'); A.abrirProcesso && A.abrirProcesso(id); }
    else if (tipo === 'cliente') { A.go('clientes'); A.actions['abrir-cliente'] && A.actions['abrir-cliente']({dataset: {id}}); }
    else if (tipo === 'equipe') { A.go('equipe'); if (A.pode('equipe', 'editar') && A.actions['eq-editar']) A.actions['eq-editar']({dataset: {id}}); }
  }

  /* ---------- ações ---------- */
  A.on('busca-digitar', el => { const u = ui(); u.q = el.value; u.aberto = true; u.sel = 0; A.renderBusca(); });
  A.on('busca-foco', el => { const u = ui(); if (el.value.trim()) { u.aberto = true; A.renderBusca(); } });
  A.on('busca-fechar', () => { const u = ui(); if (u.aberto) { u.aberto = false; A.renderBusca(); } });
  A.on('busca-abrir', el => abrir(el.dataset.tipo, el.dataset.id));
  A.on('busca-todos', el => { const q = ui().q.trim(), mod = el.dataset.mod;
    if (mod === 'processos') Object.assign(A.ui('processos'), {busca: q, status: ''});
    if (mod === 'clientes') { const c = A.ui('clientes'); c.busca = q; }
    abrir(null); A.go(mod); });
  A.on('busca-tecla', (el, e) => { const u = ui();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!visiveis.length) return;
      u.aberto = true; u.sel = (u.sel + (e.key === 'ArrowDown' ? 1 : -1) + visiveis.length) % visiveis.length; A.renderBusca(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = visiveis[u.sel]; if (it) abrir(it.tipo, it.id); }
    else if (e.key === 'Escape') { e.preventDefault(); if (u.q) { u.q = ''; el.value = ''; } else el.blur(); u.aberto = false; A.renderBusca(); } });
})(window.App);
