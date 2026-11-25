// Testes das regras operacionais (js/regras-logic.js). Rodar na raiz do projeto: node --test testes/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../prototipo/js/regras-logic.js');
const P = require('../prototipo/js/prazo-logic.js');

const HOJE = '2026-11-25'; // quarta-feira; 20/11 (sexta) é feriado nacional (Consciência Negra)
const tipos = arr => arr.map(g => g.tipo);
const de = (arr, tipo) => arr.filter(g => g.tipo === tipo);

test('normalizar: sem config devolve os padrões completos', () => {
  const c = R.normalizar(null);
  R.CAMPOS.forEach(f => assert.equal(c[f.k], f.padrao, f.k));
  assert.deepEqual(Object.keys(c.etapas), R.ETAPAS);
  assert.equal(c.etapas.novo_contato.rotulo, 'Novo contato');
  assert.deepEqual(c.categoriasTarefa, R.CATEGORIAS_PADRAO);
  assert.deepEqual(c.pesos, R.PESOS_PADRAO);
});

test('normalizar: ajusta faixas, descarta inválidos e não altera o original', () => {
  const orig = {recenteDias: 999, processoParadoDias: 'abc', cargaMaxima: 1, conferenciaUteis: 2.6,
    etapas: {novo_contato: {rotulo: '  ', limiteUteis: 500}, reuniao_agendada: {rotulo: 'Reunião marcada', limiteUteis: 0}, inventada: {rotulo: 'x'}},
    categoriasTarefa: ['A', 'A', '', 'B'], categoriasUrgentes: ['B', 'Z'], pesos: {vencida: 50, desconhecido: 3}};
  const copia = JSON.parse(JSON.stringify(orig));
  const c = R.normalizar(orig);
  assert.equal(c.recenteDias, 30);
  assert.equal(c.processoParadoDias, 90);
  assert.equal(c.cargaMaxima, 3);
  assert.equal(c.conferenciaUteis, 3);
  assert.equal(c.etapas.novo_contato.rotulo, 'Novo contato');
  assert.equal(c.etapas.novo_contato.limiteUteis, 90);
  assert.equal(c.etapas.reuniao_agendada.rotulo, 'Reunião marcada');
  assert.equal(c.etapas.reuniao_agendada.limiteUteis, 1);
  assert.equal(c.etapas.inventada, undefined);
  assert.deepEqual(c.categoriasTarefa, ['A', 'B']);
  assert.deepEqual(c.categoriasUrgentes, ['B']);
  assert.equal(c.pesos.vencida, 10);
  assert.equal(c.pesos.desconhecido, undefined);
  assert.deepEqual(orig, copia);
});

test('dias úteis do escritório: sem fins de semana e feriados, mas com o recesso forense', () => {
  assert.equal(R.uteisEscritorio('2026-11-19', HOJE), 3); // 20 feriado, 21-22 fim de semana
  assert.equal(R.uteisEscritorio(HOJE, HOJE), 0);
  assert.equal(R.uteisEscritorio(HOJE, '2026-11-01'), 0);
  assert.equal(R.uteisEscritorio('2026-12-18', '2026-12-23'), 3); // recesso não suspende o expediente interno
  assert.equal(P.uteisEntre('2026-12-18', '2026-12-23'), 0);      // ...mas suspende prazos judiciais
});

test('etapaDe: deduz a etapa do status antigo e ignora quem não está no funil', () => {
  assert.equal(R.etapaDe({status: 'novo'}), 'novo_contato');
  assert.equal(R.etapaDe({}), 'novo_contato');
  assert.equal(R.etapaDe({status: 'encaminhado'}), 'primeiro_atendimento');
  assert.equal(R.etapaDe({status: 'analise'}), 'primeiro_atendimento');
  assert.equal(R.etapaDe({status: 'novo', etapa: 'cadastro_pasta'}), 'cadastro_pasta');
  assert.equal(R.etapaDe({status: 'novo', etapa: 'inexistente'}), 'novo_contato');
  assert.equal(R.etapaDe({status: 'ativo', etapa: 'cadastro_pasta'}), null);
  assert.equal(R.etapaDe({status: 'recusado'}), null);
});

test('documentação completa: todos os obrigatórios aprovados', () => {
  assert.equal(R.documentacaoCompleta([]), false);
  assert.equal(R.documentacaoCompleta([{obrigatorio: false, situacao: 'pendente'}]), false);
  assert.equal(R.documentacaoCompleta([{obrigatorio: true, situacao: 'aprovado'}, {obrigatorio: false, situacao: 'pendente'}]), true);
  assert.equal(R.documentacaoCompleta([{obrigatorio: true, situacao: 'aprovado'}, {obrigatorio: true, situacao: 'recebido'}]), false);
});

test('gargalo: cliente sem primeiro atendimento', () => {
  const g = R.avaliarGargalos({clientes: [
    {id: 'a', nome: 'Ana', status: 'novo', etapaDesde: '2026-11-19', atendimentoResponsavelId: 'm1'},
    {id: 'b', nome: 'Bia', status: 'novo', etapaDesde: '2026-11-24', atendimentoResponsavelId: 'm1'},
  ]}, null, HOJE);
  assert.deepEqual(tipos(g), ['cliente_sem_atendimento']);
  assert.equal(g[0].id, 'a');
  assert.equal(g[0].dias, 3);
  assert.equal(g[0].responsavelId, 'm1');
  assert.equal(g[0].entidade, 'clientes');
  assert.ok(g[0].providencia);
});

test('gargalo: cliente parado na etapa além do limite configurado', () => {
  const clientes = [
    {id: 'a', nome: 'Ana', status: 'novo', etapa: 'aguardando_documentos', etapaDesde: '2026-11-05', atendimentoResponsavelId: 'm1'},
    {id: 'b', nome: 'Bia', status: 'novo', etapa: 'aguardando_documentos', etapaDesde: '2026-11-16', atendimentoResponsavelId: 'm1'},
    {id: 'c', nome: 'Caio', status: 'ativo', etapa: 'aguardando_documentos', etapaDesde: '2026-01-01', responsavelId: 'm1'},
  ];
  const g = R.avaliarGargalos({clientes}, null, HOJE);
  assert.deepEqual(g.map(x => [x.tipo, x.id, x.dias]), [['cliente_parado', 'a', 13]]);
  assert.match(g[0].motivo, /Aguardando documentos/);
  const g2 = R.avaliarGargalos({clientes}, {etapas: {aguardando_documentos: {limiteUteis: 5}}}, HOJE);
  assert.deepEqual(g2.map(x => x.id), ['a', 'b']);
});

test('gargalo: cliente em captação sem responsável', () => {
  const g = R.avaliarGargalos({clientes: [
    {id: 'a', nome: 'Ana', status: 'novo', etapa: 'primeiro_atendimento', etapaDesde: HOJE, dataEntrada: '2026-11-23', cadastradoPor: 'm5'},
    {id: 'b', nome: 'Bia', status: 'novo', etapa: 'primeiro_atendimento', etapaDesde: HOJE, dataEntrada: '2026-11-23', atendimentoResponsavelId: 'm1'},
    {id: 'c', nome: 'Caio', status: 'novo', etapa: 'primeiro_atendimento', etapaDesde: HOJE, dataEntrada: '2026-11-24'},
  ]}, null, HOJE);
  assert.deepEqual(g.map(x => [x.tipo, x.id]), [['cliente_sem_responsavel', 'a']]);
  assert.equal(g[0].responsavelId, 'm5');
});

test('gargalo: documentação aguardando conferência (um por cliente)', () => {
  const g = R.avaliarGargalos({clientes: [{id: 'k', nome: 'Ana', status: 'ativo'}], checklist_itens: [
    {id: 'i1', clienteId: 'k', situacao: 'recebido', recebidoEm: '2026-11-20T15:00:00Z'},
    {id: 'i2', clienteId: 'k', situacao: 'conferencia', recebidoEm: '2026-11-24T15:00:00Z'},
    {id: 'i3', clienteId: 'k', situacao: 'aprovado', recebidoEm: '2026-10-01T15:00:00Z'},
    {id: 'i4', clienteId: 'z', situacao: 'recebido', recebidoEm: '2026-11-24T15:00:00Z'},
  ]}, null, HOJE);
  assert.deepEqual(g.map(x => [x.tipo, x.id]), [['documentacao_conferencia', 'k']]);
  assert.match(g[0].motivo, /2 documentos aguardando/);
});

test('gargalo: tarefa atrasada', () => {
  const g = R.avaliarGargalos({tarefas: [
    {id: 't1', titulo: 'Ligar', status: 'aberta', prazo: '2026-11-24', responsavelId: 'm2'},
    {id: 't2', titulo: 'Hoje', status: 'aberta', prazo: HOJE},
    {id: 't3', titulo: 'Feita', status: 'concluida', prazo: '2026-11-01'},
    {id: 't4', titulo: 'Cancelada', status: 'cancelada', prazo: '2026-11-01'},
    {id: 't5', titulo: 'Esperando', status: 'aguardando_terceiros', prazo: '2026-11-23'},
  ]}, null, HOJE);
  assert.deepEqual(de(g, 'tarefa_atrasada').map(x => [x.id, x.dias]), [['t5', 2], ['t1', 1]]);
});

test('gargalo: tarefa atrasada repetidamente (remarcações no histórico)', () => {
  const historico = [
    {entidade: 'tarefas', entidadeId: 't1', campo: 'prazo', antes: '2026-11-10', depois: '2026-11-14', em: '2026-11-12T10:00:00Z'},
    {entidade: 'tarefas', entidadeId: 't1', campo: 'prazo', antes: '2026-11-14', depois: '2026-11-20', em: '2026-11-13T10:00:00Z'}, // remarcada antes de vencer
    {entidade: 'tarefas', entidadeId: 't2', campo: 'prazo', antes: '2026-11-10', depois: '2026-12-10', em: '2026-11-12T10:00:00Z'},
    {entidade: 'tarefas', entidadeId: 't3', campo: 'prazo', antes: '2026-11-10', depois: '2026-12-10', em: '2026-11-12T10:00:00Z'},
    {entidade: 'tarefas', entidadeId: 't3', campo: 'prazo', antes: '2026-11-12', depois: '2026-12-10', em: '2026-11-18T10:00:00Z'},
  ];
  const tarefas = [
    {id: 't1', titulo: 'A', status: 'aberta', prazo: '2026-11-20', criadoEm: '2026-11-01T10:00:00Z'},
    {id: 't2', titulo: 'B', status: 'aberta', prazo: '2026-12-10'},
    {id: 't3', titulo: 'C', status: 'aberta', prazo: '2026-12-10'},
  ];
  assert.equal(R.vezesAtrasada(tarefas[0], historico, HOJE), 2);
  assert.equal(R.vezesAtrasada(tarefas[1], historico, HOJE), 1);
  const g = R.avaliarGargalos({tarefas, historico}, null, HOJE);
  assert.deepEqual(de(g, 'tarefa_atraso_repetido').map(x => [x.id, x.vezes]), [['t1', 2], ['t3', 2]]);
  assert.deepEqual(de(R.avaliarGargalos({tarefas, historico}, {atrasoRepetidoVezes: 3}, HOJE), 'tarefa_atraso_repetido'), []);
});

test('gargalo: colaborador com excesso de tarefas e prazos', () => {
  const g = R.avaliarGargalos({
    equipe: [{id: 'm1', nome: 'Ana'}, {id: 'm2', nome: 'Bia'}, {id: 'm3', nome: 'Caio', ativo: false}],
    tarefas: [{id: 't1', responsavelId: 'm1', status: 'aberta'}, {id: 't2', responsavelId: 'm1', status: 'andamento'}, {id: 't3', responsavelId: 'm1', status: 'concluida'},
      {id: 't4', responsavelId: 'm3', status: 'aberta'}, {id: 't5', responsavelId: 'm3', status: 'aberta'}, {id: 't6', responsavelId: 'm3', status: 'aberta'}, {id: 't7', responsavelId: 'm3', status: 'aberta'}],
    prazos: [{id: 'p1', responsavelId: 'm1', status: 'pendente'}, {id: 'p2', responsavelId: 'm1', status: 'pendente'}, {id: 'p3', responsavelId: 'm2', status: 'concluido'}],
  }, {cargaMaxima: 3}, HOJE);
  assert.deepEqual(de(g, 'excesso_tarefas').map(x => [x.id, x.quantidade]), [['m1', 4]]);
});

test('gargalo: reunião realizada sem providência posterior', () => {
  const base = {clientes: [{id: 'k', nome: 'Ana', status: 'novo', etapa: 'reuniao_realizada', etapaDesde: '2026-11-18', atendimentoResponsavelId: 'm1'}],
    compromissos: [{id: 'r1', tipo: 'Reunião', titulo: 'Reunião inicial', clienteId: 'k', status: 'concluido', data: '2026-11-18', responsavelId: 'm1', criadoEm: '2026-11-10T10:00:00Z'},
      {id: 'r2', tipo: 'Reunião', titulo: 'Antiga', clienteId: 'k', status: 'concluido', data: '2026-06-01', criadoEm: '2026-05-10T10:00:00Z'},
      {id: 'r3', tipo: 'Reunião', titulo: 'Ainda agendada', clienteId: 'k', status: 'agendado', data: '2026-11-10'}]};
  const g = de(R.avaliarGargalos(base, null, HOJE), 'reuniao_sem_providencia');
  assert.deepEqual(g.map(x => [x.id, x.dias]), [['r1', 4]]);
  const comTarefa = Object.assign({}, base, {tarefas: [{id: 't', clienteId: 'k', status: 'concluida', criadoEm: '2026-11-19T10:00:00Z'}]});
  assert.deepEqual(de(R.avaliarGargalos(comTarefa, null, HOJE), 'reuniao_sem_providencia'), []);
  const comEtapa = Object.assign({}, base, {clientes: [Object.assign({}, base.clientes[0], {etapa: 'aguardando_documentos', etapaDesde: '2026-11-19'})]});
  assert.deepEqual(de(R.avaliarGargalos(comEtapa, null, HOJE), 'reuniao_sem_providencia'), []);
});

test('gargalo: processo ativo sem providência futura', () => {
  const processos = [
    {id: 'p1', pasta: 10, status: 'ativo', distribuidoEm: '2026-10-01', responsavelId: 'm1'},
    {id: 'p2', pasta: 11, status: 'ativo', distribuidoEm: '2026-10-01'},
    {id: 'p3', pasta: 12, status: 'ativo', distribuidoEm: '2026-10-01'},
    {id: 'p4', pasta: 13, status: 'ativo', distribuidoEm: '2026-10-01'},
    {id: 'p5', pasta: 14, status: 'arquivado', distribuidoEm: '2026-10-01'},
    {id: 'p6', pasta: 15, status: 'ativo', distribuidoEm: '2026-11-24'},
  ];
  const g = R.avaliarGargalos({processos,
    prazos: [{id: 'x', processoId: 'p2', status: 'pendente', vencimento: '2026-12-01'}, {id: 'y', processoId: 'p1', status: 'concluido', vencimento: '2026-11-02'}],
    tarefas: [{id: 't', processoId: 'p3', status: 'aberta'}],
    compromissos: [{id: 'c', processoId: 'p4', status: 'agendado', data: '2026-12-02'}]}, null, HOJE);
  assert.deepEqual(de(g, 'processo_sem_providencia').map(x => [x.id, x.desde]), [['p1', '2026-11-02']]);
});

test('gargalos: saída estável (mesma chave), sem alterar a entrada', () => {
  const dados = {clientes: [{id: 'a', nome: 'Ana', status: 'novo', etapaDesde: '2026-11-19'}], tarefas: [{id: 't1', status: 'aberta', prazo: '2026-11-24'}]};
  const copia = JSON.parse(JSON.stringify(dados));
  const g1 = R.avaliarGargalos(dados, null, HOJE), g2 = R.avaliarGargalos(dados, null, HOJE);
  assert.deepEqual(g1.map(x => x.chave), g2.map(x => x.chave));
  assert.equal(new Set(g1.map(x => x.chave)).size, g1.length);
  assert.deepEqual(dados, copia);
  g1.forEach(x => ['tipo', 'entidade', 'id', 'motivo', 'desde', 'dias', 'responsavelId', 'providencia'].forEach(k => assert.ok(k in x, k)));
  assert.deepEqual(R.avaliarGargalos({}, null, HOJE), []);
  assert.deepEqual(R.avaliarGargalos(null, undefined, HOJE), []);
});
