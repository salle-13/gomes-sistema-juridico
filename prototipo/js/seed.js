/* Dados de exemplo (fictícios). Usados no modo local e para popular a base compartilhada.
   Todos levam exemplo:true para o botão "Remover exemplos". */
(function (root) {
  /* Equipe real do escritório: NÃO leva exemplo:true (não sai com "Remover exemplos").
     O app.js garante que estes membros existam mesmo em dados já salvos (comparando pela OAB). */
  const EQUIPE_FIXA = [
    {id:'lucas-fernando', nome:'Dr. Lucas Fernando Barbosa Gomes', cargo:'Advogado', papel:'admin', oab:'OAB/MG 181.253', email:'', cor:'#1F5C99', genero:'M'},
    {id:'cecilia-cafrune', nome:'Cecilia Souza Silva Cafrune', cargo:'Gerente', papel:'gerente', oab:'', email:'', cor:'#0F7C8C', genero:'F'},
    {id:'janaina-amorim', nome:'Dra. Janaina Cardoso Amorim', cargo:'Advogada', papel:'advogado', oab:'OAB/MG 233.867', email:'', cor:'#8A3B6B', genero:'F'},
    {id:'marcella-soares', nome:'Marcella Rosa Soares', cargo:'Assistente administrativa', papel:'assistente', oab:'', email:'', cor:'#5B4FA8', genero:'F'},
    {id:'claudianne-santos', nome:'Claudianne Cristiane Alves dos Santos', cargo:'Assistente administrativa', papel:'assistente', oab:'', email:'', cor:'#B5651D', genero:'F'},
    {id:'luisa-rodrigues', nome:'Luísa Caetano Moreira Rodrigues', cargo:'Estagiária', papel:'estagiario', oab:'', email:'', cor:'#2C7A4D', genero:'F'},
  ];
  function seed(hoje, P) {
    const add = (s, n) => P.addDays(s, n);
    const mes = (n, dia) => { const d = P.parse(hoje); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(dia); return P.ymd(d); };
    const ex = o => Object.assign(o, {exemplo: true});
    const equipe = [
      {id:'m1', nome:'Dra. Helena Duarte', cargo:'Advogada sócia', papel:'admin', oab:'OAB/MG 123.456', email:'helena@exemplo.adv.br', cor:'#273884', genero:'F'},
      {id:'m2', nome:'Dr. Rafael Moura', cargo:'Advogado', papel:'advogado', oab:'OAB/MG 234.567', email:'rafael@exemplo.adv.br', cor:'#8A3B6B', genero:'M'},
      {id:'m3', nome:'Camila Teixeira', cargo:'Advogada', papel:'advogado', oab:'OAB/MG 345.678', email:'camila@exemplo.adv.br', cor:'#2C7A4D', genero:'F'},
      {id:'m4', nome:'Lucas Pereira', cargo:'Estagiário', papel:'estagiario', oab:'OAB/MG 98.765-E', email:'lucas@exemplo.adv.br', cor:'#B5651D', genero:'M'},
      {id:'m5', nome:'Bianca Lopes', cargo:'Assistente administrativa (captação)', papel:'assistente', oab:'', email:'bianca@exemplo.adv.br', cor:'#5B4FA8', genero:'F'},
      {id:'m6', nome:'Paula Reis', cargo:'Gerente', papel:'gerente', oab:'', email:'paula@exemplo.adv.br', cor:'#0F7C8C', genero:'F'},
    ].map(ex);
    equipe.unshift(...EQUIPE_FIXA.map(m => Object.assign({}, m)));
    const C = (id, nome, tp, doc, area, resp, extra) => ex(Object.assign({id, nome, tipoPessoa:tp, documento:doc, telefone:'(34) 9' + (8000 + id.length * 111) + '-' + String(1000 + nome.length * 37).slice(0,4), email:'', origem:'Indicação de cliente', area, historia:'', urgencia:'normal', status:'ativo', encaminhadoPara:[resp], responsavelId:resp, cadastradoPor:'m5', criadoEm:mes(-6, 10) + 'T12:00:00.000Z', aceitoEm:mes(-6, 11) + 'T12:00:00.000Z', historico:[]}, extra || {}));
    const clientes = [
      C('k1','Construtora Alvorada (exemplo)','PJ','11.111.111/0001-11','Direito Civil','m1'),
      C('k2','Marcos Antunes','PF','111.222.333-44','Direito Trabalhista','m2', {nacionalidade:'brasileiro', estadoCivil:'casado', profissao:'motorista', rg:'MG-11.222.333 SSP/MG', endereco:'Rua das Flores, 120, Bairro Goiás, Araguari/MG, CEP 38440-000'}),
      C('k3','Farmácia Boa Saúde (exemplo)','PJ','22.222.222/0001-22','Consumidor','m3'),
      C('k4','Juliana Ramos','PF','222.333.444-55','Família e Sucessões','m3'),
      C('k5','Metalúrgica Santos (exemplo)','PJ','33.333.333/0001-33','Direito Trabalhista','m2', {endereco:'Avenida Minas Gerais, 2.500, Distrito Industrial, Araguari/MG, CEP 38446-000', representanteNome:'Sérgio Santos', representanteCpf:'444.555.666-77', representanteCargo:'sócio-administrador'}),
      C('k6','Transportes Lima (exemplo)','PJ','44.444.444/0001-44','Cobrança','m1'),
      C('k7','Padaria Pão Dourado (exemplo)','PJ','55.555.555/0001-55','Direito Trabalhista','m2'),
      C('k8','Clínica Vida Plena (exemplo)','PJ','66.666.666/0001-66','Direito Civil','m3'),
      C('k9','Sítio Boa Esperança (exemplo)','PJ','77.777.777/0001-77','Cobrança','m1'),
      C('k10','Ana Beatriz Costa','PF','333.444.555-66','Direito Civil','m4', {status:'encerrado'}),
      C('c1','Fernanda Albuquerque','PF','123.456.789-00','Direito Trabalhista','m3', {status:'novo', aceitoEm:null, urgencia:'alta', criadoEm:add(hoje,-3) + 'T14:20:00.000Z', etapa:'reuniao_realizada', etapaDesde:add(hoje,-1) + 'T16:00:00.000Z', dataEntrada:add(hoje,-3),
        atendimentoResponsavelId:'m5', tipoDemanda:'Verbas rescisórias', proximaProvidencia:'Pedir CTPS, TRCT e extrato do FGTS',
        historia:'Trabalhou 4 anos como auxiliar administrativa em um atacadista de Araguari. Dispensada sem justa causa em outubro, sem verbas rescisórias nem multa do FGTS. Relata horas extras habituais sem pagamento.',
        historico:[{em:add(hoje,-3) + 'T14:25:00.000Z', por:'m5', texto:'Encaminhado para Camila Teixeira.'}]}),
      C('c2','Cerealista Grão do Cerrado Ltda. (exemplo)','PJ','88.888.888/0001-88','Cobrança','m1', {status:'novo', encaminhadoPara:[], responsavelId:'', aceitoEm:null, criadoEm:hoje + 'T12:05:00.000Z', origem:'Site / formulário',
        etapa:'novo_contato', etapaDesde:hoje + 'T12:05:00.000Z', dataEntrada:hoje, atendimentoResponsavelId:'', tipoDemanda:'Cobrança', proximaProvidencia:'',
        historia:'Quer cobrar três compradores de café e soja inadimplentes, cerca de R$ 48 mil em duplicatas vencidas. Notificação extrajudicial sem resposta.'}),
      C('c3','João Batista Nogueira','PF','987.654.321-00','Direito Previdenciário','m1', {aceitoEm:add(hoje,-10) + 'T10:30:00.000Z', criadoEm:add(hoje,-11) + 'T15:00:00.000Z', origem:'Instagram',
        historia:'Aposentadoria negada pelo INSS por falta de reconhecimento de período rural (1985 a 1992) na zona rural de Araguari.',
        historico:[{em:add(hoje,-10) + 'T10:30:00.000Z', por:'m1', texto:'Caso aceito.'}]}),
    ];
    const PR = (id, numero, cli, parte, polo, trib, vara, classe, area, valor, resp, dist) => ex({id, numero, clienteId:cli, parteContraria:parte, polo, tribunal:trib, comarca:'Araguari', vara, classe, area, valorCausa:valor, responsavelId:resp, status:'ativo', distribuidoEm:dist, obs:'', andamentos:[]});
    const processos = [
      PR('pr1','5001234-67.2026.8.13.0035','k1','Condomínio Residencial Jardim (exemplo)','passivo','TJMG','1ª Vara Cível','Procedimento comum cível','Direito Civil',8540000,'m1',mes(-3,5)),
      PR('pr2','0010456-12.2025.5.03.0000','k2','Atacadista Central (exemplo)','ativo','TRT3','Vara do Trabalho','Reclamação trabalhista','Direito Trabalhista',4200000,'m2',mes(-10,12)),
      PR('pr3','5002345-78.2025.8.13.0035','k3','Distribuidora Norte (exemplo)','ativo','TJMG','3ª Vara Cível','Procedimento comum cível','Consumidor',2275000,'m3',mes(-12,2)),
      PR('pr4','5004567-89.2026.8.13.0035','k4','Carlos Ramos','ativo','TJMG','Juizado Especial','Procedimento do Juizado Especial Cível','Família e Sucessões',1800000,'m4',mes(-2,20)),
      PR('pr5','0010987-54.2026.5.03.0000','k5','Antônio Ferreira','passivo','TRT3','Vara do Trabalho','Reclamação trabalhista','Direito Trabalhista',6700000,'m2',mes(-4,8)),
      PR('pr6','5003456-56.2026.8.13.0035','k6','Comercial Triângulo (exemplo)','ativo','TJMG','2ª Vara Cível','Execução de título extrajudicial','Cobrança',3912000,'m1',mes(-2,3)),
      PR('pr7','0010789-11.2026.5.03.0000','k7','Rosana Alves','passivo','TRT3','Vara do Trabalho','Reclamação trabalhista','Direito Trabalhista',2850000,'m2',mes(-1,14)),
      PR('pr8','1045678-90.2026.8.13.0000','k8','Plano de Saúde Regional (exemplo)','ativo','TJMG','2ª instância','Agravo de instrumento','Direito Civil',12000000,'m3',mes(-1,28)),
      PR('pr9','5005678-12.2024.8.13.0035','k9','Agropecuária Serra (exemplo)','ativo','TJMG','4ª Vara Cível','Cumprimento de sentença','Cobrança',5610000,'m1',mes(-22,9)),
      PR('pr10','5006789-34.2026.8.13.0035','k10','Imobiliária Centro (exemplo)','ativo','TJMG','1ª Vara Cível','Procedimento comum cível','Direito Civil',950000,'m4',mes(-5,17)),
    ];
    const PASTAS = {pr1: 3412, pr2: 3297, pr3: 3301, pr4: 3420, pr5: 3388, pr6: 3415, pr7: 3431, pr8: 3436, pr9: 3104, pr10: 3398};
    processos.forEach(p => { p.pasta = PASTAS[p.id]; });
    processos[2].andamentos = [{data:mes(-1,2), texto:'Sentença de improcedência publicada.', por:'m3'}, {data:mes(-6,15), texto:'Audiência de conciliação sem acordo.', por:'m3'}];
    const pz = (id, pr, dias, pubOff, tipo, desc, resp, prio, status) => { const p = processos.find(x => x.id === pr); const pub = add(hoje, pubOff);
      return ex({id, processo:p.numero, processoId:pr, clienteId:p.clienteId, cliente:clientes.find(c => c.id === p.clienteId).nome, tipo, descricao:desc, publicacao:pub, dias, contagem:'uteis', vencimento:P.vencimento(pub, dias, 'uteis'), responsavelId:resp, prioridade:prio||'normal', status:status||'pendente', obs:''}); };
    const prazos = [
      pz('ex1','pr1',15,-24,'Contestação','Contestar com pedido de reconvenção','m1','alta'),
      pz('ex2','pr2',5,-7,'Embargos de Declaração','Omissão sobre horas extras','m2'),
      pz('ex3','pr3',15,-20,'Recurso de Apelação','Apelar da sentença de improcedência','m3','alta'),
      pz('ex4','pr4',5,-4,'Manifestação','Manifestar sobre laudo pericial','m4'),
      pz('ex5','pr5',8,-5,'Impugnação','Impugnar cálculos de liquidação','m2'),
      pz('ex6','pr6',15,-9,'Réplica','','m1'),
      pz('ex7','pr7',15,-3,'Contrarrazões','','m2'),
      pz('ex8','pr8',15,0,'Agravo Interno','Recorrer da negativa de tutela','m3','alta'),
      pz('ex9','pr9',15,15,'Cumprimento de sentença','Apresentar planilha de débito','m1'),
      pz('ex10','pr10',15,-27,'Juntada de documentos','Juntar procuração e contrato','m4','normal','concluido'),
    ];
    const util = n => { let d = n >= 0 ? P.proximoUtil(hoje) : hoje; const passo = n < 0 ? -1 : 1; for (let i = 0; i !== n; ) { d = add(d, passo); if (P.diaUtil(d)) i += passo; } return d; };
    const cp = (id, dOff, ini, fim, tipo, titulo, resp, extra) => ex(Object.assign({id, data:util(dOff), diaInteiro:!ini, horaInicio:ini || '', horaFim:fim || '', tipo, titulo, responsavelId:resp, participantes:[], processoId:'', clienteId:'', local:'', status:'agendado', obs:''}, extra || {}));
    const compromissos = [
      cp('cp1', 0, '08:00', '09:00', 'Atendimento', 'Sr. Marcos Antunes (documentos da reclamação)', 'm2', {clienteId:'k2', local:'Escritório Araguari'}),
      cp('cp2', 0, '10:00', '11:00', 'Inicial', 'Ação de cobrança · Transportes Lima', 'm1', {clienteId:'k6'}),
      cp('cp3', 0, '14:00', '15:00', 'Reunião', 'Reunião semanal da equipe', 'm1', {participantes:['m2','m3','m4','m5'], local:'Sala de reuniões'}),
      cp('cp4', 1, '08:40', '09:40', 'Audiência', 'Audiência inicial virtual', 'm2', {processoId:'pr7', clienteId:'k7', local:'Sala virtual do TRT3'}),
      cp('cp5', 1, '13:30', '14:30', 'Atendimento', 'Nova cliente (indicação) · para Camila', 'm5', {participantes:['m3']}),
      cp('cp6', 2, '09:00', '10:00', 'Consulta', 'Consulta de 2 CPFs · Farmácia Boa Saúde', 'm4', {clienteId:'k3'}),
      cp('cp7', 2, '16:00', '17:00', 'Ligação / retorno', 'Retornar Sra. Juliana sobre perícia', 'm3', {clienteId:'k4', processoId:'pr4'}),
      cp('cp8', 3, '', '', 'Diligência', 'Protocolo físico no Fórum de Araguari', 'm4'),
      cp('cp9', 4, '10:00', '11:00', 'Audiência', 'Audiência de conciliação', 'm1', {processoId:'pr6', clienteId:'k6', local:'Fórum de Araguari · 2ª Vara Cível'}),
      cp('cp10', 6, '15:00', '16:00', 'Atendimento', 'Sr. Sérgio Santos (Metalúrgica Santos)', 'm2', {clienteId:'k5'}),
      cp('cp11', -1, '09:00', '10:00', 'Atendimento', 'Entrega de documentos · Padaria Pão Dourado', 'm5', {clienteId:'k7', status:'concluido'}),
      cp('cp12', -2, '14:00', '15:30', 'Reunião', 'Estratégia do agravo · Plano de Saúde Regional', 'm3', {processoId:'pr8', participantes:['m1'], status:'concluido'}),
    ];
    const pub = (id, pr, dispOff, tipo, texto, status, prazoId) => { const p = processos.find(x => x.id === pr); const disp = add(hoje, dispOff);
      return ex({id, disponibilizacao:disp, publicacao:P.proximoUtil(add(disp,1)), tribunal:p ? p.tribunal : 'TJMG', orgao:p ? p.vara + ' de Araguari' : '2ª Vara Cível de Araguari', numeroProcesso:p ? p.numero : '5009999-01.2026.8.13.0035', processoId:p ? p.id : '', tipo, texto, oab:'MG123456', origem:'manual', status, responsavelId:p ? p.responsavelId : 'm1', prazoId:prazoId||''}); };
    const publicacoes = [
      pub('pb1','pr2',-8,'Intimação','Fica a parte reclamante intimada da sentença de embargos, podendo opor embargos de declaração no prazo legal.','tratada','ex2'),
      pub('pb2','pr7',-4,'Intimação','Intimem-se as partes para apresentarem contrarrazões ao recurso ordinário no prazo de 8 dias.','tratada','ex7'),
      pub('pb3','pr6',-1,'Despacho','Especifiquem as partes, no prazo de 15 dias, as provas que pretendem produzir, justificando a pertinência.','nova'),
      pub('pb4','',-1,'Intimação','Intima-se o advogado para regularizar a representação processual no prazo de 5 dias, sob pena de desentranhamento.','nova'),
      pub('pb5','pr3',-2,'Certidão','Certifico que decorreu o prazo para manifestação da parte requerida.','lida'),
    ];
    const centros_custo = [['cc1','01','Administrativo'],['cc2','02','Contencioso cível'],['cc3','03','Trabalhista'],['cc4','04','Previdenciário'],['cc5','05','Captação e marketing']].map(([id,codigo,nome]) => ex({id, codigo, nome, ativo:true}));
    const fin = []; let n = 0;
    const L = (o) => { const pago = o.status === 'pago'; fin.push(ex(Object.assign({id:'fl' + (++n), competencia:String(o.vencimento).slice(0,7), status:'pendente', pagoEm:pago ? o.vencimento : '', valorPago:pago ? o.valor : 0, forma:pago ? 'Transferência' : '', conta:'Conta corrente', clienteId:'', processoId:'', centroCustoId:'cc1', reembolsavel:false, documento:'', obs:''}, o))); };
    for (let i = -5; i <= 1; i++) {
      const passado = i < 0 || (i === 0 && mes(0, 10) < hoje);
      L({tipo:'pagar', categoria:'Aluguel', natureza:'operacional', descricao:'Aluguel do escritório – Interlagos', valor:280000, vencimento:mes(i,10), status:passado ? 'pago' : 'pendente', centroCustoId:'cc1'});
      L({tipo:'pagar', categoria:'Software e sistemas', natureza:'operacional', descricao:'Internet e telefonia', valor:24990, vencimento:mes(i,15), status:(i < 0 || mes(i,15) < hoje) ? 'pago' : 'pendente', centroCustoId:'cc1'});
      L({tipo:'pagar', categoria:'Pessoal', natureza:'operacional', descricao:'Bolsa de estágio', valor:150000, vencimento:mes(i,5), status:(i < 0 || mes(i,5) < hoje) ? 'pago' : 'pendente', centroCustoId:'cc1'});
      L({tipo:'pagar', categoria:'Marketing', natureza:'operacional', descricao:'Anúncios em redes sociais', valor:60000 + (i + 5) * 5000, vencimento:mes(i,20), status:(i < 0 || mes(i,20) < hoje) ? 'pago' : 'pendente', centroCustoId:'cc5'});
      L({tipo:'receber', categoria:'Honorários contratuais', natureza:'honorarios', descricao:'Honorários mensais – assessoria', valor:350000, vencimento:mes(i,5), status:(i < 0 || mes(i,5) < hoje) ? 'pago' : 'pendente', clienteId:'k1', centroCustoId:'cc2'});
      L({tipo:'receber', categoria:'Honorários contratuais', natureza:'honorarios', descricao:'Honorários mensais – assessoria trabalhista', valor:220000, vencimento:mes(i,10), status:i < -1 ? 'pago' : 'pendente', clienteId:'k5', centroCustoId:'cc3'});
    }
    L({tipo:'receber', categoria:'Honorários iniciais', natureza:'honorarios', descricao:'Honorários iniciais – parcela 2/3', valor:150000, vencimento:add(hoje,-12), clienteId:'k6', processoId:'pr6', centroCustoId:'cc2', parcela:{n:2,total:3,grupo:'g1'}});
    L({tipo:'receber', categoria:'Honorários iniciais', natureza:'honorarios', descricao:'Honorários iniciais – parcela 3/3', valor:150000, vencimento:add(hoje,18), clienteId:'k6', processoId:'pr6', centroCustoId:'cc2', parcela:{n:3,total:3,grupo:'g1'}});
    L({tipo:'receber', categoria:'Honorários de êxito', natureza:'honorarios', descricao:'Êxito – acordo trabalhista', valor:840000, vencimento:add(hoje,-40), status:'pago', clienteId:'k2', processoId:'pr2', centroCustoId:'cc3'});
    L({tipo:'pagar', categoria:'Custas processuais', natureza:'custas', descricao:'Preparo da apelação (guia TJMG)', valor:61000, vencimento:add(hoje,2), clienteId:'k3', processoId:'pr3', centroCustoId:'cc2', reembolsavel:true, documento:'Guia nº 0001'});
    L({tipo:'pagar', categoria:'Custas processuais', natureza:'custas', descricao:'Custas iniciais (guia TJMG)', valor:41235, vencimento:add(hoje,-60), status:'pago', clienteId:'k6', processoId:'pr6', centroCustoId:'cc2', reembolsavel:true});
    L({tipo:'pagar', categoria:'Despesas processuais', natureza:'despesa_processual', descricao:'Diligência do oficial de justiça', valor:9840, vencimento:add(hoje,-20), status:'pago', clienteId:'k6', processoId:'pr6', centroCustoId:'cc2', reembolsavel:true});
    L({tipo:'pagar', categoria:'Despesas processuais', natureza:'despesa_processual', descricao:'Deslocamento para audiência em Uberlândia', valor:18500, vencimento:add(hoje,-6), status:'pago', clienteId:'k2', processoId:'pr2', centroCustoId:'cc3', conta:'Caixa', forma:'Dinheiro'});
    L({tipo:'pagar', categoria:'Despesas processuais', natureza:'despesa_processual', descricao:'Cópias e autenticações', valor:4620, vencimento:add(hoje,5), clienteId:'k8', processoId:'pr8', centroCustoId:'cc2', reembolsavel:true});
    L({tipo:'receber', categoria:'Reembolso de despesas', natureza:'reembolso', descricao:'Reembolso de custas e diligência', valor:51075, vencimento:add(hoje,-5), clienteId:'k6', processoId:'pr6', centroCustoId:'cc2'});
    const documentos = [];
    const config = {antecedencia:5, escritorioNome:'Gomes Assessoria Jurídica', escritorioCidade:'Araguari/MG', contas:['Caixa','Conta corrente'], saldosIniciais:{'Conta corrente':{data:mes(-6,1), valor:1500000}, 'Caixa':{data:mes(-6,1), valor:50000}},
      feriadosLocais:[Number(hoje.slice(0,4)), Number(hoje.slice(0,4)) + 1].flatMap(a => [{data:a+'-08-06',nome:'Senhor Bom Jesus da Cana Verde (Araguari)'},{data:a+'-08-15',nome:'Nossa Senhora da Abadia (Araguari)'},{data:a+'-08-28',nome:'Dia da Cidade (Araguari)'}])};
    const modelos = [
      {id:'md1', nome:'Procuração ad judicia et extra', tipo:'Procuração', ativo:true, texto:
`PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: {{cliente.qualificacao}}.

PARTE OUTORGADA: {{advogado.tratamento}} {{advogado.nome}}, {{advogado.qualificacao}} com inscrição na {{advogado.oab}}, integrante do escritório {{escritorio.nome}}, com sede em {{escritorio.cidade}}, endereço eletrônico {{advogado.email}}.

PODERES: pelo presente instrumento, a parte OUTORGANTE nomeia e constitui a PARTE OUTORGADA para representá-la, conferindo-lhe os poderes da cláusula ad judicia et extra para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, reconhecer a procedência do pedido, renunciar ao direito sobre o qual se funda a ação, declarar hipossuficiência econômica e substabelecer esta a outrem, com ou sem reservas de iguais poderes, nos termos do art. 105 do Código de Processo Civil.

{{escritorio.cidade}}, {{data_hoje_extenso}}.



_______________________________________
{{cliente.nome}}
CPF/CNPJ {{cliente.cpf_cnpj}}`},
      {id:'md2', nome:'Contrato de honorários advocatícios', tipo:'Contrato', ativo:true, texto:
`CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS

PARTE CONTRATANTE: {{cliente.qualificacao}}, telefone {{cliente.telefone}}.

PARTE CONTRATADA: {{advogado.tratamento}} {{advogado.nome}}, {{advogado.qualificacao}} com inscrição na {{advogado.oab}}, integrante do escritório {{escritorio.nome}}, com sede em {{escritorio.cidade}}.

CLÁUSULA 1ª – DO OBJETO. A PARTE CONTRATADA prestará serviços advocatícios à PARTE CONTRATANTE no patrocínio da ação {{processo.classe}}, autos nº {{processo.numero}}, em trâmite na {{processo.vara}} da comarca de {{processo.comarca}} ({{processo.tribunal}}), em face de {{processo.parte_contraria}}, até a decisão final.

CLÁUSULA 2ª – DOS HONORÁRIOS. Pelos serviços, a PARTE CONTRATANTE pagará à PARTE CONTRATADA: (a) honorários iniciais de {{honorarios.valor}} ({{honorarios.valor_extenso}}), em ___ parcela(s) mensal(is), com vencimento no dia ___ de cada mês; e (b) honorários de êxito correspondentes a {{honorarios.percentual_exito}} do proveito econômico obtido, pagos na data do recebimento. Os honorários de sucumbência pertencem à PARTE CONTRATADA, nos termos do art. 23 da Lei nº 8.906/1994.

CLÁUSULA 3ª – DAS DESPESAS. Custas, taxas, emolumentos, perícias, diligências e deslocamentos correm por conta da PARTE CONTRATANTE, que os reembolsará mediante comprovante.

CLÁUSULA 4ª – DO INADIMPLEMENTO. O atraso no pagamento implica multa de 2% e juros de 1% ao mês, e autoriza a PARTE CONTRATADA a renunciar ao mandato, observado o art. 5º, § 3º, da Lei nº 8.906/1994.

CLÁUSULA 5ª – DA RESCISÃO. A revogação do mandato pela PARTE CONTRATANTE não a desobriga do pagamento dos honorários proporcionais aos serviços prestados e dos honorários de êxito, se houver proveito econômico posterior.

CLÁUSULA 6ª – DO FORO. Fica eleito o foro da comarca de {{escritorio.cidade}} para dirimir dúvidas oriundas deste contrato.

E, por estarem justas e contratadas, as partes assinam o presente em duas vias de igual teor.

{{escritorio.cidade}}, {{data_hoje_extenso}}.



_______________________________________
{{cliente.nome}} – PARTE CONTRATANTE



_______________________________________
{{advogado.tratamento}} {{advogado.nome}} – {{advogado.oab}} – PARTE CONTRATADA`},
      {id:'md3', nome:'Declaração de hipossuficiência', tipo:'Declaração', ativo:true, texto:
`DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA

Eu, {{cliente.qualificacao}}, DECLARO, para os fins do art. 99 do Código de Processo Civil e da Lei nº 1.060/1950, sob as penas da lei, que não possuo condições de arcar com as custas e despesas processuais e com os honorários advocatícios sem prejuízo do meu próprio sustento e do de minha família, razão pela qual requeiro os benefícios da gratuidade da justiça.

Declaro, ainda, estar ciente de que a falsidade desta declaração sujeita o declarante às sanções civis, administrativas e penais cabíveis, inclusive ao pagamento de até o décuplo das custas judiciais, nos termos do art. 100, parágrafo único, do Código de Processo Civil.

{{escritorio.cidade}}, {{data_hoje_extenso}}.



_______________________________________
{{cliente.nome}}`},
    ].map(m => ex(Object.assign(m, {criadoEm: mes(-2, 3) + 'T12:00:00.000Z', criadoPor: 'm1'})));
    // Modelo de checklist de exemplo (Checklists de documentos). Itens obrigatórios definem a "documentação completa".
    const checklist_modelos = [ex({id:'chkm-prev-rural', nome:'Aposentadoria rural (exemplo)', area:'Direito Previdenciário', tipoDemanda:'Aposentadoria rural', ativo:true, itens:[
      {nome:'Documento de identidade (RG ou CNH) e CPF', obrigatorio:true}, {nome:'Comprovante de residência atualizado', obrigatorio:true},
      {nome:'CNIS (extrato previdenciário)', obrigatorio:true}, {nome:'Carta de indeferimento do INSS', obrigatorio:false},
      {nome:'Certidão de casamento ou nascimento', obrigatorio:true}, {nome:'Documentos rurais (ITR, notas do produtor, contrato de parceria)', obrigatorio:true},
      {nome:'Declaração de testemunhas do trabalho rural', obrigatorio:false}, {nome:'Procuração e contrato de honorários assinados', obrigatorio:true}]})];
    const op = exemplosOperacionais(hoje, P);
    return {data:{equipe, clientes:clientes.concat(op.clientes), processos, publicacoes, prazos, compromissos, documentos, fin_lancamentos:fin, centros_custo, modelos,
      checklist_modelos:checklist_modelos.concat(op.checklist_modelos), checklist_itens:op.checklist_itens, tarefas:op.tarefas, tarefa_comentarios:op.tarefa_comentarios, historico:op.historico}, config};
  }

  /* Exemplos da captação, dos checklists e das tarefas (recorrentes e comuns), para entender as funções na prática.
     Ficam aqui separados porque também entram, uma única vez, em dados locais criados antes deles (migração em m-tarefas.js).
     Ids fixos (c4, c5, exop-*, chk-<cliente>-<modelo>-<n>, rec-<série>-<prazo>): rodar de novo só sobrescreve. */
  function exemplosOperacionais(hoje, P) {
    const R = typeof Regras !== 'undefined' ? Regras : require('./regras-logic.js');
    const add = (s, n) => P.addDays(s, n), ts = (d, h) => d + 'T' + (h || '13:00') + ':00.000Z';
    const util = (n) => { let d = add(hoje, n); while (P.fimDeSemana(d)) d = add(d, n < 0 ? -1 : 1); return d; }; // prazo de exemplo fora do fim de semana
    const ex = o => Object.assign(o, {exemplo: true});
    const CLI = (o) => ex(Object.assign({tipoPessoa:'PF', email:'', origem:'Indicação de cliente', urgencia:'normal', status:'novo', encaminhadoPara:[], aceitoEm:null, historico:[],
      cadastradoPor:'m5', criadoPor:'m5', atendimentoResponsavelId:'m5', area:'Direito Previdenciário', tipoDemanda:'Aposentadoria rural'}, o));
    const clientes = [
      CLI({id:'c4', nome:'Maria Aparecida Rezende', documento:'456.789.123-00', telefone:'(34) 99812-4410', responsavelId:'m1', criadoEm:ts(add(hoje,-12),'12:30'), dataEntrada:add(hoje,-12),
        etapa:'aguardando_documentos', etapaDesde:ts(add(hoje,-6),'14:00'), proximaProvidencia:'Cobrar nova cópia do CNIS e os documentos rurais',
        historia:'Trabalhadora rural em regime de economia familiar desde 1990, num sítio da zona rural de Araguari. Tem 57 anos e quer pedir a aposentadoria por idade rural. EXEMPLO DE CHECKLIST EM ANDAMENTO: veja o bloco Checklist desta ficha.'}),
      CLI({id:'c5', nome:'José Carlos Ferreira', documento:'321.654.987-00', telefone:'(34) 99745-2231', responsavelId:'m1', criadoEm:ts(add(hoje,-20),'11:00'), dataEntrada:add(hoje,-20),
        etapa:'conferencia_documental', etapaDesde:ts(add(hoje,-1),'16:30'), proximaProvidencia:'Criar a pasta e preparar a petição inicial',
        historia:'Lavrador desde a juventude, 61 anos, aposentadoria rural negada pelo INSS por falta de prova do período de 1995 a 2005. EXEMPLO DE CHECKLIST COMPLETO: todos os documentos obrigatórios aprovados.'}),
    ];
    const checklist_modelos = [ex({id:'chkm-trab-rescisao', nome:'Verbas rescisórias (exemplo)', area:'Direito Trabalhista', tipoDemanda:'Verbas rescisórias', ativo:true, criadoEm:ts(add(hoje,-30)), criadoPor:'m1', itens:[
      {nome:'Documento de identidade (RG ou CNH), CPF e comprovante de residência', obrigatorio:true}, {nome:'Carteira de trabalho (CTPS digital ou física)', obrigatorio:true},
      {nome:'Termo de rescisão (TRCT)', obrigatorio:true}, {nome:'Extrato do FGTS', obrigatorio:true}, {nome:'Contracheques dos últimos 12 meses', obrigatorio:true},
      {nome:'Comunicado de dispensa ou aviso prévio', obrigatorio:false}, {nome:'Controle de ponto, mensagens ou nomes de testemunhas das horas extras', obrigatorio:false},
      {nome:'Procuração e contrato de honorários assinados', obrigatorio:true}]})];
    // Itens do modelo "Aposentadoria rural (exemplo)" (chkm-prev-rural, no seed principal), na mesma ordem dos documentos do modelo.
    const NOMES = ['Documento de identidade (RG ou CNH) e CPF', 'Comprovante de residência atualizado', 'CNIS (extrato previdenciário)', 'Carta de indeferimento do INSS',
      'Certidão de casamento ou nascimento', 'Documentos rurais (ITR, notas do produtor, contrato de parceria)', 'Declaração de testemunhas do trabalho rural', 'Procuração e contrato de honorários assinados'];
    const OBR = [true, true, true, false, true, true, false, true];
    const item = (cli, n, situacao, d, obs) => { const rec = situacao !== 'pendente' && situacao !== 'solicitado', conf = ['aprovado', 'rejeitado', 'substituir'].includes(situacao);
      return ex({id:'chk-' + cli + '-chkm-prev-rural-' + n, clienteId:cli, processoId:'', modeloId:'chkm-prev-rural', ordem:n, nome:NOMES[n], obrigatorio:OBR[n], situacao, situacaoDesde:ts(d),
        documentoId:'', recebidoPor:rec ? 'm5' : null, recebidoEm:rec ? ts(add(d, conf ? -1 : 0), '12:00') : null, conferidoPor:conf ? 'm1' : null, conferidoEm:conf ? ts(d) : null, obs:obs || '',
        criadoEm:ts(add(hoje, cli === 'c4' ? -6 : -15), '14:05'), criadoPor:'m5'}); };
    const checklist_itens = [
      item('c4', 0, 'aprovado', add(hoje,-5)), item('c4', 1, 'aprovado', add(hoje,-5)),
      item('c4', 2, 'rejeitado', add(hoje,-3), 'Cópia ilegível. Pedir nova emissão pelo Meu INSS.'),
      item('c4', 3, 'pendente', add(hoje,-6), 'Opcional: só se ela já tiver pedido no INSS.'),
      item('c4', 4, 'conferencia', add(hoje,-1)), item('c4', 5, 'solicitado', add(hoje,-6), 'Pedido por WhatsApp: ITR e notas do produtor de 1990 em diante.'),
      item('c4', 6, 'recebido', add(hoje,-2)), item('c4', 7, 'aprovado', add(hoje,-6)),
      ...[0, 1, 2, 4, 5, 6, 7].map(n => item('c5', n, 'aprovado', add(hoje, n < 4 ? -4 : -2))), item('c5', 3, 'aprovado', add(hoje,-4), 'Indeferimento de março; base do pedido judicial.'),
    ];
    const H = (id, cli, em, por, texto, extra) => ex(Object.assign({id, entidade:'clientes', entidadeId:cli, acao:'alteracao', campo:null, antes:null, depois:null, texto, em, por, origem:'usuario', modulo:'clientes'}, extra || {}));
    const historico = [
      H('exop-h1', 'c4', ts(add(hoje,-12),'12:30'), 'm5', null, {acao:'cadastro'}),
      H('exop-h2', 'c4', ts(add(hoje,-7),'15:00'), 'm5', null, {acao:'etapa', campo:'etapa', antes:'reuniao_agendada', depois:'reuniao_realizada'}),
      H('exop-h3', 'c4', ts(add(hoje,-6),'14:00'), 'm5', null, {acao:'etapa', campo:'etapa', antes:'reuniao_realizada', depois:'aguardando_documentos'}),
      H('exop-h4', 'c4', ts(add(hoje,-6),'14:05'), 'm5', 'Checklist “Aposentadoria rural (exemplo)” aplicado (8 documento(s))', {acao:'checklist'}),
      H('exop-h5', 'c5', ts(add(hoje,-15),'14:05'), 'm5', 'Checklist “Aposentadoria rural (exemplo)” aplicado (8 documento(s))', {acao:'checklist'}),
      H('exop-h6', 'c5', ts(add(hoje,-1),'16:30'), 'm5', null, {acao:'etapa', campo:'etapa', antes:'documentacao_recebida', depois:'conferencia_documental'}),
      ...[['exop-h7', 2, -4, 'm5', 'solicitado', 'recebido'], ['exop-h8', 2, -3, 'm1', 'recebido', 'rejeitado'], ['exop-h9', 5, -6, 'm5', 'pendente', 'solicitado'], ['exop-h10', 4, -1, 'm5', 'solicitado', 'conferencia']]
        .map(([id, n, d, por, antes, depois]) => H(id, 'c4', ts(add(hoje, d), '15:30'), por, null, {entidade:'checklist_itens', entidadeId:'chk-c4-chkm-prev-rural-' + n, acao:'situacao', campo:'situacao', antes, depois})),
    ];
    const T = o => ex(Object.assign({descricao:'', responsavelId:'', clienteId:'', processoId:'', compromissoId:'', categoria:'', prioridade:'normal', prioridadeManual:false, inicio:'', prazo:'',
      status:'aberta', aguardandoQuem:'', dependeDe:[], recorrencia:null, origem:{tipo:'manual'}, concluidaEm:null, concluidaPor:null, criadoEm:ts(add(hoje,-14),'11:00'), criadoPor:'m6'}, o));
    // Recorrente já concluída uma vez: a ocorrência seguinte é gerada pela mesma regra do sistema (id rec-<série>-<prazo>).
    const serie = (o, concluidaEm) => { const t = T(Object.assign(o, {status:'concluida', concluidaEm, concluidaPor:o.responsavelId, statusDesde:concluidaEm}));
      const prox = Object.assign(R.proximaOcorrencia(t, hoje), {exemplo:true, criadoEm:concluidaEm, criadoPor:null, statusDesde:concluidaEm}); return [t, prox]; };
    const tarefas = [
      ...serie({id:'exop-t1', titulo:'Conferir publicações do DJEN', responsavelId:'m4', categoria:'Processual', prazo:util(-1), recorrencia:{freq:'diaria', intervalo:1},
        descricao:'EXEMPLO DE TAREFA RECORRENTE (todo dia útil). Abrir Publicações, vincular cada intimação ao processo e lançar os prazos. Ao concluir, a tarefa do próximo dia útil aparece sozinha.'}, ts(add(hoje,-1),'18:10')),
      ...serie({id:'exop-t2', titulo:'Verificar no Meu INSS os requerimentos em análise', responsavelId:'m5', categoria:'Administrativo', prazo:util(-7), recorrencia:{freq:'semanal', intervalo:1},
        descricao:'EXEMPLO DE TAREFA RECORRENTE (toda semana). Entrar no Meu INSS de cada cliente com pedido em análise e anotar exigências ou perícias marcadas.'}, ts(add(hoje,-7),'17:00')),
      T({id:'exop-t3', titulo:'Ligar para João Batista: o INSS já marcou a perícia?', responsavelId:'m5', clienteId:'c3', categoria:'Atendimento', prazo:util(3), recorrencia:{freq:'semanal', intervalo:2},
        origem:{tipo:'cliente', ref:'c3'}, descricao:'EXEMPLO DE TAREFA RECORRENTE (a cada 2 semanas). Acompanhamento até o INSS responder. Quando a perícia for marcada, troque a situação para "Cancelada" para encerrar a série.'}),
      T({id:'exop-t4', titulo:'Conferir os honorários recebidos no mês', responsavelId:'m6', categoria:'Financeiro', prazo:util(5), recorrencia:{freq:'mensal', intervalo:1},
        descricao:'EXEMPLO DE TAREFA RECORRENTE (todo mês). Comparar os recebimentos do Financeiro com os contratos e cobrar quem atrasou.'}),
      T({id:'exop-t6', titulo:'Pedir nova cópia do CNIS à Maria Aparecida', responsavelId:'m5', clienteId:'c4', categoria:'Documentos', prazo:util(2), status:'aguardando_terceiros',
        aguardandoQuem:'Cliente emitir o CNIS no Meu INSS', origem:{tipo:'cliente', ref:'c4'}, criadoEm:ts(add(hoje,-3),'15:00'), criadoPor:'m5', statusDesde:ts(add(hoje,-3),'15:00'),
        descricao:'O CNIS foi rejeitado no checklist (cópia ilegível).'}),
      T({id:'exop-t7', titulo:'Cobrar ITR e notas do produtor da Maria Aparecida', responsavelId:'m5', clienteId:'c4', categoria:'Documentos', prazo:util(-2),
        origem:{tipo:'cliente', ref:'c4'}, criadoEm:ts(add(hoje,-6),'14:10'), criadoPor:'m5', descricao:'Item "Documentos rurais" do checklist está como Solicitado há quase uma semana.'}),
      T({id:'exop-t8', titulo:'Aplicar o checklist e pedir os documentos da Fernanda', responsavelId:'m5', clienteId:'c1', categoria:'Captação', prazo:util(1), origem:{tipo:'cliente', ref:'c1'},
        criadoEm:ts(add(hoje,-1),'16:05'), criadoPor:'m5', descricao:'Na ficha da cliente, bloco Checklist: escolher "Verbas rescisórias (exemplo)" (já vem sugerido), clicar em Aplicar checklist e mandar a lista para ela.'}),
      T({id:'exop-t9', titulo:'Conferir a documentação do José Carlos', responsavelId:'m1', clienteId:'c5', categoria:'Documentos', prazo:hoje, status:'andamento', origem:{tipo:'cliente', ref:'c5'},
        criadoEm:ts(add(hoje,-1),'16:35'), criadoPor:'m5', statusDesde:ts(hoje,'12:00')}),
      T({id:'exop-t10', titulo:'Preparar a petição inicial do José Carlos', responsavelId:'m1', clienteId:'c5', categoria:'Processual', prazo:util(7), dependeDe:['exop-t9'], origem:{tipo:'cliente', ref:'c5'},
        criadoEm:ts(add(hoje,-1),'16:36'), criadoPor:'m5', descricao:'Depende da conferência dos documentos: aparece como "Bloqueada" até a tarefa anterior ser concluída.'}),
    ];
    const tarefa_comentarios = [ex({id:'exop-k1', tarefaId:'exop-t6', texto:'Ela disse que vai à agência do INSS na quinta-feira e manda a foto pelo WhatsApp.', em:ts(add(hoje,-2),'10:20'), por:'m5', criadoEm:ts(add(hoje,-2),'10:20'), criadoPor:'m5'})];
    return {clientes, checklist_modelos, checklist_itens, historico, tarefas, tarefa_comentarios};
  }
  seed.exemplosOperacionais = exemplosOperacionais;
  seed.equipeFixa = EQUIPE_FIXA;
  if (typeof module !== 'undefined') module.exports = seed; else (root.App = root.App || {}).seed = seed;
})(typeof window !== 'undefined' ? window : globalThis);
