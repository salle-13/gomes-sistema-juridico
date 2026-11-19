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
  A.lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch(e) {} };
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
  const COLS = A.COLS = ['equipe','clientes','processos','publicacoes','prazos','documentos','fin_lancamentos','centros_custo','modelos'];
  const S = A.S = {
    data: Object.fromEntries(COLS.map(c => [c, []])),
    config: {antecedencia: 5, feriadosLocais: [], contas: ['Caixa', 'Conta corrente'], saldosIniciais: {}},
    permissoes: null,
    mode: 'loading', canWrite: true, isOwner: false, contaId: null, meId: '', loaded: {},
    db: null, assets: null, downloads: null, user: null,
    ui: {},
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
  A.save = async function (col, obj, opts) {
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
  A.remove = async function (col, id) {
    if (Store.local()) { S.data[col] = S.data[col].filter(x => x.id !== id); Store.persistLocal(); A.render(); return true; }
    try { await S.db.collection(Store.path(col)).doc(id).delete(); return true; } catch (e) { A.falha(e); return false; }
  };
  A.saveDoc = async function (path, obj) { // config/geral, config/permissoes
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
  A.PAPEIS = [['admin','Administrador(a)'],['advogado','Advogado(a)'],['assistente','Assistente administrativo(a)'],['estagiario','Estagiário(a)'],['financeiro','Financeiro']];
  A.PAPEL_LABEL = Object.fromEntries(A.PAPEIS);
  A.MODULOS = [['prazos','Agenda e prazos'],['processos','Processos'],['publicacoes','Publicações'],['clientes','Clientes e captação'],['documentos','Documentos'],['modelos','Modelos de documentos'],['financeiro','Financeiro'],['relatorios','Relatórios'],['equipe','Equipe, permissões e configurações']];
  const E = 'editar', V = 'ver', N = 'nenhum';
  A.PERM_PADRAO = {
    admin:      {prazos:E, processos:E, publicacoes:E, clientes:E, documentos:E, modelos:E, financeiro:E, relatorios:E, equipe:E},
    advogado:   {prazos:E, processos:E, publicacoes:E, clientes:E, documentos:E, modelos:E, financeiro:V, relatorios:V, equipe:V},
    assistente: {prazos:V, processos:V, publicacoes:E, clientes:E, documentos:E, modelos:V, financeiro:N, relatorios:N, equipe:V},
    estagiario: {prazos:E, processos:V, publicacoes:V, clientes:V, documentos:E, modelos:V, financeiro:N, relatorios:N, equipe:V},
    financeiro: {prazos:V, processos:V, publicacoes:N, clientes:V, documentos:V, modelos:N, financeiro:E, relatorios:E, equipe:V},
  };
  A.papel = () => { if (S.isOwner && !A.me()) return 'admin'; const m = A.me(); return m ? (m.papel || 'advogado') : (S.mode === 'local' ? 'admin' : 'estagiario'); };
  A.nivel = mod => { if (S.isOwner) return E; const papel = A.papel(); const tab = (S.permissoes && S.permissoes.papeis) || A.PERM_PADRAO;
    return (tab[papel] && tab[papel][mod]) || (A.PERM_PADRAO[papel] || {})[mod] || N; };
  A.pode = (mod, acao) => { const n = A.nivel(mod); if (acao === 'editar') return n === E && S.canWrite; return n === E || n === V; };

  /* ---------- interface comum ---------- */
  A.avatar = (m, lg) => m ? `<span class="av${lg?' lg':''}" style="background:${A.esc(m.cor||'#273884')}" title="${A.esc(m.nome)}">${A.esc(A.iniciais(m.nome))}</span>` : `<span class="av${lg?' lg':''}" style="background:#8893A3" title="Sem responsável">?</span>`;
  A.opts = (lista, val, vazio) => (vazio !== undefined ? `<option value="">${A.esc(vazio)}</option>` : '') + lista.map(o => { const [v,l] = Array.isArray(o) ? o : [o,o]; return `<option value="${A.esc(v)}"${String(v)===String(val??'')?' selected':''}>${A.esc(l)}</option>`; }).join('');
  A.optsEquipe = (val, vazio) => A.opts(A.col('equipe').map(m => [m.id, m.nome]), val, vazio ?? 'Sem responsável');
  A.optsClientes = (val, vazio) => A.opts(A.col('clientes').filter(c => !['novo','encaminhado','analise','recusado'].includes(c.status)).map(c => [c.id, c.nome]), val, vazio ?? 'Nenhum');
  A.optsProcessos = (val, vazio) => A.opts(A.col('processos').map(p => [p.id, p.numero + ' · ' + (A.cliente(p.clienteId)?.nome || '')]), val, vazio ?? 'Nenhum');
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
