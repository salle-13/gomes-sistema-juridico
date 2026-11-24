/* Núcleo do sistema: utilitários, estado, camada de dados, permissões e interface comum.
   Organização single-tenant: todas as coleções ficam na raiz do banco. Para migrar para
   multiempresa no futuro, basta trocar o prefixo de caminho em Store.path() e incluir o
   identificador da organização nos documentos (ver js/schema.js). */
window.App = window.App || {};
(function (A) {
  const P = A.P = (typeof Prazo !== 'undefined' ? Prazo : window.Prazo);

  /* ---------- utilitários ---------- */
  A.MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  A.MESES_C = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  A.DOWL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  A.CORES = ['#273884','#8A3B6B','#2C7A4D','#B5651D','#5B4FA8','#0F7C8C','#9A3A2F','#6B7A1F'];
  A.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  A.hoje = () => P.ymd(new Date());
  A.fmt = s => { if (!s) return '—'; const [y,m,d] = String(s).slice(0,10).split('-'); return d + '/' + m + '/' + y; };
  A.fmtCurto = s => { const d = P.parse(s); return A.DOWL[d.getDay()] + ', ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); };
  A.quando = iso => { if (!iso) return ''; const d = new Date(iso); return A.fmt(P.ymd(d)) + ' ' + String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0'); };
  A.haDias = iso => { const n = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias'; };
  A.uid = () => ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,10)).replace(/[^a-zA-Z0-9-]/g,'');
  A.lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
  A.lsSet = (k,v) => { if (S && S.visualizarComo) return; try { localStorage.setItem(k,v); } catch(e) {} };
  A.ssGet = k => { try { return sessionStorage.getItem(k); } catch(e) { return null; } };
  A.ssSet = (k,v) => { try { sessionStorage.setItem(k,v); } catch(e) {} };
  A.tamanho = b => b > 1048576 ? (b/1048576).toFixed(1).replace('.',',') + ' MB' : Math.max(1, Math.round((b||0)/1024)) + ' KB';
  A.iniciais = n => String(n||'?').replace(/^(Dra?\.)\s*/,'').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
  A.norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  A.match = (q, ...campos) => { q = A.norm(q).trim(); return !q || A.norm(campos.join(' ')).includes(q); };

  /* Dinheiro sempre em centavos (inteiro), como no banco. */
  A.cents = str => { if (typeof str === 'number') return Math.round(str); const s = String(str||'').replace(/[^\d,.-]/g,''); if (!s) return 0;
    const n = s.includes(',') ? Number(s.replace(/\./g,'').replace(',','.')) : Number(s); return Math.round((isNaN(n) ? 0 : n) * 100); };
  A.num = c => (Number(c||0)/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  A.brl = c => 'R$ ' + A.num(c);
  A.ym = s => String(s||'').slice(0,7);
  A.ymLabel = ym => { const [y,m] = ym.split('-'); return A.MESES_C[Number(m)-1] + '/' + y.slice(2); };
  A.addMonths = (s, n) => { const d = P.parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n); const dim = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); d.setDate(Math.min(day, dim)); return P.ymd(d); };
  A.CNJ_RE = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

  /* ---------- estado ---------- */
  const COLS = A.COLS = ['equipe','usuarios','clientes','processos','publicacoes','prazos','compromissos','documentos','fin_lancamentos','centros_custo','modelos','notif_estado'];
  const S = A.S = {
    data: Object.fromEntries(COLS.map(c => [c, []])),
    config: {antecedencia: 5, feriadosLocais: [], contas: ['Caixa', 'Conta corrente'], saldosIniciais: {}, escritorioNome: 'Gomes Assessoria Jurídica', escritorioCidade: 'Araguari/MG'},
    permissoes: null,
    mode: 'loading', canWrite: true, isOwner: false, contaId: null, meId: '', loaded: {},
    db: null, assets: null, downloads: null, user: null,
    ui: {}, visualizarComo: '',
  };
  A.col = c => S.data[c] || [];
  A.byId = (c, id) => id ? A.col(c).find(x => x.id === id) : undefined;
  A.membro = id => A.byId('equipe', id);
  A.nomeDe = id => A.membro(id)?.nome || 'Alguém da equipe';
  A.cliente = id => A.byId('clientes', id);
  A.processo = id => A.byId('processos', id);
  A.ui = (mod, defaults) => { const o = S.ui[mod] = S.ui[mod] || {}; if (defaults) for (const k in defaults) if (!(k in o)) o[k] = defaults[k]; return o; };
  A.me = () => A.membro(S.meId);

  /* ---------- camada de dados ---------- */
  const Store = A.Store = {
    path: col => col, // single-tenant; no futuro: 'orgs/' + orgId + '/' + col
    local: () => S.mode !== 'db' && S.mode !== 'slow',
    persistLocal() { A.lsSet('gomes-sistema-v2', JSON.stringify({data: S.data, config: S.config, permissoes: S.permissoes})); },
  };
  A.simulacaoAtiva = () => !!S.visualizarComo;
  A.bloqueiaGravacaoSimulada = () => {
    if (!A.simulacaoAtiva()) return false;
    A.toast('Modo de visualização: operações reais estão bloqueadas.');
    return true;
  };
  A.protegerAssets = assets => assets && new Proxy(assets, {get(target, prop) {
    const valor = Reflect.get(target, prop, target);
    if (['upload', 'delete'].includes(prop) && typeof valor === 'function') return (...args) => {
      if (A.simulacaoAtiva()) return Promise.reject(Object.assign(new Error('Operação bloqueada durante a simulação.'), {code: 'simulation'}));
      return valor.apply(target, args);
    };
    return typeof valor === 'function' ? valor.bind(target) : valor;
  }});
  A.save = async function (col, obj, opts) {
    if (A.bloqueiaGravacaoSimulada()) return null;
    obj = Object.assign({}, obj);
    const agora = new Date().toISOString();
    if (!obj.id) obj.id = A.uid();
    const atual = A.byId(col, obj.id);
    if (!atual) { obj.criadoEm = obj.criadoEm || agora; obj.criadoPor = obj.criadoPor || S.meId || null; }
    obj.atualizadoEm = agora; obj.atualizadoPor = S.meId || null;
    if (Store.local()) {
      const arr = S.data[col]; const i = arr.findIndex(x => x.id === obj.id);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      Store.persistLocal(); A.render(); A.aoAtualizar && A.aoAtualizar(col); return obj;
    }
    try { const {id, ...data} = obj; await S.db.collection(Store.path(col)).doc(id).set(data); return obj; }
    catch (e) { A.falha(e); return null; }
  };
  /* Gravação em lote (importações). No modo local grava tudo e salva uma vez só; se o navegador
     não tiver espaço, desfaz e avisa. No modo compartilhado grava em paralelo, poucos por vez. */
  A.saveLote = async function (col, objs, progresso) {
    if (A.bloqueiaGravacaoSimulada()) return false;
    const agora = new Date().toISOString(), prontos = objs.map(o => Object.assign({}, o, {id: o.id || A.uid(), criadoEm: o.criadoEm || agora, criadoPor: o.criadoPor || S.meId || null, atualizadoEm: agora, atualizadoPor: S.meId || null}));
    if (Store.local()) {
      const antes = S.data[col].slice(), ids = new Set(prontos.map(o => o.id));
      S.data[col] = S.data[col].filter(x => !ids.has(x.id)).concat(prontos);
      try { localStorage.setItem('gomes-sistema-v2', JSON.stringify({data: S.data, config: S.config, permissoes: S.permissoes})); }
      catch (e) { S.data[col] = antes; A.toast('O navegador não tem espaço para guardar tudo. Nada foi gravado.'); return false; }
      progresso && progresso(prontos.length, prontos.length); A.render(); A.aoAtualizar && A.aoAtualizar(col); return true;
    }
    let feitos = 0, erro = null; const fila = prontos.slice();
    const trabalhador = async () => { while (fila.length && !erro) { const {id, ...data} = fila.shift();
      try { await S.db.collection(Store.path(col)).doc(id).set(data); feitos++; progresso && progresso(feitos, prontos.length); } catch (e) { erro = e; } } };
    await Promise.all([1, 2, 3, 4].map(trabalhador));
    if (erro) { A.falha(erro); A.toast(`Gravados ${feitos} de ${prontos.length}. Tente importar de novo: os já gravados aparecem como duplicados e não entram outra vez.`); return false; }
    return true;
  };
  A.removeLote = async function (col, ids, progresso) {
    if (A.bloqueiaGravacaoSimulada()) return false;
    if (Store.local()) { const set = new Set(ids); S.data[col] = S.data[col].filter(x => !set.has(x.id)); Store.persistLocal(); A.render(); return true; }
    /* O banco compartilhado limita escritas seguidas: apaga com pausa curta e tenta de novo, esperando mais a cada recusa. */
    const pausa = ms => new Promise(r => setTimeout(r, ms)); let feitos = 0, erro = null;
    for (const id of ids) { let ok = false;
      for (let t = 0; t < 6 && !ok; t++) { try { await S.db.collection(Store.path(col)).doc(id).delete(); ok = true; } catch (e) { erro = e; await pausa(1500 * (t + 1)); } }
      if (!ok) break; feitos++; if (progresso) progresso(feitos, ids.length); await pausa(120); }
    if (feitos < ids.length) { A.falha(erro); A.toast(`Apagadas ${feitos} de ${ids.length}. Toque de novo para continuar.`); return false; }
    return true;
  };
  A.remove = async function (col, id) {
    if (A.bloqueiaGravacaoSimulada()) return false;
    if (Store.local()) { S.data[col] = S.data[col].filter(x => x.id !== id); Store.persistLocal(); A.render(); return true; }
    try { await S.db.collection(Store.path(col)).doc(id).delete(); return true; } catch (e) { A.falha(e); return false; }
  };
  A.saveDoc = async function (path, obj) { // config/geral, config/permissoes
    if (A.bloqueiaGravacaoSimulada()) return false;
    if (path === 'config/geral') { S.config = obj; P.setLocais(obj.feriadosLocais || []); }
    if (path === 'config/permissoes') S.permissoes = obj;
    if (Store.local()) { Store.persistLocal(); A.render(); return true; }
    try { await S.db.doc(path).set(obj); A.render(); return true; } catch (e) { A.falha(e); return false; }
  };
  A.falha = function (e) {
    const c = e && e.code;
    if (c === 'invalid_argument') { S.canWrite = false; A.toast('Sem permissão para salvar. Peça ao administrador acesso de Colaborador ou Editor.'); A.render(); }
    else if (c === 'quota_exceeded') A.toast('O limite de armazenamento foi atingido. Exclua registros antigos e tente de novo.');
    else A.toast('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
  };

  /* ---------- permissões por papel ---------- */
  A.PAPEIS = [['admin','Administrador(a)'],['advogado','Advogado(a)'],['assistente','Assistente administrativo(a)'],['estagiario','Estagiário(a)'],['gerente','Gerente']];
  A.PAPEL_LABEL = Object.fromEntries(A.PAPEIS);
  A.MODULOS = [['prazos','Agenda e prazos'],['processos','Processos'],['publicacoes','Publicações'],['clientes','Clientes e captação'],['documentos','Documentos'],['modelos','Modelos de documentos'],['financeiro','Financeiro'],['relatorios','Relatórios'],['equipe','Equipe, permissões e configurações']];
  const E = 'editar', V = 'ver', N = 'nenhum';
  A.PERM_PADRAO = {
    admin:      {prazos:E, processos:E, publicacoes:E, clientes:E, documentos:E, modelos:E, financeiro:E, relatorios:E, equipe:E},
    advogado:   {prazos:E, processos:E, publicacoes:E, clientes:E, documentos:E, modelos:E, financeiro:V, relatorios:V, equipe:V},
    assistente: {prazos:V, processos:V, publicacoes:E, clientes:E, documentos:E, modelos:V, financeiro:N, relatorios:N, equipe:V},
    estagiario: {prazos:E, processos:V, publicacoes:V, clientes:V, documentos:E, modelos:V, financeiro:N, relatorios:N, equipe:V},
    gerente:    {prazos:E, processos:E, publicacoes:E, clientes:E, documentos:E, modelos:E, financeiro:E, relatorios:E, equipe:V},
  };
  A.papelReal = () => { if (S.isOwner && !A.me()) return 'admin'; const m = A.me(); return m ? (A.PAPEL_LABEL[m.papel] ? m.papel : m.papel === 'financeiro' ? 'gerente' : 'advogado') : (S.mode === 'local' ? 'admin' : 'estagiario'); };
  A.podeAdministrarReal = () => S.isOwner || A.papelReal() === 'admin';
  A.papel = () => S.visualizarComo || A.papelReal();
  A.PAPEL_LABEL.consulta = 'Consulta';
  A.PERM_CONSULTA = {prazos:V, processos:V, publicacoes:V, clientes:V, documentos:V, modelos:V, financeiro:V, relatorios:V, equipe:V};
  A.nivel = mod => {
    if (S.isOwner && (!S.visualizarComo || S.visualizarComo === 'admin')) return E;
    const papel = A.papel(), tab = (S.permissoes && S.permissoes.papeis) || A.PERM_PADRAO;
    if (papel === 'consulta') return A.PERM_CONSULTA[mod] || N;
    return (tab[papel] && tab[papel][mod]) || (A.PERM_PADRAO[papel] || {})[mod] || N;
  };
  A.pode = (mod, acao) => { const n = A.nivel(mod); if (acao === 'editar') return n === E && S.canWrite; return n === E || n === V; };

  /* ---------- interface comum ---------- */
  A.avatar = (m, lg) => m ? `<span class="av${lg?' lg':''}" style="background:${A.esc(m.cor||'#273884')}" title="${A.esc(m.nome)}">${A.esc(A.iniciais(m.nome))}</span>` : `<span class="av${lg?' lg':''}" style="background:#8893A3" title="Sem responsável">?</span>`;
  A.opts = (lista, val, vazio) => (vazio !== undefined ? `<option value="">${A.esc(vazio)}</option>` : '') + lista.map(o => { const [v,l] = Array.isArray(o) ? o : [o,o]; return `<option value="${A.esc(v)}"${String(v)===String(val??'')?' selected':''}>${A.esc(l)}</option>`; }).join('');
  A.optsEquipe = (val, vazio) => A.opts(A.col('equipe').map(m => [m.id, m.nome]), val, vazio ?? 'Sem responsável');
  A.optsClientes = (val, vazio) => A.opts(A.col('clientes').filter(c => !['novo','encaminhado','analise','recusado'].includes(c.status)).map(c => [c.id, c.nome]), val, vazio ?? 'Nenhum');
  /* Pasta: número interno do caso (1 pasta = 1 processo). O nº CNJ pode ficar vazio até o ajuizamento. */
  A.rotuloPasta = p => p && p.pasta ? 'Pasta ' + p.pasta : '';
  A.rotuloProcesso = (p, numero) => { if (!p) return numero || ''; return [A.rotuloPasta(p), p.numero || (p.pasta ? 'sem nº de processo' : '')].filter(Boolean).join(' · '); };
  A.rotuloProcId = (id, numero) => A.rotuloProcesso(A.processo(id), numero);
  A.proxPasta = () => A.col('processos').reduce((m, p) => Math.max(m, Number(p.pasta) || 0), 0) + 1;
  A.optsProcessos = (val, vazio) => A.opts(A.col('processos').slice().sort((a, b) => (Number(b.pasta) || 0) - (Number(a.pasta) || 0)).map(p => [p.id, A.rotuloProcesso(p) + ' · ' + (A.cliente(p.clienteId)?.nome || '')]), val, vazio ?? 'Nenhum');
  A.field = (id, label, inner, cls) => `<div class="field${cls?' '+cls:''}"><label for="${id}">${A.esc(label)}</label>${inner}</div>`;
  A.inp = (id, label, val, extra, cls) => A.field(id, label, `<input id="${id}" value="${A.esc(val??'')}" ${extra||''}>`, cls);
  A.sel = (id, label, options, cls, extra) => A.field(id, label, `<select id="${id}" ${extra||''}>${options}</select>`, cls);
  A.area = (id, label, val, rows, extra, cls) => A.field(id, label, `<textarea id="${id}" rows="${rows||3}" ${extra||''}>${A.esc(val??'')}</textarea>`, cls || 'full');
  A.v = id => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };

  let toastT;
  A.toast = msg => { const t = document.getElementById('toast'); t.innerHTML = `<div class="toast" role="status">${A.esc(msg)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => t.innerHTML = '', 4500); };
  A.modal = (html, opts) => { document.getElementById('modal').innerHTML = `<div class="backdrop" data-action="modal-fundo"><div class="modal${opts && opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    const f = document.querySelector('.modal input:not([disabled]), .modal select, .modal textarea'); if (f && !(opts && opts.nofocus)) f.focus(); return document.querySelector('.modal'); };
  A.closeModal = () => { document.getElementById('modal').innerHTML = ''; A.S.ui._modalCtx = null; };
  A.modalHead = (titulo, extra) => `<header><h3>${A.esc(titulo)}</h3>${extra||''}<button class="iconbtn" data-action="modal-fechar" aria-label="Fechar">×</button></header>`;
  A.confirm = (titulo, texto, rotulo, fn) => {
    A.modal(`${A.modalHead(titulo)}<div style="padding:14px 18px">${A.esc(texto)}</div><footer><button class="btn" data-action="modal-fechar">Cancelar</button><button class="btn danger" id="okConf">${A.esc(rotulo)}</button></footer>`);
    document.getElementById('okConf').addEventListener('click', async () => { await fn(); A.closeModal(); });
  };

  /* ---------- rotas e ações (registradas pelos módulos) ---------- */
  A.routes = {}; A.actions = {};
  A.route = (id, def) => { A.routes[id] = def; };
  A.on = (nome, fn) => { A.actions[nome] = fn; };
  let rq = false;
  A.render = () => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; A.renderNow && A.renderNow(); }); };
  A.go = hash => { if (location.hash === '#' + hash) A.render(); else location.hash = hash; };
})(window.App);
