/* Dados de exemplo (fictícios). Usados no modo local e para popular a base compartilhada.
   Todos levam exemplo:true para o botão "Remover exemplos". */
(function (root) {
  /* Equipe real do escritório: NÃO leva exemplo:true (não sai com "Remover exemplos").
     O app.js garante que estes membros existam mesmo em dados já salvos (comparando pela OAB). */
  const EQUIPE_FIXA = [
    {id:'lucas-fernando', nome:'Dr. Lucas Fernando Barbosa Gomes', cargo:'Advogado', papel:'admin', oab:'OAB/MG 181.253', email:'', cor:'#1F5C99', genero:'M'},
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
      {id:'m6', nome:'Paula Reis', cargo:'Financeiro', papel:'financeiro', oab:'', email:'paula@exemplo.adv.br', cor:'#0F7C8C', genero:'F'},
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
      C('c1','Fernanda Albuquerque','PF','123.456.789-00','Direito Trabalhista','m3', {status:'encaminhado', aceitoEm:null, urgencia:'alta', criadoEm:add(hoje,-3) + 'T14:20:00.000Z',
        historia:'Trabalhou 4 anos como auxiliar administrativa em um atacadista de Araguari. Dispensada sem justa causa em outubro, sem verbas rescisórias nem multa do FGTS. Relata horas extras habituais sem pagamento.',
        historico:[{em:add(hoje,-3) + 'T14:25:00.000Z', por:'m5', texto:'Encaminhado para Camila Teixeira.'}]}),
      C('c2','Cerealista Grão do Cerrado Ltda. (exemplo)','PJ','88.888.888/0001-88','Cobrança','m1', {status:'novo', encaminhadoPara:[], responsavelId:'', aceitoEm:null, criadoEm:hoje + 'T12:05:00.000Z', origem:'Site / formulário',
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
    return {data:{equipe, clientes, processos, publicacoes, prazos, compromissos, documentos, fin_lancamentos:fin, centros_custo, modelos}, config};
  }
  seed.equipeFixa = EQUIPE_FIXA;
  if (typeof module !== 'undefined') module.exports = seed; else (root.App = root.App || {}).seed = seed;
})(typeof window !== 'undefined' ? window : globalThis);
