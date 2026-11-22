/* Quadros do Início. Cada um se registra com A.widget(id, def) e é independente dos demais:
   lê as coleções (A.col), respeita as permissões (A.pode) e usa as ações já existentes nos módulos
   (editar-prazo, concluir-prazo, editar-comp, abrir-processo, abrir-cliente, notif-abrir…).
   A ordem de registro é a ordem padrão do painel. Nenhum quadro inventa dados: sem registros, mostra estado vazio. */
(function (A) {
  const S = A.S, P = A.P, esc = A.esc;
  const TAREFA = 'Tarefa interna', RETORNO = 'Ligação / retorno';
  const PARADO = 90; // dias sem andamento: mesma regra da Central de Notificações
  const aberto = x => x.status !== 'concluido';
  const corta = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const diaRel = (d, h) => d === h ? 'Hoje' : d === P.addDays(h, 1) ? 'Amanhã' : d === P.addDays(h, -1) ? 'Ontem' : A.fmtCurto(d);
  const hm = s => s ? s.replace(/^0/, '') : '';
  const horario = c => c.diaInteiro || !c.horaInicio ? 'Dia todo' : hm(c.horaInicio) + (c.horaFim ? '–' + hm(c.horaFim) : '');
  const nomeCli = x => A.cliente(x.clienteId)?.nome || x.cliente || '';
  const dataDe = iso => iso ? P.ymd(new Date(iso)) : '';
  const tarefas = () => A.col('compromissos').filter(c => c.tipo === TAREFA);
  const mais = (n, rotulo, attrs) => n > 0 ? `<button class="dw-mais" ${attrs}>${esc(rotulo.replace('{n}', n))}</button>` : '';
  const abrirAttrs = (a, id, rota) => `data-action="ini-abrir" data-a="${a}" data-id="${esc(id)}"${rota ? ` data-rota="${rota}"` : ''}`;

  /* ================= Indicadores ================= */
  A.widget('indicadores', {titulo: 'Indicadores', icone: 'equipe', tam: 'g',
    visivel: () => A.pode('processos', 'ver') || A.pode('clientes', 'ver') || A.pode('prazos', 'ver'),
    render(ctx) {
      const h = ctx.h, cards = [];
      const card = (cor, icone, valor, rotulo, desc, attrs) => cards.push(`<button class="dkpi" style="--c:${cor}" ${attrs}><span class="dkpi-ic">${A.ico(icone, 20)}</span>
        <span class="dkpi-txt"><strong class="num">${valor}</strong><span>${esc(rotulo)}</span>${desc ? `<small>${esc(desc)}</small>` : ''}</span></button>`);
      if (A.pode('processos', 'ver')) {
        const pr = A.col('processos'), ativos = pr.filter(p => p.status === 'ativo'), meus = ativos.filter(p => p.responsavelId === S.meId).length;
        card('var(--accent)', 'processo', ativos.length, 'Processos ativos', S.meId ? `${meus} sob sua responsabilidade` : `${pr.filter(p => p.status === 'suspenso').length} suspenso(s)`, 'data-action="ini-ir" data-ir="processos" data-status="ativo"');
        card('var(--done)', 'arquivo', pr.filter(p => p.status === 'arquivado').length, 'Processos arquivados', `${pr.filter(p => p.status === 'encerrado').length} encerrado(s)`, 'data-action="ini-ir" data-ir="processos" data-status="arquivado"');
      }
      if (A.pode('clientes', 'ver')) {
        const cl = A.col('clientes'), ativos = cl.filter(c => c.status === 'ativo' || c.status === 'aceito').length, capt = cl.filter(c => ['novo','encaminhado','analise'].includes(c.status)).length;
        card('var(--ok)', 'clientes', ativos, 'Clientes ativos', capt ? `${capt} caso(s) em captação` : 'Nenhum caso em captação', 'data-action="ini-ir" data-ir="clientes"');
      }
      if (A.pode('prazos', 'ver')) {
        const tf = tarefas().filter(c => aberto(c) && ctx.meu(c.responsavelId, c.participantes)), atr = tf.filter(c => c.data < h).length;
        card(atr ? 'var(--danger)' : 'var(--amber)', 'tarefa', tf.length, 'Tarefas pendentes', atr ? `${atr} atrasada(s)` : 'Nenhuma atrasada', `data-action="ini-ir" data-ir="agenda" data-mostrar="compromissos" data-busca="${TAREFA}"`);
        const pz = A.col('prazos').filter(p => aberto(p) && p.vencimento && ctx.meu(p.responsavelId)), s = pz.map(ctx.sit);
        const prox = s.filter(x => ['hoje','critico','atencao'].includes(x)).length, venc = s.filter(x => x === 'vencido').length;
        card(venc || s.includes('hoje') ? 'var(--danger)' : 'var(--warn)', 'prazo', prox, 'Prazos próximos', `${venc ? venc + ' vencido(s) · ' : ''}até ${ctx.ant} dias úteis`, 'data-action="ini-ir" data-ir="agenda" data-mostrar="prazos"');
        const au = A.col('compromissos').filter(c => c.tipo === 'Audiência' && aberto(c) && c.data >= h && ctx.meu(c.responsavelId, c.participantes)).sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')));
        card('var(--accent)', 'audiencia', au.length, 'Audiências agendadas', au[0] ? `Próxima: ${diaRel(au[0].data, h).toLowerCase()} · ${horario(au[0])}` : 'Nenhuma marcada', 'data-action="ini-ir" data-ir="agenda" data-mostrar="compromissos" data-busca="Audiência"');
      }
      return `<div class="dkpis">${cards.join('')}</div>`;
    }});

  /* ================= Atalhos ================= */
  A.widget('atalhos', {titulo: 'Atalhos', icone: 'raio', tam: 'g',
    visivel: () => A.ATALHOS.some(a => a.pode()),
    acoes: () => '<button class="btn small" data-action="ini-personalizar">Escolher atalhos</button>',
    render(ctx) {
      const ats = ctx.prefs.atalhos.map(id => A.ATALHOS.find(a => a.id === id)).filter(a => a && a.pode());
      return ats.length ? `<div class="datalhos">${ats.map(a => `<button class="datalho" data-action="ini-atalho" data-id="${esc(a.id)}">${A.ico(a.icone, 18)}<span>${esc(a.rotulo)}</span></button>`).join('')}</div>`
        : A.vazio('raio', 'Nenhum atalho escolhido.', 'Clique em "Escolher atalhos" para montar sua barra.');
    }});

  /* ================= Meu dia (prazos e tarefas) ================= */
  A.widget('meudia', {titulo: 'Meu dia', icone: 'sol',
    visivel: () => A.pode('prazos', 'ver'),
    acoes: () => A.pode('prazos', 'editar') ? '<button class="btn small" data-action="ini-atalho" data-id="nova-tarefa">+ Tarefa</button>' : '',
    render(ctx) {
      const h = ctx.h, ate = P.addDays(h, 7), ed = A.pode('prazos', 'editar');
      const itens = [
        ...A.col('prazos').filter(p => p.vencimento && ctx.meu(p.responsavelId)).map(p => ({k: 'prazo', o: p, data: p.vencimento, ok: !aberto(p)})),
        ...tarefas().filter(c => c.data && ctx.meu(c.responsavelId, c.participantes)).map(c => ({k: 'tarefa', o: c, data: c.data, ok: !aberto(c)})),
      ];
      const grupos = {
        atrasadas: itens.filter(i => !i.ok && i.data < h),
        hoje: itens.filter(i => !i.ok && i.data === h),
        proximas: itens.filter(i => !i.ok && i.data > h && i.data <= ate),
        concluidas: itens.filter(i => i.ok && dataDe(i.o.atualizadoEm) === h),
      };
      Object.values(grupos).forEach(g => g.sort((a, b) => a.data.localeCompare(b.data) || (a.o.prioridade === 'alta' ? -1 : 0) - (b.o.prioridade === 'alta' ? -1 : 0)));
      const ABAS = [['atrasadas','Atrasadas'],['hoje','Para hoje'],['proximas','Próximos 7 dias'],['concluidas','Concluídas hoje']];
      let aba = ctx.ui.dia; if (!grupos[aba]) aba = ['atrasadas','hoje','proximas'].find(k => grupos[k].length) || 'hoje';
      const linha = i => { const o = i.o, prazo = i.k === 'prazo', pr = A.processo(o.processoId), m = A.membro(o.responsavelId);
        const titulo = prazo ? o.tipo || 'Prazo' : o.titulo || 'Tarefa', desc = corta(prazo ? o.descricao : o.obs, 90);
        const proc = A.rotuloProcId(o.processoId, o.processo), cli = prazo ? nomeCli(o) : A.cliente(o.clienteId)?.nome;
        const atrasada = !i.ok && i.data < h;
        return `<li class="dtask${atrasada ? ' is-late' : ''}${i.ok ? ' is-done' : ''}">
          ${ed ? `<button class="dcheck" data-action="${prazo ? 'concluir-prazo' : 'concluir-comp'}" data-id="${esc(o.id)}" aria-label="${i.ok ? 'Reabrir' : 'Concluir'}: ${esc(titulo)}" title="${i.ok ? 'Reabrir' : 'Marcar como concluído'}">${i.ok ? A.ico('check', 14) : ''}</button>` : '<span class="dcheck" aria-hidden="true"></span>'}
          <button class="dtask-main" ${abrirAttrs(prazo ? 'editar-prazo' : 'editar-comp', o.id)}>
            <span class="dtask-t"><span class="tag">${prazo ? 'Prazo' : 'Tarefa'}</span> ${esc(titulo)}${o.prioridade === 'alta' ? ' <span class="tag alta">Prioridade alta</span>' : ''}</span>
            ${desc ? `<span class="dtask-d">${esc(desc)}</span>` : ''}
            <span class="dtask-m"><span class="num${atrasada ? ' late' : ''}">${esc(atrasada ? 'Venceu ' + A.fmt(i.data) : diaRel(i.data, h) + (i.data === h ? '' : ' · ' + A.fmt(i.data).slice(0, 5)))}</span>${proc || cli ? `<span>${esc([cli, proc].filter(Boolean).join(' · '))}</span>` : ''}<span class="who">${A.avatar(m)}${esc(m ? m.nome : 'Sem responsável')}</span></span>
          </button></li>`; };
      const lst = grupos[aba], LIM = 6;
      const vazios = {atrasadas: ['check', 'Nada atrasado.', 'Bom trabalho: nenhum prazo ou tarefa em atraso.'], hoje: ['sol', 'Nada vence hoje.', ''], proximas: ['calendario', 'Nada nos próximos 7 dias.', ''], concluidas: ['tarefa', 'Nada concluído hoje ainda.', '']};
      return `<div class="subtabs dw-tabs">${ABAS.map(([k, l]) => `<button data-action="ini-aba" data-k="dia" data-v="${k}" aria-pressed="${aba === k}"${k === 'atrasadas' && grupos[k].length ? ' class="tab-late"' : ''}>${l} <span class="num">${grupos[k].length}</span></button>`).join('')}</div>
        ${lst.length ? `<ul class="dtasks">${lst.slice(0, LIM).map(linha).join('')}</ul>` : A.vazio(...vazios[aba])}
        <div class="dw-foot">${mais(lst.length - LIM, '+ {n} item(ns)', `data-action="ini-ir" data-ir="agenda"`)}<button class="dw-link" data-action="ini-ir" data-ir="agenda">Ver tudo na agenda →</button></div>`;
    }});

  /* ================= Compromissos ================= */
  A.widget('compromissos', {titulo: 'Compromissos', icone: 'calendario',
    visivel: () => A.pode('prazos', 'ver'),
    acoes: () => A.pode('prazos', 'editar') ? '<button class="btn small" data-action="ini-atalho" data-id="novo-comp">+ Compromisso</button>' : '',
    render(ctx) {
      const h = ctx.h, ate = P.addDays(h, 7);
      const arr = A.col('compromissos').filter(c => c.tipo !== TAREFA && aberto(c) && c.data >= h && c.data <= ate && ctx.meu(c.responsavelId, c.participantes))
        .sort((a, b) => (a.data + (a.diaInteiro ? '' : a.horaInicio || '')).localeCompare(b.data + (b.diaInteiro ? '' : b.horaInicio || '')));
      if (!arr.length) return A.vazio('calendario', 'Nenhum compromisso nos próximos 7 dias.', 'Audiências, reuniões, atendimentos e diligências aparecem aqui.') +
        `<div class="dw-foot"><button class="dw-link" data-action="ini-ir" data-ir="agenda" data-visao="mes">Abrir agenda completa →</button></div>`;
      const LIM = 7; let dia = '', html = '';
      arr.slice(0, LIM).forEach(c => {
        if (c.data !== dia) { dia = c.data; html += `<li class="dday">${esc(diaRel(dia, h))}${dia === h ? '' : ' · ' + esc(A.fmt(dia).slice(0, 5))}</li>`; }
        const proc = A.processo(c.processoId), cli = A.cliente(c.clienteId)?.nome || A.cliente(proc?.clienteId)?.nome, link = /^https?:\/\//i.test(c.local || '');
        html += `<li class="dcomp${c.tipo === 'Audiência' ? ' is-aud' : ''}"><span class="dhora num">${esc(horario(c))}</span>
          <div class="dcomp-b"><button class="dcomp-t" ${abrirAttrs('editar-comp', c.id)}>${esc(c.titulo || c.tipo)}</button>
            <span class="dtask-m"><span class="tag">${esc(c.tipo)}</span>${cli || proc ? `<span>${esc([cli, proc ? A.rotuloProcesso(proc) : ''].filter(Boolean).join(' · '))}</span>` : ''}
            ${c.local ? (link ? `<a href="${esc(c.local)}" target="_blank" rel="noopener">Abrir link da reunião</a>` : `<span>${esc(corta(c.local, 50))}</span>`) : ''}</span></div></li>`;
      });
      return `<ul class="dcomps">${html}</ul><div class="dw-foot">${mais(arr.length - LIM, '+ {n} compromisso(s)', 'data-action="ini-ir" data-ir="agenda" data-mostrar="compromissos"')}<button class="dw-link" data-action="ini-ir" data-ir="agenda" data-visao="semana">Abrir agenda completa →</button></div>`;
    }});

  /* ================= Radar de prazos (7 dias) ================= */
  A.widget('radar', {titulo: 'Radar de prazos', icone: 'radar',
    visivel: () => A.pode('prazos', 'ver'),
    render(ctx) {
      const h = ctx.h, pz = A.col('prazos').filter(p => aberto(p) && p.vencimento && ctx.meu(p.responsavelId));
      const ORD = {vencido: 0, hoje: 1, critico: 2, atencao: 3, ok: 4};
      const cols = [{k: 'venc', rot: 'Vencidos', sub: 'em aberto', itens: pz.filter(p => p.vencimento < h)}];
      for (let i = 0; i < 7; i++) { const d = P.addDays(h, i), nu = !P.diaUtil(d);
        cols.push({k: d, rot: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : A.DOWL[P.parse(d).getDay()], sub: A.fmt(d).slice(0, 5), itens: pz.filter(p => p.vencimento === d), naoUtil: nu ? (P.feriado(d) || (P.recesso(d) ? 'recesso' : 'fim de semana')) : ''}); }
      const max = Math.max(1, ...cols.map(c => c.itens.length));
      const pior = c => c.itens.map(ctx.sit).sort((a, b) => ORD[a] - ORD[b])[0] || '';
      let sel = ctx.ui.radar; if (!cols.some(c => c.k === sel)) sel = (cols.find(c => c.itens.length) || cols[1]).k;
      const atual = cols.find(c => c.k === sel), lista = atual.itens.slice().sort((a, b) => ORD[ctx.sit(a)] - ORD[ctx.sit(b)] || a.vencimento.localeCompare(b.vencimento));
      const total = cols.reduce((s, c) => s + c.itens.length, 0);
      return `<div class="dradar" role="group" aria-label="Prazos por dia">${cols.map(c => { const s = pior(c);
          return `<button class="dradar-col${c.k === sel ? ' is-sel' : ''}${c.naoUtil ? ' is-off' : ''}${c.k === 'venc' ? ' is-venc' : ''}" data-action="ini-aba" data-k="radar" data-v="${esc(c.k)}" aria-pressed="${c.k === sel}" title="${esc(c.naoUtil ? 'Dia não útil: ' + c.naoUtil : '')}">
            <span class="dradar-n num">${c.itens.length}</span><span class="dradar-bar"><i class="${s ? 's-' + s : ''}" style="height:${c.itens.length ? Math.max(12, Math.round(c.itens.length / max * 100)) : 0}%"></i></span>
            <span class="dradar-d">${esc(c.rot)}</span><small>${esc(c.sub)}</small></button>`; }).join('')}</div>
        ${total ? '' : '<p class="muted dw-nota">Nenhum prazo vencido ou nos próximos 7 dias.</p>'}
        ${total ? `<div class="dradar-lista"><h4>${esc(sel === 'venc' ? 'Prazos vencidos em aberto' : 'Prazos de ' + diaRel(sel, h).toLowerCase() + (sel === h ? '' : ' · ' + A.fmt(sel)))}${atual.naoUtil ? ` <small class="muted">(${esc(atual.naoUtil)})</small>` : ''}</h4>
          ${lista.length ? `<div class="plist">${lista.slice(0, 4).map(A.pcardPrazo).join('')}</div>${mais(lista.length - 4, 'Ver os outros {n} na agenda →', `data-action="ini-ir" data-ir="agenda" data-mostrar="prazos"`)}` : '<p class="muted dw-nota">Nenhum prazo neste dia.</p>'}</div>` : ''}
        <p class="dw-nota muted">Datas conforme cadastradas; a contagem segue as regras da agenda (dias úteis, feriados e recesso). A data oficial é a do DJEN ou do tribunal.</p>`;
    }});

  /* ================= Central de monitoramento (reaproveita a Central de Notificações) ================= */
  A.widget('monitoramento', {titulo: 'Central de monitoramento', icone: 'alerta',
    visivel: () => !!A.notificacoes,
    render(ctx) {
      const NIV = [['urgente','Crítico'],['atencao','Atenção'],['info','Informativo']];
      const todas = A.notificacoes().filter(n => !n.dispensada), por = Object.fromEntries(NIV.map(([k]) => [k, todas.filter(n => n.prio === k)]));
      let nv = ctx.ui.mon; if (!por[nv]) nv = NIV.map(x => x[0]).find(k => por[k].length) || 'urgente';
      const lst = por[nv].slice().sort((a, b) => (a.lida - b.lida) || String(a.ref || '9').localeCompare(String(b.ref || '9'))), LIM = 5;
      if (!todas.length) return A.vazio('check', 'Tudo em dia.', 'Nenhum alerta ou pendência no momento.');
      return `<div class="dmon-niveis">${NIV.map(([k, l]) => `<button class="dmon-n p-${k}" data-action="ini-aba" data-k="mon" data-v="${k}" aria-pressed="${nv === k}"><b class="num">${por[k].length}</b><span>${l}</span></button>`).join('')}</div>
        ${lst.length ? `<ul class="dmon">${lst.slice(0, LIM).map(n => `<li><button class="dmon-i p-${n.prio}${n.lida ? ' is-read' : ''}" data-action="notif-abrir" data-chave="${esc(n.chave)}"><span class="notification-dot" aria-hidden="true"></span>
          <span><b>${esc(n.titulo)}</b>${n.texto ? `<span>${esc(corta(n.texto, 110))}</span>` : ''}<small>${esc(n.refTxt || '')}</small></span></button></li>`).join('')}</ul>`
          : A.vazio('check', 'Nada neste nível.', '')}
        <div class="dw-foot">${mais(lst.length - LIM, '+ {n} alerta(s)', 'data-action="ini-ir" data-ir="notificacoes"')}<button class="dw-link" data-action="ini-ir" data-ir="notificacoes">Abrir central de notificações →</button></div>`;
    }});

  /* ================= Processos que exigem atenção ================= */
  A.widget('processos-atencao', {titulo: 'Processos que exigem atenção', icone: 'processo',
    visivel: () => A.pode('processos', 'ver'),
    render(ctx) {
      const h = ctx.h, verPz = A.pode('prazos', 'ver'), verPub = A.pode('publicacoes', 'ver');
      const RS = {crit: 0, aten: 1, info: 2}, T = {vencido: ['crit', 'Prazo vencido'], hoje: ['crit', 'Prazo vence hoje'], critico: ['crit', 'Prazo em até 2 dias úteis'], atencao: ['aten', 'Prazo se aproximando']};
      const pzPor = new Map(), tfPor = new Map(), pubPor = new Map(), add = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
      if (verPz) { A.col('prazos').filter(aberto).forEach(p => add(pzPor, p.processoId, p)); tarefas().filter(c => aberto(c) && c.data < h).forEach(c => add(tfPor, c.processoId, c)); }
      if (verPub) A.col('publicacoes').filter(p => p.status === 'nova').forEach(p => add(pubPor, p.processoId, p));
      const lista = A.col('processos').filter(pr => pr.status === 'ativo' && (ctx.escopo === 'equipe' || pr.responsavelId === S.meId)).map(pr => {
        const mot = [], pz = pzPor.get(pr.id) || [];
        const pior = pz.map(p => [ctx.sit(p), p]).filter(([s]) => T[s]).sort((a, b) => RS[T[a[0]][0]] - RS[T[b[0]][0]] || a[1].vencimento.localeCompare(b[1].vencimento))[0];
        if (pior) mot.push([T[pior[0]][0], `${T[pior[0]][1]} · ${pior[1].tipo || ''} (${A.fmt(pior[1].vencimento).slice(0, 5)})`]);
        const tf = (tfPor.get(pr.id) || []).length; if (tf) mot.push(['aten', `${tf} tarefa(s) atrasada(s)`]);
        const pb = (pubPor.get(pr.id) || []).length; if (pb) mot.push(['aten', `${pb} publicação(ões) para tratar`]);
        if (!pr.responsavelId) mot.push(['aten', 'Sem responsável']);
        const ult = (pr.andamentos || []).map(a => a.data).filter(Boolean).sort().pop() || pr.distribuidoEm;
        if (ult && !pz.length) { const d = Math.round((P.parse(h) - P.parse(ult)) / 86400000); if (d > PARADO) mot.push(['info', `Sem movimentação há ${d} dias`]); }
        if (pr.revisar) mot.push(['info', 'Importado: conferir dados']);
        return {pr, mot: mot.sort((a, b) => RS[a[0]] - RS[b[0]])};
      }).filter(x => x.mot.length).sort((a, b) => RS[a.mot[0][0]] - RS[b.mot[0][0]] || b.mot.length - a.mot.length);
      if (!lista.length) return A.vazio('check', 'Nenhum processo pede atenção agora.', ctx.escopo === 'meu' ? 'Considerando os processos sob sua responsabilidade.' : 'Considerando todos os processos ativos.');
      const LIM = 6;
      return `<ul class="dprocs">${lista.slice(0, LIM).map(({pr, mot}) => { const m = A.membro(pr.responsavelId);
          return `<li><button class="dproc nv-${mot[0][0]}" ${abrirAttrs('abrir-processo', pr.id, 'processos')}>
            <span class="dproc-t">${pr.pasta ? `<span class="evtag2">Pasta ${esc(pr.pasta)}</span> ` : ''}<span class="proc">${esc(pr.numero || 'sem nº de processo')}</span></span>
            <span class="dtask-m"><span>${esc(A.cliente(pr.clienteId)?.nome || '—')}</span><span class="who">${A.avatar(m)}${esc(m ? m.nome : 'Sem responsável')}</span></span>
            <span class="dmotivos">${mot.map(([n, t]) => `<span class="dmot nv-${n}">${esc(t)}</span>`).join('')}</span></button></li>`; }).join('')}</ul>
        <div class="dw-foot">${mais(lista.length - LIM, '+ {n} processo(s) com pendência', 'data-action="ini-ir" data-ir="processos" data-status="ativo"')}<button class="dw-link" data-action="ini-ir" data-ir="processos" data-status="ativo"${ctx.escopo === 'meu' ? ` data-resp="${esc(S.meId)}"` : ''}>Ver processos →</button></div>`;
    }});

  /* ================= Retornos pendentes ================= */
  A.widget('retornos', {titulo: 'Retornos pendentes', icone: 'telefone',
    visivel: () => A.pode('prazos', 'ver') || A.pode('clientes', 'ver'),
    render(ctx) {
      const h = ctx.h, itens = [];
      if (A.pode('prazos', 'ver')) A.col('compromissos').filter(c => c.tipo === RETORNO && aberto(c) && c.data && c.data <= P.addDays(h, 7) && ctx.meu(c.responsavelId, c.participantes)).forEach(c => {
        const cli = A.cliente(c.clienteId) || A.cliente(A.processo(c.processoId)?.clienteId);
        itens.push({ord: c.data + (c.horaInicio || ''), late: c.data < h, html: `<button class="dret${c.data < h ? ' is-late' : ''}" ${abrirAttrs('editar-comp', c.id)}>${A.ico('telefone', 16)}
          <span><b>${esc(cli?.nome || c.titulo || 'Retorno')}</b><span>${esc(c.titulo && cli ? c.titulo : 'Ligar / dar retorno')}${cli?.telefone ? ' · ' + esc(cli.telefone) : ''}</span>
          <small>${esc(c.data < h ? 'Era para ' + A.fmt(c.data) : diaRel(c.data, h) + (c.diaInteiro || !c.horaInicio ? '' : ' · ' + hm(c.horaInicio)))}</small></span></button>`});
      });
      if (A.pode('clientes', 'ver')) {
        const LAB = {novo: 'Novo cadastro: encaminhar para análise', encaminhado: 'Encaminhado: aguardando análise da advogada', analise: 'Em análise: dar retorno ao cliente'};
        A.col('clientes').filter(c => LAB[c.status] && (ctx.escopo === 'equipe' || (c.encaminhadoPara || []).includes(S.meId) || c.cadastradoPor === S.meId || c.responsavelId === S.meId)).forEach(c => {
          const desde = c.criadoEm ? dataDe(c.criadoEm) : '';
          itens.push({ord: desde || '9', late: c.urgencia === 'alta', html: `<button class="dret${c.urgencia === 'alta' ? ' is-late' : ''}" ${abrirAttrs('abrir-cliente', c.id, 'clientes')}>${A.ico('clientes', 16)}
            <span><b>${esc(c.nome)}</b><span>${esc(LAB[c.status])}${c.urgencia === 'alta' ? ' · urgente' : ''}</span><small>${esc(c.criadoEm ? 'Cadastrado ' + A.haDias(c.criadoEm) : 'Caso em captação')}</small></span></button>`});
        });
      }
      if (!itens.length) return A.vazio('telefone', 'Nenhum retorno pendente.', 'Ligações e retornos agendados e casos em captação aparecem aqui.');
      itens.sort((a, b) => (b.late - a.late) || a.ord.localeCompare(b.ord));
      const LIM = 6;
      return `<ul class="drets">${itens.slice(0, LIM).map(i => `<li>${i.html}</li>`).join('')}</ul><div class="dw-foot">${mais(itens.length - LIM, '+ {n} retorno(s)', A.pode('clientes', 'ver') ? 'data-action="ini-ir" data-ir="clientes"' : 'data-action="ini-ir" data-ir="agenda"')}</div>`;
    }});

  /* ================= Aniversariantes do mês (clientes) ================= */
  A.widget('aniversariantes', {titulo: 'Aniversariantes do mês', icone: 'bolo',
    visivel: () => A.pode('clientes', 'ver'),
    render(ctx) {
      const h = ctx.h, mes = h.slice(5, 7), hojeMD = h.slice(5), ano = Number(h.slice(0, 4));
      const arr = A.col('clientes').filter(c => c.status !== 'recusado' && c.tipoPessoa !== 'PJ' && /^\d{4}-\d{2}-\d{2}/.test(c.dataNascimento || '') && c.dataNascimento.slice(5, 7) === mes)
        .sort((a, b) => a.dataNascimento.slice(8, 10).localeCompare(b.dataNascimento.slice(8, 10)) || a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!arr.length) return A.vazio('bolo', `Nenhum aniversariante em ${A.MESES[Number(mes) - 1]}.`, 'A lista usa a data de nascimento do cadastro do cliente.');
      const escritorio = S.config.escritorioNome || 'Gomes Assessoria Jurídica';
      const linha = c => { const md = c.dataNascimento.slice(5, 10), dia = md === hojeMD, passou = md < hojeMD, idade = ano - Number(c.dataNascimento.slice(0, 4));
        const primeiro = String(c.nome).trim().split(/\s+/)[0] || c.nome, msg = `Olá, ${primeiro}! A equipe da ${escritorio} deseja um feliz aniversário, com muita saúde e alegrias. Um abraço!`;
        let fone = String(c.telefone || '').replace(/\D/g, ''); if (fone.length >= 10 && fone.length <= 11) fone = '55' + fone;
        const contato = fone.length >= 12 ? `<a class="btn small" href="https://wa.me/${fone}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" title="Abre o WhatsApp com a mensagem pronta; nada é enviado automaticamente">${A.ico('mensagem', 14)} Felicitar</a>`
          : c.email ? `<a class="btn small" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Feliz aniversário!')}&body=${encodeURIComponent(msg)}" title="Abre o e-mail com a mensagem pronta">${A.ico('email', 14)} Felicitar</a>` : '';
        return `<li class="daniv${dia ? ' is-hoje' : ''}${passou ? ' is-passou' : ''}"><span class="av" style="background:${dia ? 'var(--accent)' : '#8893A3'}" aria-hidden="true">${esc(A.iniciais(c.nome))}</span>
          <span class="daniv-b"><button class="dcomp-t" ${abrirAttrs('abrir-cliente', c.id, 'clientes')}>${esc(c.nome)}</button>
            <small><span class="num">${esc(md.slice(3) + '/' + md.slice(0, 2))}</span>${idade > 0 && idade < 120 ? ` · ${dia ? 'faz' : passou ? 'fez' : 'fará'} ${idade} anos` : ''}${dia ? ' · <b>Hoje!</b>' : ''}</small></span>${contato}</li>`; };
      return `<ul class="danivs">${arr.map(linha).join('')}</ul><p class="dw-nota muted">"Felicitar" abre o WhatsApp ou o e-mail com a mensagem pronta para revisar; nada é enviado sozinho.</p>`;
    }});

  /* ================= Últimas atividades ================= */
  // Não há log dedicado: a linha do tempo é montada com os carimbos que A.save grava em todo registro
  // (criadoEm/criadoPor e atualizadoEm/atualizadoPor). Por isso mostra o cadastro e a ÚLTIMA alteração de cada registro.
  const ATIV = [
    {col: 'processos', mod: 'processos', criou: 'Processo cadastrado', alterou: () => 'Processo atualizado', nome: p => A.rotuloProcesso(p) + (A.cliente(p.clienteId) ? ' · ' + A.cliente(p.clienteId).nome : ''), abrir: ['abrir-processo', 'processos']},
    {col: 'clientes', mod: 'clientes', criou: 'Cliente cadastrado', alterou: c => c.status === 'ativo' && c.aceitoEm && Math.abs(new Date(c.aceitoEm) - new Date(c.atualizadoEm)) < 60000 ? 'Caso aceito' : 'Cadastro de cliente atualizado', nome: c => c.nome, abrir: ['abrir-cliente', 'clientes']},
    {col: 'prazos', mod: 'prazos', criou: 'Prazo cadastrado', alterou: p => p.status === 'concluido' ? 'Prazo concluído' : 'Prazo atualizado', nome: p => [p.tipo, nomeCli(p)].filter(Boolean).join(' · '), abrir: ['editar-prazo']},
    {col: 'compromissos', mod: 'prazos', criou: c => c.tipo === TAREFA ? 'Tarefa criada' : 'Compromisso agendado', alterou: c => c.status === 'concluido' ? (c.tipo === TAREFA ? 'Tarefa concluída' : 'Compromisso concluído') : (c.tipo === TAREFA ? 'Tarefa atualizada' : 'Compromisso atualizado'), nome: c => [c.tipo === TAREFA ? '' : c.tipo, c.titulo].filter(Boolean).join(' · '), abrir: ['editar-comp']},
    {col: 'documentos', mod: 'documentos', criou: 'Documento anexado', alterou: () => 'Documento atualizado', nome: d => [d.nome, A.cliente(d.clienteId)?.nome].filter(Boolean).join(' · '), abrir: [null, 'documentos'], em: d => d.criadoEm || d.enviadoEm, por: d => d.criadoPor || d.enviadoPor},
    {col: 'publicacoes', mod: 'publicacoes', criou: p => p.origem === 'manual' ? 'Publicação registrada' : 'Publicação importada', alterou: p => ({tratada: 'Publicação tratada', descartada: 'Publicação sem providência', lida: 'Publicação lida'})[p.status] || 'Publicação atualizada', nome: p => [p.tipo, p.numeroProcesso].filter(Boolean).join(' · '), abrir: ['abrir-pub', 'publicacoes']},
    {col: 'fin_lancamentos', mod: 'financeiro', criou: f => f.tipo === 'receber' ? 'Conta a receber lançada' : 'Conta a pagar lançada', alterou: f => f.status === 'pago' ? 'Baixa de pagamento' : 'Lançamento atualizado', nome: f => [f.descricao, A.brl(f.valor)].filter(Boolean).join(' · '), abrir: ['fin-editar', f => f.tipo === 'receber' ? 'fin-receber' : 'fin-pagar']},
    {col: 'modelos', mod: 'modelos', criou: 'Modelo de documento criado', alterou: () => 'Modelo atualizado', nome: m => m.nome, abrir: [null, 'modelos']},
    {col: 'equipe', mod: 'equipe', criou: 'Membro adicionado à equipe', alterou: () => 'Cadastro da equipe atualizado', nome: m => m.nome, abrir: [null, 'equipe']},
  ];
  A.widget('atividades', {titulo: 'Últimas atividades', icone: 'atividade',
    render() {
      const ev = [], txt = (v, o) => typeof v === 'function' ? v(o) : v;
      ATIV.filter(t => A.pode(t.mod, 'ver')).forEach(t => A.col(t.col).forEach(o => {
        const em = t.em ? t.em(o) : o.criadoEm, por = t.por ? t.por(o) : o.criadoPor;
        if (em) ev.push({em, por, acao: txt(t.criou, o), t, o});
        if (o.atualizadoEm && (!em || new Date(o.atualizadoEm) - new Date(em) > 60000)) ev.push({em: o.atualizadoEm, por: o.atualizadoPor, acao: txt(t.alterou, o), t, o});
      }));
      // Agrupa ações em lote (ex.: 160 publicações importadas no mesmo minuto pela mesma pessoa)
      const grupos = new Map();
      ev.forEach(e => { const k = [e.t.col, e.acao, e.por || '', String(e.em).slice(0, 16)].join('|'); const g = grupos.get(k); if (g) g.n++; else grupos.set(k, Object.assign(e, {n: 1})); });
      const lst = [...grupos.values()].sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 12);
      if (!lst.length) return A.vazio('atividade', 'Nenhuma atividade registrada ainda.', 'Cadastros e alterações feitos no sistema aparecem aqui.');
      return `<ol class="dativ">${lst.map(e => { const [a, r0] = e.t.abrir, rota = typeof r0 === 'function' ? r0(e.o) : r0, alvo = e.n > 1 ? `${e.n} registros` : e.t.nome(e.o), m = A.membro(e.por);
          const corpo = `<span class="dativ-a"><b>${esc(e.acao)}</b>${alvo ? ` <span>${esc(corta(alvo, 80))}</span>` : ''}</span><small>${esc(m ? m.nome : e.por ? 'Alguém da equipe' : S.mode === 'local' ? 'Administrador (sem nome)' : 'Sem identificação')} · ${esc(A.quando(e.em))}</small>`;
          return `<li>${A.avatar(m)}${e.n === 1 && (a || rota) ? `<button class="dativ-i" data-action="ini-abrir"${a ? ` data-a="${a}"` : ''} data-id="${esc(e.o.id)}"${rota ? ` data-rota="${rota}"` : ''}>${corpo}</button>` : `<div class="dativ-i">${corpo}</div>`}</li>`; }).join('')}</ol>
        <p class="dw-nota muted">Mostra o cadastro e a última alteração de cada registro.</p>`;
    }});

  /* ================= Distribuição de tarefas da equipe ================= */
  A.widget('equipe', {titulo: 'Distribuição da equipe', icone: 'equipe', tam: 'g',
    visivel: () => A.pode('prazos', 'ver') && A.col('equipe').length > 1 && (!S.meId || ['admin', 'advogado'].includes(A.papel())),
    render(ctx) {
      const h = ctx.h, desde = P.addDays(h, -30);
      const itens = [...A.col('prazos').map(p => ({o: p, resp: p.responsavelId, data: p.vencimento})), ...tarefas().map(c => ({o: c, resp: c.responsavelId, data: c.data}))];
      const linhas = A.col('equipe').filter(m => m.ativo !== false).map(m => {
        const meus = itens.filter(i => i.resp === m.id), pend = meus.filter(i => aberto(i.o));
        return {m, pend: pend.length, atr: pend.filter(i => i.data && i.data < h).length, hoje: pend.filter(i => i.data === h).length, ok: meus.filter(i => !aberto(i.o) && dataDe(i.o.atualizadoEm) >= desde).length};
      });
      const sem = itens.filter(i => !i.resp && aberto(i.o)).length;
      if (!linhas.some(l => l.pend || l.ok) && !sem) return A.vazio('equipe', 'Nenhum prazo ou tarefa cadastrado.', '');
      const max = Math.max(1, ...linhas.map(l => l.pend));
      linhas.sort((a, b) => b.atr - a.atr || b.pend - a.pend);
      return `<div class="tablewrap"><table class="dequipe"><thead><tr><th>Pessoa</th><th>Carga em aberto</th><th class="num">Pendentes</th><th class="num">Atrasados</th><th class="num">Hoje</th><th class="num">Concluídos (30 dias)</th></tr></thead><tbody>
        ${linhas.map(l => `<tr class="row-click" data-action="ini-ir" data-ir="agenda" data-resp="${esc(l.m.id)}"><td><span class="who">${A.avatar(l.m)}${esc(l.m.nome)}</span></td>
          <td><span class="dcarga" title="${l.pend} pendente(s), ${l.atr} atrasado(s)"><i class="atr" style="width:${l.atr / max * 100}%"></i><i style="width:${(l.pend - l.atr) / max * 100}%"></i></span></td>
          <td class="num">${l.pend}</td><td class="num">${l.atr ? `<b class="late">${l.atr}</b>` : 0}</td><td class="num">${l.hoje}</td><td class="num">${l.ok}</td></tr>`).join('')}
        ${sem ? `<tr><td colspan="6" class="muted">${sem} prazo(s) ou tarefa(s) em aberto sem responsável.</td></tr>` : ''}</tbody></table></div>
        <p class="dw-nota muted">Conta prazos e tarefas internas. Clique numa pessoa para ver a agenda dela.</p>`;
    }});
})(window.App);
