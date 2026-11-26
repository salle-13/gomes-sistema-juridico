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
  equipe: {nome:'texto', cargo:'texto', papel:'admin|advogado|assistente|estagiario|gerente', oab:'texto', email:'texto', genero:'M|F|vazio (Dr/Dra, advogado/advogada nos modelos)', cor:'#hex', ativo:'bool', contaId:'id da conta de acesso vinculada'},
  usuarios: {nome:'texto', email:'texto', perfil:'admin|advogado|assistente|consulta', status:'ativo|inativo|pendente', convite:{status:'nao_enviado|enviado|aceito', criadoEm:'ISO', enviadoEm:'ISO|null', aceitoEm:'ISO|null'}},
  clientes: {nome:'texto', tipoPessoa:'PF|PJ', documento:'CPF/CNPJ', telefone:'texto', email:'texto', endereco:'texto', origem:'texto', area:'texto',
    nacionalidade:'texto (PF)', estadoCivil:'texto (PF)', profissao:'texto (PF)', rg:'texto (PF)', representanteNome:'texto (PJ)', representanteCpf:'texto (PJ)', representanteCargo:'texto (PJ)',
    dataNascimento:'data (PF)', naturalidade:'texto (PF)', nomeMae:'texto (PF)', nomePai:'texto (PF)', empresa:'texto (PF, empregador)', ctps:'texto (PF)', pis:'texto (PF)', obs:'texto',
    importado:'projuris (só nos importados)', revisar:'bool (importação com campo a revisar)',
    historia:'texto', urgencia:'normal|alta',
    status:'novo|encaminhado|analise (em captação) |ativo|encerrado|recusado (= arquivado: contato não seguiu)',
    etapa:'novo_contato|primeiro_atendimento|reuniao_agendada|reuniao_realizada|aguardando_documentos|documentacao_recebida|conferencia_documental|cadastro_pasta|preparacao_distribuicao|entrega_advogada (só em captação)',
    etapaDesde:'ISO (entrada na etapa atual)', dataEntrada:'data (entrada do contato)', atendimentoResponsavelId:'id equipe (quem conduz a captação)', tipoDemanda:'texto', proximaProvidencia:'texto',
    responsavelId:'id equipe (advogado(a); obrigatório para ir à carteira)', motivoArquivamento:'texto (obrigatório ao arquivar)', arquivadoEm:'ISO', arquivadoPor:'id equipe',
    cadastradoPor:'id equipe', aceitoEm:'ISO (entrada na carteira)',
    encaminhadoPara:'[id equipe] (fluxo antigo, só leitura)', historico:'[{em, por, texto, tipo?: documento}] (fluxo antigo, só leitura; o novo vai para a coleção historico)'},
  processos: {pasta:'inteiro (nº da pasta, único; 1 pasta = 1 processo)', numero:'CNJ (opcional até o ajuizamento)', clienteId:'id', parteContraria:'texto', polo:'ativo|passivo', tribunal:'texto', comarca:'texto', vara:'texto', classe:'texto', area:'texto',
    valorCausa:'centavos', responsavelId:'id equipe', status:'ativo|suspenso|arquivado|encerrado', distribuidoEm:'data', obs:'texto', andamentos:'[{data, texto, por, origem?: projuris}]',
    importado:'projuris (só nos importados)', revisar:'bool (importação com algo a conferir)'},
  publicacoes: {disponibilizacao:'data', publicacao:'data', tribunal:'texto', orgao:'texto', numeroProcesso:'CNJ', processoId:'id', tipo:'texto', texto:'texto',
    oab:'UF+número (ex.: MG181253)', oabs:'[OABs citadas]', djenId:'id/hash do DJEN (evita duplicar)', link:'url DJEN', origem:'manual|importacao|djen', status:'nova|lida|tratada|descartada', responsavelId:'id equipe', prazoId:'id', tratadaEm:'ISO', tratadaPor:'id equipe'},
  prazos: {processo:'CNJ (texto)', processoId:'id', clienteId:'id', cliente:'texto', publicacaoId:'id', tipo:'texto', descricao:'texto', publicacao:'data', dias:'número',
    contagem:'uteis|corridos', vencimento:'data', responsavelId:'id equipe', prioridade:'normal|alta', status:'pendente|concluido', obs:'texto'},
  compromissos: {tipo:'Atendimento|Audiência|Reunião|Inicial|Consulta|Diligência|Ligação / retorno|Tarefa interna|Outro', titulo:'texto', data:'data', diaInteiro:'bool', horaInicio:'HH:MM', horaFim:'HH:MM',
    responsavelId:'id equipe', participantes:'[id equipe]', processoId:'id', clienteId:'id', local:'texto (endereço ou link)', status:'agendado|concluido', obs:'texto',
    migradoParaTarefa:'id da tarefa (só "Tarefa interna": a tarefa vive na Central de tarefas; o compromisso fica na agenda)'},
  tarefas: {titulo:'texto', descricao:'texto', responsavelId:'id equipe', criadoPor:'id equipe', clienteId:'id', processoId:'id', compromissoId:'id', categoria:'texto (lista em config/operacional)',
    prioridade:'baixa|normal|alta|urgente', prioridadeManual:'bool (false = calculada por Regras.prioridadeTarefa)', inicio:'data', prazo:'data',
    status:'aberta|andamento|aguardando_terceiros|concluida|cancelada', statusDesde:'ISO', aguardandoQuem:'texto', dependeDe:'[id tarefa] (aberta = bloqueada)',
    recorrencia:'{freq: diaria|semanal|mensal, intervalo} | null', serieId:'id da primeira tarefa da série (recorrência)',
    origem:'{tipo: manual|automacao|cliente|processo|migracao, ref, regra?}', concluidaEm:'ISO', concluidaPor:'id equipe'},
  // Ids determinísticos: mig-<idCompromisso> (migração) e rec-<serieId>-<prazo> (próxima ocorrência), para várias abas não duplicarem.
  tarefa_comentarios: {tarefaId:'id', texto:'texto', em:'ISO', por:'id equipe'},
  checklist_modelos: {nome:'texto', area:'texto', tipoDemanda:'texto', itens:'[{nome, obrigatorio}] (definição do modelo; editada só por quem edita a equipe)', ativo:'bool'},
  checklist_itens: {clienteId:'id', processoId:'id', modeloId:'id (vazio = item avulso)', ordem:'número', nome:'texto', obrigatorio:'bool',
    situacao:'pendente|solicitado|recebido|conferencia|aprovado|rejeitado|substituir', situacaoDesde:'ISO', documentoId:'id documento',
    recebidoPor:'id equipe', recebidoEm:'ISO', conferidoPor:'id equipe', conferidoEm:'ISO', obs:'texto'},
  // Ids determinísticos chk-<cliente>-<modelo>-<n>. "Documentação completa" = todos os obrigatórios em "aprovado".
  documentos: {nome:'texto', categoria:'texto', assetId:'id do arquivo', contentType:'texto', sizeBytes:'número', clienteId:'id', processoId:'id', enviadoPor:'id equipe', enviadoEm:'ISO'},
  fin_lancamentos: {tipo:'receber|pagar', categoria:'texto', natureza:'honorarios|custas|despesa_processual|operacional|reembolso|outros', descricao:'texto',
    valor:'centavos', vencimento:'data', competencia:'AAAA-MM', status:'pendente|pago|cancelado', pagoEm:'data', valorPago:'centavos', forma:'texto livre',
    conta:'nome da conta/caixa', clienteId:'id', processoId:'id', centroCustoId:'id', reembolsavel:'bool', reembolsoDe:'id lançamento', documento:'nº NF/recibo/guia',
    parcela:'{n, total, grupo}', obs:'texto'},
  centros_custo: {codigo:'texto', nome:'texto', ativo:'bool'},
  modelos: {nome:'texto', tipo:'Procuração|Contrato|Declaração|Petição|Outro', texto:'texto com campos {{cliente.nome}} etc. (lista em App.CAMPOS_MODELO)', ativo:'bool'},
  notif_estado: {usuarioId:'id equipe (o id do documento é o id do membro; "conta-<id>" ou "administrador" sem vínculo)',
    vistas:'{chave: ISO} primeira vez que a pessoa recebeu a notificação', lidas:'{chave: ISO}', dispensadas:'{chave: ISO}'},
  // As notificações em si não são gravadas: são geradas de prazos, compromissos, publicações, processos, financeiro,
  // clientes, documentos e equipe (js/m-notificacoes.js). A chave ("prazo:<id>:vencido:<data>") evita duplicatas.
  historico: {entidade:'coleção (clientes|tarefas|checklist_itens|processos|prazos|…)', entidadeId:'id', acao:'cadastro|criacao|etapa|status|responsavel|prazo|situacao|nota|migracao|…',
    campo:'campo alterado (ou nulo)', antes:'valor anterior', depois:'valor novo', texto:'descrição livre (opcional)', em:'ISO', por:'id equipe (nulo = automação/sem identificação)',
    origem:'usuario|automacao', modulo:'módulo de permissão'},
  // historico: só inclusão (A.registrar em core.js); mudanças de etapa, status e responsável são registradas por A.save.
  // No banco definitivo cada registro é uma linha de app.auditoria (ver docs/modelo-fisico.md).
  'config/operacional': {versao:'1', recenteDias:'dias', processoParadoDias:'dias', atrasoGraveDias:'dias', semResponsavelUteis:'dias úteis', conferenciaUteis:'dias úteis',
    reuniaoSemProvidenciaUteis:'dias úteis', processoSemProvidenciaUteis:'dias úteis', atrasoRepetidoVezes:'número', cargaMaxima:'itens em aberto por pessoa',
    etapas:'{chave: {rotulo, limiteUteis}} (chaves fixas em Regras.ETAPAS)', categoriasTarefa:'[texto]', categoriasUrgentes:'[texto]', pesos:'{criterio: pontos} (prioridade calculada)'},
  // Validado e completado por Regras.normalizar (js/regras-logic.js): valor fora da faixa é ajustado, inválido volta ao padrão.
  'config/geral': {antecedencia:'dias úteis', escritorioNome:'texto', escritorioCidade:'Cidade/UF', feriadosLocais:'[{data, nome}]', contas:'[nome]', saldosIniciais:'{conta: {data, valor}}'},
  'config/permissoes': {papeis:'{papel: {modulo: nenhum|ver|editar}}'},
};
