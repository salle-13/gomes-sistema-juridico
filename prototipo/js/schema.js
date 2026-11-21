/* Esquema de dados do sistema (referência para o backend definitivo e para migrações).
   Convenções:
   - Cada coleção guarda documentos JSON identificados por "id" (texto).
   - Todo documento recebe criadoEm/criadoPor/atualizadoEm/atualizadoPor (ISO 8601 / id da equipe).
   - Datas de calendário em 'AAAA-MM-DD'; instantes em ISO 8601.
   - Valores em dinheiro SEMPRE em centavos (inteiro), nunca em ponto flutuante.
   - Relações por id: clienteId, processoId, responsavelId, centroCustoId, publicacaoId, prazoId.
   - Single-tenant: as coleções ficam na raiz. Para multiempresa, acrescenta-se orgId em cada
     documento (ou um prefixo de caminho) sem alterar os campos abaixo. */
window.App = window.App || {};
window.App.SCHEMA = {
  equipe: {nome:'texto', cargo:'texto', papel:'admin|advogado|assistente|estagiario|financeiro', oab:'texto', email:'texto', genero:'M|F|vazio (Dr/Dra, advogado/advogada nos modelos)', cor:'#hex', ativo:'bool', contaId:'id da conta de acesso vinculada'},
  clientes: {nome:'texto', tipoPessoa:'PF|PJ', documento:'CPF/CNPJ', telefone:'texto', email:'texto', endereco:'texto', origem:'texto', area:'texto',
    nacionalidade:'texto (PF)', estadoCivil:'texto (PF)', profissao:'texto (PF)', rg:'texto (PF)', representanteNome:'texto (PJ)', representanteCpf:'texto (PJ)', representanteCargo:'texto (PJ)',
    historia:'texto', urgencia:'normal|alta', status:'novo|encaminhado|analise|ativo|encerrado|recusado', encaminhadoPara:'[id equipe]', responsavelId:'id equipe',
    cadastradoPor:'id equipe', aceitoEm:'ISO', historico:'[{em, por, texto, tipo?: documento}]'},
  processos: {numero:'CNJ', clienteId:'id', parteContraria:'texto', polo:'ativo|passivo', tribunal:'texto', comarca:'texto', vara:'texto', classe:'texto', area:'texto',
    valorCausa:'centavos', responsavelId:'id equipe', status:'ativo|suspenso|arquivado|encerrado', distribuidoEm:'data', obs:'texto', andamentos:'[{data, texto, por}]'},
  publicacoes: {disponibilizacao:'data', publicacao:'data', tribunal:'texto', orgao:'texto', numeroProcesso:'CNJ', processoId:'id', tipo:'texto', texto:'texto',
    oab:'texto', origem:'manual|importacao', status:'nova|lida|tratada|descartada', responsavelId:'id equipe', prazoId:'id', tratadaEm:'ISO', tratadaPor:'id equipe'},
  prazos: {processo:'CNJ (texto)', processoId:'id', clienteId:'id', cliente:'texto', publicacaoId:'id', tipo:'texto', descricao:'texto', publicacao:'data', dias:'número',
    contagem:'uteis|corridos', vencimento:'data', responsavelId:'id equipe', prioridade:'normal|alta', status:'pendente|concluido', obs:'texto'},
  compromissos: {tipo:'Atendimento|Audiência|Reunião|Inicial|Consulta|Diligência|Ligação / retorno|Tarefa interna|Outro', titulo:'texto', data:'data', diaInteiro:'bool', horaInicio:'HH:MM', horaFim:'HH:MM',
    responsavelId:'id equipe', participantes:'[id equipe]', processoId:'id', clienteId:'id', local:'texto (endereço ou link)', status:'agendado|concluido', obs:'texto'},
  documentos: {nome:'texto', categoria:'texto', assetId:'id do arquivo', contentType:'texto', sizeBytes:'número', clienteId:'id', processoId:'id', enviadoPor:'id equipe', enviadoEm:'ISO'},
  fin_lancamentos: {tipo:'receber|pagar', categoria:'texto', natureza:'honorarios|custas|despesa_processual|operacional|reembolso|outros', descricao:'texto',
    valor:'centavos', vencimento:'data', competencia:'AAAA-MM', status:'pendente|pago|cancelado', pagoEm:'data', valorPago:'centavos', forma:'texto livre',
    conta:'nome da conta/caixa', clienteId:'id', processoId:'id', centroCustoId:'id', reembolsavel:'bool', reembolsoDe:'id lançamento', documento:'nº NF/recibo/guia',
    parcela:'{n, total, grupo}', obs:'texto'},
  centros_custo: {codigo:'texto', nome:'texto', ativo:'bool'},
  modelos: {nome:'texto', tipo:'Procuração|Contrato|Declaração|Petição|Outro', texto:'texto com campos {{cliente.nome}} etc. (lista em App.CAMPOS_MODELO)', ativo:'bool'},
  'config/geral': {antecedencia:'dias úteis', escritorioNome:'texto', escritorioCidade:'Cidade/UF', feriadosLocais:'[{data, nome}]', contas:'[nome]', saldosIniciais:'{conta: {data, valor}}'},
  'config/permissoes': {papeis:'{papel: {modulo: nenhum|ver|editar}}'},
};
