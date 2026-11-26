// Regras operacionais (funções puras): limites padrão, validação de config/operacional e gargalos.
// Mesmo padrão do prazo-logic.js: global "Regras" no navegador e module.exports no Node (testes/*.test.js).
// Nada aqui lê ou grava dados: recebe as coleções prontas e devolve o resultado.
const Regras = (() => {
  const P = typeof Prazo !== 'undefined' ? Prazo : require('./prazo-logic.js');

  /* ---------- captação: 10 etapas (chaves fixas, nesta ordem) ---------- */
  const ETAPAS = ['novo_contato', 'primeiro_atendimento', 'reuniao_agendada', 'reuniao_realizada', 'aguardando_documentos',
    'documentacao_recebida', 'conferencia_documental', 'cadastro_pasta', 'preparacao_distribuicao', 'entrega_advogada'];
  const ETAPAS_PADRAO = {
    novo_contato:            {rotulo: 'Novo contato', limiteUteis: 1},
    primeiro_atendimento:    {rotulo: 'Primeiro atendimento', limiteUteis: 2},
    reuniao_agendada:        {rotulo: 'Reunião agendada', limiteUteis: 5},
    reuniao_realizada:       {rotulo: 'Reunião realizada', limiteUteis: 2},
    aguardando_documentos:   {rotulo: 'Aguardando documentos', limiteUteis: 10},
    documentacao_recebida:   {rotulo: 'Documentação recebida', limiteUteis: 2},
    conferencia_documental:  {rotulo: 'Conferência documental', limiteUteis: 3},
    cadastro_pasta:          {rotulo: 'Cadastro e criação da pasta', limiteUteis: 2},
    preparacao_distribuicao: {rotulo: 'Preparação para distribuição', limiteUteis: 3},
    entrega_advogada:        {rotulo: 'Entrega à advogada responsável', limiteUteis: 2},
  };
  const PROVIDENCIA_ETAPA = {
    novo_contato: 'Fazer o primeiro atendimento',
    primeiro_atendimento: 'Agendar a reunião com o cliente',
    reuniao_agendada: 'Realizar a reunião ou remarcar',
    reuniao_realizada: 'Solicitar os documentos ao cliente',
    aguardando_documentos: 'Cobrar os documentos pendentes',
    documentacao_recebida: 'Encaminhar para conferência',
    conferencia_documental: 'Concluir a conferência dos documentos',
    cadastro_pasta: 'Cadastrar o cliente e criar a pasta',
    preparacao_distribuicao: 'Preparar o caso para distribuição',
    entrega_advogada: 'Entregar o caso à advogada responsável',
  };
  // Clientes no funil: status antigos novo/encaminhado/analise. Sem "etapa" gravada, a etapa é deduzida.
  const FUNIL = ['novo', 'encaminhado', 'analise'];
  const noFunil = c => !!c && FUNIL.includes(c.status || 'novo');
  const etapaDe = c => {
    if (!noFunil(c)) return null;
    if (ETAPAS.includes(c.etapa)) return c.etapa;
    return (c.status || 'novo') === 'novo' ? 'novo_contato' : 'primeiro_atendimento';
  };

  /* ---------- tarefas ---------- */
  const CATEGORIAS_PADRAO = ['Atendimento', 'Captação', 'Documentos', 'Processual', 'Audiência', 'Financeiro', 'Administrativo', 'Outros'];
  const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
  // Pesos da prioridade calculada (Fase 2). Pontos somados; faixas: >=8 urgente, >=5 alta, >=2 normal, abaixo baixa.
  const PESOS_PADRAO = {vencida: 6, venceHoje: 5, venceEm2Uteis: 3, venceEm5Uteis: 1, clienteUrgente: 2, categoriaUrgente: 2,
    processoComPrazoProximo: 2, bloqueada: -2};
  const CATEGORIAS_URGENTES_PADRAO = ['Processual', 'Audiência'];

  /* ---------- limites padrão (config/operacional) ---------- */
  const CAMPOS = [ // campos numéricos editáveis em Configurações
    {k: 'recenteDias', rotulo: 'Novidades (andamento, documento, pagamento) viram aviso por', unidade: 'dias', min: 1, max: 30, padrao: 3},
    {k: 'processoParadoDias', rotulo: 'Processo sem andamento é sinalizado após', unidade: 'dias', min: 15, max: 720, padrao: 90},
    {k: 'atrasoGraveDias', rotulo: 'Recebimento em atraso fica urgente após', unidade: 'dias', min: 1, max: 365, padrao: 30},
    {k: 'semResponsavelUteis', rotulo: 'Cliente em captação sem responsável após', unidade: 'dias úteis', min: 0, max: 30, padrao: 1},
    {k: 'conferenciaUteis', rotulo: 'Documento recebido aguardando conferência após', unidade: 'dias úteis', min: 0, max: 30, padrao: 2},
    {k: 'reuniaoSemProvidenciaUteis', rotulo: 'Reunião realizada sem providência após', unidade: 'dias úteis', min: 0, max: 30, padrao: 2},
    {k: 'processoSemProvidenciaUteis', rotulo: 'Processo ativo sem providência futura após', unidade: 'dias úteis', min: 0, max: 60, padrao: 5},
    {k: 'atrasoRepetidoVezes', rotulo: 'Tarefa atrasada repetidamente a partir de', unidade: 'atrasos', min: 2, max: 10, padrao: 2},
    {k: 'cargaMaxima', rotulo: 'Excesso de trabalho acima de', unidade: 'itens em aberto por pessoa', min: 3, max: 300, padrao: 20},
  ];
  const PADRAO = Object.assign(Object.fromEntries(CAMPOS.map(c => [c.k, c.padrao])), {
    versao: 1, etapas: ETAPAS_PADRAO, categoriasTarefa: CATEGORIAS_PADRAO, categoriasUrgentes: CATEGORIAS_URGENTES_PADRAO, pesos: PESOS_PADRAO,
  });

  const inteiro = (v, min, max, padrao) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao; };
  const texto = (v, padrao, max) => { const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 60); return t || padrao; };
  const listaTextos = (v, padrao) => { if (!Array.isArray(v)) return padrao.slice(); const l = [...new Set(v.map(x => texto(x, '', 40)).filter(Boolean))].slice(0, 40); return l.length ? l : padrao.slice(); };

  /* Valida e completa o documento config/operacional: valores fora da faixa são ajustados ao limite,
     inválidos voltam ao padrão. Sempre devolve um objeto novo e completo. */
  function normalizar(cfg) {
    const c = cfg && typeof cfg === 'object' ? cfg : {};
    const out = {versao: 1};
    CAMPOS.forEach(f => { out[f.k] = inteiro(c[f.k], f.min, f.max, f.padrao); });
    const et = c.etapas && typeof c.etapas === 'object' ? c.etapas : {};
    out.etapas = {};
    ETAPAS.forEach(k => { const e = et[k] || {}, p = ETAPAS_PADRAO[k];
      out.etapas[k] = {rotulo: texto(e.rotulo, p.rotulo), limiteUteis: inteiro(e.limiteUteis, 1, 90, p.limiteUteis)}; });
    out.categoriasTarefa = listaTextos(c.categoriasTarefa, CATEGORIAS_PADRAO);
    out.categoriasUrgentes = Array.isArray(c.categoriasUrgentes) ? listaTextos(c.categoriasUrgentes, []).filter(x => out.categoriasTarefa.includes(x)) : CATEGORIAS_URGENTES_PADRAO.filter(x => out.categoriasTarefa.includes(x));
    const pe = c.pesos && typeof c.pesos === 'object' ? c.pesos : {};
    out.pesos = {}; Object.keys(PESOS_PADRAO).forEach(k => { out.pesos[k] = inteiro(pe[k], -10, 10, PESOS_PADRAO[k]); });
    return out;
  }

  /* ---------- datas ---------- */
  // Instante ISO -> data local AAAA-MM-DD; data AAAA-MM-DD passa direto.
  const dataDe = v => { if (!v) return ''; const s = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d) ? '' : P.ymd(d); };
  // Dias úteis do escritório em (a, b]: sem fins de semana e feriados. O recesso forense (CPC 220) suspende
  // prazos judiciais, não o expediente interno; por isso não entra aqui (diferente de Prazo.uteisEntre).
  const diaUtilEscritorio = s => !P.fimDeSemana(s) && !P.feriado(s);
  function uteisEscritorio(a, b) {
    if (!a || !b || b <= a) return 0;
    let d = a, n = 0, guarda = 0;
    while (d < b && guarda++ < 4000) { d = P.addDays(d, 1); if (diaUtilEscritorio(d)) n++; }
    return n;
  }
  const corridos = (a, b) => (!a || !b) ? 0 : Math.round((P.parse(b) - P.parse(a)) / 86400000);

  /* ---------- auxiliares ---------- */
  const tarefaAberta = t => !!t && !['concluida', 'cancelada'].includes(t.status);
  const prazoAberto = p => !!p && p.status !== 'concluido' && p.status !== 'descartado';
  const agrupar = (arr, campo) => { const m = new Map(); (arr || []).forEach(x => { const k = x && x[campo]; if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const maxData = arr => arr.filter(Boolean).sort().pop() || '';
  const minData = arr => arr.filter(Boolean).sort()[0] || '';

  /* Documentação completa: há itens obrigatórios e todos estão aprovados. */
  function documentacaoCompleta(itens) {
    const obr = (itens || []).filter(i => i && i.obrigatorio);
    return obr.length > 0 && obr.every(i => i.situacao === 'aprovado');
  }

  /* Quantas vezes a tarefa ficou atrasada: remarcações feitas quando o prazo já tinha passado
     (registradas no histórico, campo "prazo") mais o atraso atual, se houver. */
  function vezesAtrasada(t, historico, hoje) {
    const remarcadas = (historico || []).filter(h => h.entidade === 'tarefas' && h.entidadeId === t.id && h.campo === 'prazo' && h.antes && dataDe(h.em) > String(h.antes)).length;
    return remarcadas + (tarefaAberta(t) && t.prazo && t.prazo < hoje ? 1 : 0);
  }

  /* ---------- gargalos ---------- */
  const TIPOS = {
    cliente_sem_atendimento: 'Cliente sem primeiro atendimento',
    cliente_parado: 'Cliente parado na etapa',
    cliente_sem_responsavel: 'Cliente sem responsável',
    documentacao_conferencia: 'Documentação aguardando conferência',
    tarefa_atrasada: 'Tarefa atrasada',
    tarefa_atraso_repetido: 'Tarefa atrasada repetidamente',
    excesso_tarefas: 'Excesso de trabalho',
    reuniao_sem_providencia: 'Reunião sem providência posterior',
    processo_sem_providencia: 'Processo sem providência futura',
  };

  /* dados: {clientes, tarefas, compromissos, processos, prazos, equipe, checklist_itens, historico}
     (tarefas no formato da coleção "tarefas": status aberta|andamento|aguardando_terceiros|concluida|cancelada, prazo AAAA-MM-DD).
     Devolve [{tipo, entidade, id, motivo, desde, dias, responsavelId, providencia, chave}], mais graves primeiro. */
  function avaliarGargalos(dados, config, hoje) {
    const d = dados || {}, cfg = normalizar(config), out = [];
    const col = k => Array.isArray(d[k]) ? d[k] : [];
    const add = g => { g.chave = ['gar', g.tipo, g.id, g.desde || ''].join(':'); out.push(g); };
    const tarefas = col('tarefas'), abertas = tarefas.filter(tarefaAberta), prazos = col('prazos'), comps = col('compromissos');
    const tarefasPorCli = agrupar(tarefas, 'clienteId'), tarefasPorProc = agrupar(abertas, 'processoId');
    const compsPorCli = agrupar(comps, 'clienteId'), compsPorProc = agrupar(comps, 'processoId');
    const prazosPorCli = agrupar(prazos, 'clienteId'), prazosPorProc = agrupar(prazos, 'processoId');
    const clientes = new Map(col('clientes').map(c => [c.id, c]));

    // 1 a 3. Clientes em captação
    col('clientes').forEach(c => {
      const et = etapaDe(c); if (!et) return;
      const resp = c.atendimentoResponsavelId || c.responsavelId || '';
      const desde = dataDe(c.etapaDesde) || dataDe(c.dataEntrada) || dataDe(c.criadoEm) || hoje;
      const dias = uteisEscritorio(desde, hoje), lim = cfg.etapas[et].limiteUteis, rot = cfg.etapas[et].rotulo;
      if (et === 'novo_contato' && dias > lim)
        add({tipo: 'cliente_sem_atendimento', entidade: 'clientes', id: c.id, motivo: `${c.nome || 'Cliente'}: ${plural(dias, 'dia útil', 'dias úteis')} sem primeiro atendimento (limite ${lim})`,
          desde, dias, responsavelId: resp || c.cadastradoPor || '', providencia: PROVIDENCIA_ETAPA.novo_contato});
      else if (et !== 'novo_contato' && dias > lim)
        add({tipo: 'cliente_parado', entidade: 'clientes', id: c.id, motivo: `${c.nome || 'Cliente'}: ${plural(dias, 'dia útil', 'dias úteis')} em "${rot}" (limite ${lim})`,
          desde, dias, responsavelId: resp || c.cadastradoPor || '', providencia: PROVIDENCIA_ETAPA[et]});
      const entrada = dataDe(c.dataEntrada) || dataDe(c.criadoEm) || hoje, diasSem = uteisEscritorio(entrada, hoje);
      if (!resp && diasSem > cfg.semResponsavelUteis)
        add({tipo: 'cliente_sem_responsavel', entidade: 'clientes', id: c.id, motivo: `${c.nome || 'Cliente'}: em captação há ${plural(diasSem, 'dia útil', 'dias úteis')} sem responsável pelo atendimento`,
          desde: entrada, dias: diasSem, responsavelId: c.cadastradoPor || '', providencia: 'Definir quem faz o atendimento'});
    });

    // 4. Documentação aguardando conferência (um aviso por cliente)
    agrupar(col('checklist_itens').filter(i => ['recebido', 'conferencia'].includes(i.situacao)), 'clienteId').forEach((itens, cliId) => {
      const desde = minData(itens.map(i => dataDe(i.recebidoEm) || dataDe(i.situacaoDesde) || dataDe(i.atualizadoEm))) || hoje;
      const dias = uteisEscritorio(desde, hoje); if (dias <= cfg.conferenciaUteis) return;
      const c = clientes.get(cliId);
      add({tipo: 'documentacao_conferencia', entidade: 'clientes', id: cliId, motivo: `${c ? c.nome + ': ' : ''}${plural(itens.length, 'documento aguardando', 'documentos aguardando')} conferência há ${plural(dias, 'dia útil', 'dias úteis')}`,
        desde, dias, responsavelId: c ? (c.atendimentoResponsavelId || c.responsavelId || '') : '', providencia: 'Conferir e aprovar ou rejeitar os documentos'});
    });

    // 5 e 6. Tarefas atrasadas e atrasadas repetidamente
    tarefas.forEach(t => {
      const atrasada = tarefaAberta(t) && t.prazo && t.prazo < hoje;
      if (atrasada) { const dias = uteisEscritorio(t.prazo, hoje);
        add({tipo: 'tarefa_atrasada', entidade: 'tarefas', id: t.id, motivo: `${t.titulo || 'Tarefa'}: prazo ${t.prazo.split('-').reverse().join('/')}${dias ? ', ' + plural(dias, 'dia útil', 'dias úteis') + ' de atraso' : ''}`,
          desde: t.prazo, dias, responsavelId: t.responsavelId || '', providencia: t.responsavelId ? 'Concluir ou remarcar a tarefa' : 'Definir responsável e concluir a tarefa'}); }
      if (!tarefaAberta(t)) return;
      const vezes = vezesAtrasada(t, d.historico, hoje);
      if (vezes >= cfg.atrasoRepetidoVezes)
        add({tipo: 'tarefa_atraso_repetido', entidade: 'tarefas', id: t.id, motivo: `${t.titulo || 'Tarefa'}: atrasou ${vezes} vezes`,
          desde: dataDe(t.criadoEm) || t.prazo || hoje, dias: corridos(dataDe(t.criadoEm) || hoje, hoje), vezes, responsavelId: t.responsavelId || '', providencia: 'Rever o prazo, dividir a tarefa ou redistribuir'});
    });

    // 7. Colaborador com excesso de trabalho (tarefas e prazos em aberto)
    col('equipe').filter(m => m.ativo !== false).forEach(m => {
      const nt = abertas.filter(t => t.responsavelId === m.id).length, np = prazos.filter(p => prazoAberto(p) && p.responsavelId === m.id).length;
      if (nt + np > cfg.cargaMaxima)
        add({tipo: 'excesso_tarefas', entidade: 'equipe', id: m.id, motivo: `${m.nome}: ${plural(nt, 'tarefa', 'tarefas')} e ${plural(np, 'prazo', 'prazos')} em aberto (limite ${cfg.cargaMaxima})`,
          desde: hoje, dias: 0, quantidade: nt + np, responsavelId: m.id, providencia: 'Redistribuir parte das tarefas'});
    });

    // 8. Reunião realizada (concluída) sem providência posterior: nenhuma tarefa, compromisso ou prazo criado
    // depois dela para o mesmo cliente, nem mudança de etapa. Considera reuniões dos últimos 90 dias.
    const limiteAntigo = P.addDays(hoje, -90);
    comps.filter(c => c.tipo === 'Reunião' && c.clienteId && c.status === 'concluido' && c.data && c.data <= hoje && c.data >= limiteAntigo).forEach(r => {
      const dias = uteisEscritorio(r.data, hoje); if (dias <= cfg.reuniaoSemProvidenciaUteis) return;
      const depois = x => (dataDe(x.criadoEm) || '') >= r.data;
      const cli = clientes.get(r.clienteId);
      const houve = (tarefasPorCli.get(r.clienteId) || []).some(depois)
        || (compsPorCli.get(r.clienteId) || []).some(x => x.id !== r.id && (x.data > r.data || depois(x)))
        || (prazosPorCli.get(r.clienteId) || []).some(depois)
        || (cli && dataDe(cli.etapaDesde) > r.data);
      if (houve) return;
      add({tipo: 'reuniao_sem_providencia', entidade: 'compromissos', id: r.id, motivo: `${r.titulo || 'Reunião'}${cli ? ' · ' + cli.nome : ''}: realizada em ${r.data.split('-').reverse().join('/')}, sem tarefa ou próximo passo`,
        desde: r.data, dias, responsavelId: r.responsavelId || '', providencia: 'Registrar a próxima providência (tarefa, documento ou etapa)'});
    });

    // 9. Processo ativo sem providência futura: nenhum prazo em aberto, tarefa em aberto ou compromisso a partir de hoje.
    col('processos').filter(p => p.status === 'ativo').forEach(p => {
      if ((prazosPorProc.get(p.id) || []).some(prazoAberto)) return;
      if ((tarefasPorProc.get(p.id) || []).length) return;
      if ((compsPorProc.get(p.id) || []).some(c => c.status !== 'concluido' && c.data >= hoje)) return;
      const desde = maxData([...(p.andamentos || []).map(a => a.data), p.distribuidoEm, dataDe(p.criadoEm),
        ...(prazosPorProc.get(p.id) || []).map(x => x.vencimento), ...(compsPorProc.get(p.id) || []).map(x => x.data)].filter(x => x && x <= hoje)) || hoje;
      const dias = uteisEscritorio(desde, hoje); if (dias <= cfg.processoSemProvidenciaUteis) return;
      add({tipo: 'processo_sem_providencia', entidade: 'processos', id: p.id, motivo: `${p.pasta ? 'Pasta ' + p.pasta : 'Processo'}${p.numero ? ' · ' + p.numero : ''}: nenhum prazo, tarefa ou compromisso futuro`,
        desde, dias, responsavelId: p.responsavelId || '', providencia: 'Agendar a próxima providência do processo'});
    });

    const ORD = Object.keys(TIPOS);
    return out.sort((a, b) => ORD.indexOf(a.tipo) - ORD.indexOf(b.tipo) || b.dias - a.dias);
  }

  /* ---------- tarefas: bloqueio, prioridade calculada e recorrência ---------- */
  // Bloqueada: depende de alguma tarefa que existe e ainda está aberta. mapa: Map(id -> tarefa).
  const bloqueada = (t, mapa) => (t && t.dependeDe || []).some(id => { const o = mapa.get(id); return o && o.id !== t.id && tarefaAberta(o); });

  /* ctx: {hoje, cliente, processoComPrazoProximo (bool), bloqueada (bool)}. Devolve {nivel, pontos, motivos}.
     Pontos somados com os pesos de config/operacional; faixas: >=8 urgente, >=5 alta, >=2 normal, abaixo baixa. */
  function prioridadeTarefa(t, ctx, config) {
    const cfg = normalizar(config), w = cfg.pesos, c = ctx || {}, hoje = c.hoje, motivos = [];
    let pts = 0; const soma = (k, txt) => { if (!w[k]) return; pts += w[k]; motivos.push(txt); };
    if (t.prazo && hoje) {
      if (t.prazo < hoje) soma('vencida', 'prazo vencido');
      else if (t.prazo === hoje) soma('venceHoje', 'vence hoje');
      else { const u = uteisEscritorio(hoje, t.prazo); if (u <= 2) soma('venceEm2Uteis', 'vence em até 2 dias úteis'); else if (u <= 5) soma('venceEm5Uteis', 'vence em até 5 dias úteis'); }
    }
    if (c.cliente && c.cliente.urgencia === 'alta') soma('clienteUrgente', 'cliente com urgência alta');
    if (t.categoria && cfg.categoriasUrgentes.includes(t.categoria)) soma('categoriaUrgente', 'categoria ' + t.categoria);
    if (c.processoComPrazoProximo) soma('processoComPrazoProximo', 'processo com prazo próximo');
    if (c.bloqueada) soma('bloqueada', 'bloqueada por dependência');
    const nivel = pts >= 8 ? 'urgente' : pts >= 5 ? 'alta' : pts >= 2 ? 'normal' : 'baixa';
    return {nivel, pontos: pts, motivos};
  }
  // Prioridade que vale: a manual, se a pessoa ajustou; senão a calculada.
  const prioridadeEfetiva = (t, calculada) => t.prioridadeManual && PRIORIDADES.includes(t.prioridade) ? t.prioridade : calculada.nivel;

  const addMeses = (s, n) => { const d = P.parse(s), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, fim)); return P.ymd(d); };
  /* Próxima data de uma recorrência {freq: diaria|semanal|mensal, intervalo}. Diária cai sempre em dia útil do escritório. */
  function proximaData(data, rec) {
    if (!data || !rec || !['diaria', 'semanal', 'mensal'].includes(rec.freq)) return '';
    const n = inteiro(rec.intervalo, 1, 365, 1);
    if (rec.freq === 'mensal') return addMeses(data, n);
    if (rec.freq === 'semanal') return P.addDays(data, 7 * n);
    let d = P.addDays(data, n), guarda = 0; while (!diaUtilEscritorio(d) && guarda++ < 30) d = P.addDays(d, 1); return d;
  }
  /* Próxima ocorrência de uma tarefa recorrente concluída. Id determinístico (série + prazo):
     duas abas que concluem a mesma tarefa gravam a mesma próxima ocorrência. */
  function proximaOcorrencia(t, hoje) {
    if (!t || !t.recorrencia) return null;
    const base = t.prazo || hoje, prazo = proximaData(base, t.recorrencia); if (!prazo) return null;
    const serie = t.serieId || t.id, delta = corridos(base, prazo);
    return {id: 'rec-' + serie + '-' + prazo, serieId: serie, titulo: t.titulo, descricao: t.descricao || '', responsavelId: t.responsavelId || '', clienteId: t.clienteId || '',
      processoId: t.processoId || '', compromissoId: '', categoria: t.categoria || '', prioridade: t.prioridadeManual ? t.prioridade : 'normal', prioridadeManual: !!t.prioridadeManual,
      inicio: t.inicio ? P.addDays(t.inicio, delta) : '', prazo, status: 'aberta', aguardandoQuem: '', dependeDe: [], recorrencia: Object.assign({}, t.recorrencia),
      origem: {tipo: 'automacao', ref: t.id, regra: 'recorrencia'}, concluidaEm: null, concluidaPor: null};
  }

  /* ---------- checklists ---------- */
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  /* Modelos ativos ordenados pela aderência ao cliente: mesma área (+2) e mesmo tipo de demanda (+3, ou +1 se um contém o outro). */
  function sugerirModelos(modelos, cliente) {
    const area = norm(cliente && cliente.area), tipo = norm(cliente && cliente.tipoDemanda);
    return (modelos || []).filter(m => m && m.ativo !== false).map(m => {
      const ma = norm(m.area), mt = norm(m.tipoDemanda); let pts = 0;
      if (area && ma === area) pts += 2;
      if (tipo && mt) pts += mt === tipo ? 3 : (mt.includes(tipo) || tipo.includes(mt)) ? 1 : 0;
      return {modelo: m, pontos: pts};
    }).sort((a, b) => b.pontos - a.pontos || String(a.modelo.nome).localeCompare(String(b.modelo.nome), 'pt-BR'));
  }
  /* Itens que um modelo gera para o cliente (ids determinísticos: aplicar de novo não duplica). */
  const itensDoModelo = (modelo, clienteId, situacaoDesde) => (modelo.itens || []).filter(i => i && String(i.nome || '').trim()).map((i, n) => ({
    id: 'chk-' + clienteId + '-' + modelo.id + '-' + n, clienteId, processoId: '', modeloId: modelo.id, ordem: n, nome: String(i.nome).trim(), obrigatorio: !!i.obrigatorio,
    situacao: 'pendente', situacaoDesde: situacaoDesde || null, documentoId: '', recebidoPor: null, recebidoEm: null, conferidoPor: null, conferidoEm: null, obs: ''}));

  /* ---------- migrações (idempotentes; devolvem só o que muda, ou null) ---------- */
  // Funil antigo -> etapas: novo vai para a etapa 1; encaminhado e analise para a etapa 2 (conferir).
  function migracaoCliente(c) {
    if (!c || ETAPAS.includes(c.etapa) || !FUNIL.includes(c.status || 'novo')) return null;
    const desde = dataDe(c.criadoEm) || null;
    const etapa = (c.status || 'novo') === 'novo' ? 'novo_contato' : 'primeiro_atendimento';
    return {etapa, etapaDesde: etapa === 'novo_contato' ? desde : (dataDe(c.atualizadoEm) || desde), dataEntrada: c.dataEntrada || desde, conferir: etapa !== 'novo_contato'};
  }
  // Compromisso "Tarefa interna" -> tarefa com id mig-<idCompromisso>. O compromisso continua na agenda.
  function tarefaDeCompromisso(c) {
    if (!c || c.tipo !== 'Tarefa interna') return null;
    const outros = (c.participantes || []).filter(id => id && id !== c.responsavelId);
    const t = {id: 'mig-' + c.id, titulo: c.titulo || 'Tarefa', descricao: [c.obs || '', outros.length ? 'Participantes na agenda: ' + outros.join(', ') : ''].filter(Boolean).join('\n'),
      responsavelId: c.responsavelId || '', clienteId: c.clienteId || '', processoId: c.processoId || '', compromissoId: c.id, categoria: 'Outros', prioridade: 'normal', prioridadeManual: false,
      inicio: '', prazo: c.data || '', status: c.status === 'concluido' ? 'concluida' : 'aberta', statusDesde: c.atualizadoEm || c.criadoEm || null, aguardandoQuem: '', dependeDe: [], recorrencia: null,
      origem: {tipo: 'migracao', ref: c.id}, concluidaEm: c.status === 'concluido' ? (c.atualizadoEm || null) : null, concluidaPor: c.status === 'concluido' ? (c.atualizadoPor || null) : null,
      criadoEm: c.criadoEm || null, criadoPor: c.criadoPor || null, _participantes: outros};
    if (c.exemplo) t.exemplo = true;
    return t;
  }

  return {ETAPAS, ETAPAS_PADRAO, PROVIDENCIA_ETAPA, FUNIL, noFunil, etapaDe, CATEGORIAS_PADRAO, PRIORIDADES, PESOS_PADRAO, CAMPOS, PADRAO, TIPOS,
    normalizar, dataDe, diaUtilEscritorio, uteisEscritorio, corridos, tarefaAberta, documentacaoCompleta, vezesAtrasada, avaliarGargalos,
    bloqueada, prioridadeTarefa, prioridadeEfetiva, proximaData, proximaOcorrencia, sugerirModelos, itensDoModelo, migracaoCliente, tarefaDeCompromisso};
})();
if (typeof module !== 'undefined') module.exports = Regras;
