# Integrações externas e entrada manual de dados — Gomes · Sistema Jurídico

Versão: 16/11/2026 · Referência: `especificacao/juridico.md` · Escopo: uma organização (single-tenant)

## Legenda

| Marca | Significado |
|---|---|
| **[FUNCIONAL]** | Já funciona no protótipo, sem depender de nada externo |
| **[MANUAL]** | Funciona no protótipo, mas o dado precisa ser digitado, colado ou importado por alguém da equipe |
| **[INTEGRAÇÃO]** | Só fica automático com uma integração externa (servidor próprio do sistema definitivo) |
| **[MANUAL POR DECISÃO]** | Fica manual de propósito nesta fase (ex.: financeiro sem banco) |

Ponto importante: o protótipo roda no navegador e **não consegue chamar sites externos** (DJEN, tribunais, CNJ). Toda integração abaixo exige um **servidor do sistema** (coletor agendado) que consulte as fontes e grave no banco.

---

## 1. Inventário: o que depende de entrada manual hoje

### 1.1 Processos

| Funcionalidade | Situação hoje | O que é manual | Integração que automatiza |
|---|---|---|---|
| Lista, filtros, ficha, exportação | **[FUNCIONAL]** | — | — |
| Cadastro do processo (número, classe, vara, órgão, distribuição, partes) | **[MANUAL]** | Todos os campos digitados | **DataJud** (classe, assuntos, órgão, data de ajuizamento, grau, sistema) a partir do número CNJ. Partes e advogados **não** vêm do DataJud |
| Validação do número CNJ | **[FUNCIONAL]** (só formato) | Dígito verificador não é conferido | Nenhuma: cálculo local do dígito (módulo 97) |
| Andamentos (linha do tempo) | **[MANUAL]** | Digitação de cada andamento | **DataJud** (movimentos) e, para tempo real, **consulta ao tribunal** (eproc/PJe) ou fornecedor |
| Vínculo com prazos, publicações, financeiro, documentos | **[FUNCIONAL]** | — | — |
| Descoberta de processos novos contra clientes (CPF/CNPJ) | Não existe | — | **Fornecedor privado** (não há fonte oficial gratuita por CPF/CNPJ) |

### 1.2 Publicações

| Funcionalidade | Situação hoje | O que é manual | Integração que automatiza |
|---|---|---|---|
| Registro colando o texto | **[MANUAL]** | Alguém copia do DJEN e cola | **DJEN (API de comunicações)** por OAB |
| Detecção do nº CNJ, vínculo ao processo, data de publicação, responsável | **[FUNCIONAL]** | — | — |
| Importação de JSON do DJEN / CSV | **[MANUAL]** | Baixar o arquivo e importar | **DJEN** (o mesmo formato já é aceito, então a automação reaproveita o importador) |
| Fluxo Nova → Lida → Tratada / Sem providência, gerar prazo | **[FUNCIONAL]** | — | — |
| Intimações pessoais e citações (empresas) | Não existe | — | **Domicílio Judicial Eletrônico** (só para o próprio destinatário) |
| Intimações feitas só dentro do sistema do tribunal | Não existe | — | **Consulta autenticada ao tribunal** ou fornecedor com robô (credencial do advogado) |

### 1.3 Agenda e prazos (apoio à seção Jurídico)

| Funcionalidade | Situação hoje | O que é manual | Integração que automatiza |
|---|---|---|---|
| Cálculo de vencimento (dias úteis, feriados nacionais, recesso) | **[FUNCIONAL]** | — | — |
| Feriados locais e suspensões de expediente | **[MANUAL]** | Cadastro em Configurações | Sem API oficial. Fonte: portarias do TJMG e lista de feriados locais do TRT3. Continua manual, com revisão periódica |
| Alertas em tela | **[FUNCIONAL]** | — | — |
| Prazo a partir de publicação | **[FUNCIONAL]** (após a publicação entrar) | Tipo e quantidade de dias escolhidos pela pessoa | Sugestão por IA a partir do texto (opcional, sempre revisada) |

### 1.4 Clientes

| Funcionalidade | Situação hoje | O que é manual | Integração que automatiza |
|---|---|---|---|
| Captação, encaminhamento, aceite, carteira | **[FUNCIONAL]** | — | — |
| Dados cadastrais (nome, CNPJ, endereço) | **[MANUAL]** | Digitação | **Consulta de CNPJ** (dados abertos da Receita) para preencher razão social e endereço. CPF não tem consulta pública |
| História do caso | **[MANUAL]** (por natureza) | — | — |

### 1.5 Documentos

| Funcionalidade | Situação hoje | O que é manual | Integração que automatiza |
|---|---|---|---|
| Envio, categorias, vínculos, busca | **[FUNCIONAL]** (no modo compartilhado) | Envio dos arquivos | — |
| Cópia dos autos / decisões do tribunal | Não existe | Baixar no tribunal e enviar | Consulta autenticada ao tribunal ou fornecedor (documentos dos autos) |
| Arquivos do Word (.docx) | **[MANUAL]** | Converter para PDF | Armazenamento próprio no sistema definitivo |

### 1.6 Financeiro

Tudo **[MANUAL POR DECISÃO]**: lançamentos e baixas manuais, sem boleto, PIX, banco, ERP ou conciliação. Não há integração prevista nesta fase.

---

## 2. Integrações necessárias

Ordem de prioridade: **1 DJEN** → **2 DataJud** → **3 Tribunais (consulta processual)** → **4 Fornecedor privado (lacunas)** → integrações auxiliares.

### 2.1 DJEN — Diário de Justiça Eletrônico Nacional (publicações)

| Item | Detalhe |
|---|---|
| **Fonte oficial** | CNJ — Plataforma de Comunicações Processuais (DJEN). Desde 16/05/2025 é a base oficial de contagem dos prazos das intimações não pessoais (Res. CNJ 455/2022, alterada pela 569/2024) |
| **API / mecanismo** | `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao`, pública, sem autenticação. Filtros: `numeroOab`, `ufOab`, `numeroProcesso`, `siglaTribunal`, `dataDisponibilizacaoInicio`, `dataDisponibilizacaoFim`, `pagina`, `itensPorPagina`. Swagger: `comunicaapi.pje.jus.br/swagger/index.html` |
| **Formato** | JSON paginado (`count` + `items`). Cada item: data de disponibilização, tribunal, órgão, número do processo (com máscara), tipo de comunicação, tipo de documento, texto integral, destinatários e advogados, link |
| **Frequência recomendada** | Em dias úteis: 3 consultas por OAB (ex.: 7h, 12h e 18h), com janela dos últimos 3 dias para pegar atrasos. Reconciliação diária de D-1. Fora de dias úteis: 1 vez |
| **Complexidade** | **Baixa a média.** Coletor agendado, paginação, controle de limite (HTTP 429), deduplicação (o importador do protótipo já faz) e vínculo automático por número CNJ (já existe) |
| **Restrições** | Limite por IP (cabeçalhos `x-ratelimit-*`, aguardar 1 min após 429). `itensPorPagina` só aceita 5 ou 100, com no máximo 10.000 resultados por pesquisa. **Não usar vários IPs** para contornar o limite (uso abusivo). A API de consulta não tem contrato de serviço: pode mudar sem aviso, então o coletor precisa de alerta de falha. **Não cobre:** intimações pessoais (Domicílio), intimações feitas só no sistema do tribunal e, na prática, o STF (uso do DJEN facultativo para ele). A contagem oficial continua sendo a do DJEN e do tribunal |
| **Custo estimado** | API **gratuita**. Custo = servidor do coletor (o mesmo de todo o sistema) + desenvolvimento estimado em 1 a 2 semanas de um desenvolvedor |

### 2.2 DataJud — API Pública do CNJ (dados e andamentos por número de processo)

| Item | Detalhe |
|---|---|
| **Fonte oficial** | CNJ — Base Nacional de Dados do Poder Judiciário (Res. CNJ 331/2020; Portaria 160/2020, alterada pela Portaria 374/2026, que exige envio **diário** pelos tribunais) |
| **API / mecanismo** | `POST https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search` (ex.: `api_publica_tjmg`, `api_publica_trt3`, `api_publica_trf6`, `api_publica_stj`). Consulta no padrão Elasticsearch. Autenticação: `Authorization: APIKey <chave pública>` publicada na wiki do DataJud |
| **Formato** | JSON (`hits`). Por processo: número, tribunal, grau, classe, assuntos, órgão julgador, data de ajuizamento, sistema, formato, nível de sigilo e **movimentos** (código TPU, nome, data e hora, complementos) |
| **Frequência recomendada** | 1 vez por dia para cada processo ativo (madrugada). Consulta imediata ao cadastrar um processo novo, para preencher a ficha |
| **Complexidade** | **Baixa.** Mapear o número CNJ → índice do tribunal (pelos dígitos J.TR), converter movimentos em andamentos e evitar duplicados |
| **Restrições** | Só **metadados de processos públicos**: sem partes, advogados ou documentos, e **sem busca por OAB ou CPF/CNPJ**. Termo de uso: máximo de 120 requisições por minuto e proibição de coletar dados pessoais de terceiros sem consentimento. Atualização pode atrasar dias em relação ao tribunal, então **não serve para prazo**, só para histórico e conferência. Processos em segredo de justiça não aparecem |
| **Custo estimado** | **Gratuito.** Desenvolvimento estimado em 1 semana |

### 2.3 Tribunais estaduais — TJMG (consulta processual direta)

| Item | Detalhe |
|---|---|
| **Fonte oficial** | Sistemas do TJMG. **Atenção:** o TJMG adotou o **eproc** como sistema único no cível de 1º e 2º graus, com o acervo do PJe em migração (meta de 100% até 23/04/2027). Na transição, um processo pode estar no PJe ou no eproc |
| **API / mecanismo** | (a) **Consulta pública web** do eproc e do PJe (por número, parte ou advogado), sem API documentada, o que exige raspagem de página. (b) **MNI** (Modelo Nacional de Interoperabilidade, SOAP), `consultarProcesso`, quando o tribunal oferece acesso externo. Exige credencial ou certificado e, em alguns tribunais, liberação de IP. Disponibilidade no eproc do TJMG precisa ser confirmada com a Diretoria de Informática do TJMG. (c) **Jus.br / consulta processual unificada**: feita para pessoas, com login gov.br ou certificado e MFA, sem API para sistemas terceiros |
| **Formato** | (a) HTML. (b) XML/SOAP (capa, partes, movimentos, documentos conforme sigilo) |
| **Frequência recomendada** | 1 vez por dia por processo ativo, só para o que o DataJud não cobre bem (andamentos recentes, partes). Nunca em massa |
| **Complexidade** | **Alta.** Cada sistema tem tela própria. Há CAPTCHA, MFA obrigatório para usuários externos do PJe e do Jus.br, mudanças de tela e a migração PJe→eproc no meio do caminho. Manutenção contínua |
| **Restrições** | Termos de uso dos portais. Proibição de contornar CAPTCHA ou controle de acesso. Segredo de justiça só com credencial do advogado constituído. **Abrir intimação dentro do sistema pode contar como ciência e iniciar o prazo**: robôs só podem ler, nunca abrir. Portaria CNJ 316/2024 trata como abusivo o comportamento automatizado que imita humano e a consulta sistemática a processos sem relação com o usuário. Guarda de certificado ou senha do advogado exige cofre de credenciais |
| **Custo estimado** | Acesso gratuito, mas desenvolvimento alto (4 a 8 semanas para TJMG cobrindo eproc e PJe) e manutenção mensal. **Alternativa recomendada:** fornecedor privado (item 2.6) |

### 2.4 Justiça do Trabalho — TRT3 (MG) e TST

| Item | Detalhe |
|---|---|
| **Fonte oficial** | PJe-JT do TRT3 e do TST. Intimações em DJEN (TRTs usam DJEN desde agosto de 2024). Matérias administrativas e pautas ainda saem no DEJT |
| **API / mecanismo** | Publicações: **DJEN** (item 2.1). Andamentos: **DataJud** (`api_publica_trt3`, `api_publica_tst`). Consulta direta: consulta pública do PJe-JT e MNI quando liberado |
| **Formato** | JSON (DJEN e DataJud); HTML/XML (consulta direta) |
| **Frequência recomendada** | Mesma do DJEN e do DataJud. DEJT 1 vez por dia, se houver interesse em pautas |
| **Complexidade** | **Baixa** com DJEN + DataJud; **alta** para consulta direta |
| **Restrições** | As mesmas dos itens 2.1 a 2.3. DEJT não tem API documentada |
| **Custo estimado** | Gratuito (DJEN/DataJud). Consulta direta: ver item 2.3 |

### 2.5 Tribunais federais e superiores — TRF6, JEF, STJ, STF

| Item | Detalhe |
|---|---|
| **Fonte oficial** | TRF6 (Justiça Federal em MG) e JEFs; STJ; STF |
| **API / mecanismo** | **TRF6/JEF e STJ:** publicações via **DJEN** e andamentos via **DataJud** (`api_publica_trf6`, `api_publica_stj`). **STF:** o uso do DJEN é facultativo para o STF, então as publicações precisam ser acompanhadas pelo DJe e pelo portal do STF. Não há API pública documentada para isso: usar fornecedor ou acompanhamento manual |
| **Formato** | JSON (DJEN/DataJud); HTML (portal do STF) |
| **Frequência recomendada** | Igual ao DJEN e ao DataJud; STF 1 vez por dia para os processos que estiverem lá |
| **Complexidade** | **Baixa** (TRF6/STJ via DJEN + DataJud); **média a alta** (STF direto) |
| **Restrições** | As mesmas dos itens 2.1 e 2.2. Processos do STF são poucos para um escritório deste porte, então acompanhamento manual é aceitável |
| **Custo estimado** | Gratuito; STF via fornecedor, se necessário |

### 2.6 Fornecedor privado de dados jurídicos (cobertura das lacunas)

| Item | Detalhe |
|---|---|
| **Fonte** | Empresas que agregam DJEN, diários e tribunais (ex.: Judit, Escavador; também Codilo, Infosimples, entre outras). Não é fonte oficial: os dados vêm das fontes oficiais, tratados pelo fornecedor |
| **API / mecanismo** | REST com chave de API e **webhooks** (aviso automático de novidade). Busca por número CNJ, CPF, CNPJ, OAB e nome; monitoramento de processos, de novas ações e do DJEN |
| **Formato** | JSON padronizado do fornecedor |
| **Frequência recomendada** | Webhook (em tempo real) + 1 conferência diária |
| **Complexidade** | **Baixa a média** (um adaptador por fornecedor, recebendo webhooks) |
| **Restrições** | Contrato e DPA (LGPD). Conferir se o contrato permite o uso pretendido e o armazenamento dos dados. Cobertura e prazo de entrega variam por tribunal: exigir lista e SLA. Dados de CPF/CNPJ de terceiros exigem base legal (LGPD). Não substitui a contagem oficial do DJEN |
| **Custo estimado** | Por consumo. Referência pública da Judit (nov/2026): consulta em tempo real por número CNJ a partir de R$ 0,25 por transação; planos da plataforma de R$ 500/mês (R$ 4,00 por monitoramento de processo) e R$ 1.000/mês (R$ 3,50); monitoramento de novas ações a partir de R$ 6,00 a R$ 7,00 por termo. Escavador e outros: preço de API sob consulta. **Uso recomendado:** só para o que não tem fonte gratuita (novas ações por CPF/CNPJ dos clientes, STF, cópia de autos) |

### 2.7 Domicílio Judicial Eletrônico (citações e intimações pessoais de empresas)

| Item | Detalhe |
|---|---|
| **Fonte oficial** | CNJ / PDPJ-Br — Domicílio Judicial Eletrônico |
| **API / mecanismo** | API REST para instituições (CNPJ), com credenciais geradas no próprio Domicílio. Lista e consulta as comunicações do destinatário |
| **Formato** | JSON |
| **Frequência recomendada** | A cada 1 a 2 horas em dias úteis (citações têm prazo de ciência curto) |
| **Complexidade** | **Média** (credenciais por empresa, renovação, cuidado com a ciência) |
| **Restrições** | Só acessa as comunicações **do próprio CNPJ** que gerou a credencial. Serve para o escritório (se a sociedade receber comunicações) ou para clientes empresa que **autorizem formalmente** e forneçam acesso. Ler pela API pode registrar ciência: definir regra com as advogadas |
| **Custo estimado** | Gratuito; desenvolvimento estimado em 1 a 2 semanas |

### 2.8 PDPJ-Br — API de dados judiciais públicos do CNJ (datalake)

| Item | Detalhe |
|---|---|
| **Fonte oficial** | CNJ — repositório centralizado de dados judiciais (Portaria Presidência CNJ nº 316/2024) |
| **API / mecanismo** | API concedida por instrumento formal, mediante pedido à Presidência do CNJ |
| **Formato** | API (formato definido no acesso). Inclui partes, advogados, decisões e movimentos de processos públicos, além de uma lista diária de processos movimentados no dia anterior |
| **Frequência recomendada** | Não se aplica nesta fase |
| **Complexidade** | **Muito alta** (exigências de infraestrutura e certificação) |
| **Restrições** | Exige, entre outros: alta disponibilidade (> 95%), auditoria de acessos e capacidade de controlar acesso de **200 mil usuários únicos por mês**. Os produtos derivados devem ser gratuitos para magistrados e servidores. O consumo é pago via integrador de nuvem |
| **Custo estimado** | Alto. **Inviável para um único escritório**; registrado apenas como referência |

### 2.9 Integrações auxiliares

| Integração | Fonte | Mecanismo | Formato | Frequência | Complexidade | Restrições | Custo |
|---|---|---|---|---|---|---|---|
| **Dados de CNPJ** (cadastro de clientes empresa) | Receita Federal (dados abertos do CNPJ) | Arquivos abertos ou APIs gratuitas que os republicam | JSON / CSV | No cadastro do cliente | Baixa | Dados públicos da empresa; não há consulta pública de CPF | Gratuito |
| **Tabelas Processuais Unificadas (classes, assuntos, movimentos)** | CNJ / PDPJ-Br (serviço de TPU) | API REST (Swagger no portal de documentação da PDPJ) | JSON | Mensal | Baixa | Padronizar classe e assunto no cadastro | Gratuito |
| **Feriados locais e suspensões** | Portarias do TJMG; lista anual de feriados locais do TRT3 | Sem API: leitura dos atos publicados | PDF / HTML | Revisão mensal + quando houver suspensão | Baixa (manual) | Cada tribunal publica os próprios atos | Gratuito |
| **Diário Oficial da União** (opcional) | Imprensa Nacional — INLABS | Download de edições XML/PDF com cadastro | XML | Diária | Baixa | Só se o escritório acompanhar atos federais | Gratuito |

---

## 3. Resumo de situação

| Área | Já funcional no protótipo | Manual hoje | Depende de integração |
|---|---|---|---|
| Publicações | Tratamento, vínculo, geração de prazo, importação de JSON do DJEN | Entrada das publicações | **DJEN** (essencial), Domicílio (empresas), tribunal (intimação em sistema) |
| Processos | Ficha, vínculos, exportação | Cadastro e andamentos | **DataJud** (dados e andamentos), tribunal / fornecedor (tempo real, partes) |
| Prazos | Cálculo, alertas, agenda | Feriados locais | Nenhuma obrigatória |
| Clientes | Captação, carteira, histórico | Cadastro | Consulta de CNPJ (opcional); fornecedor para novas ações por CPF/CNPJ |
| Documentos | Envio e organização | Envio | Tribunal / fornecedor (autos) |
| Financeiro | Tudo | Tudo, por decisão | Nenhuma nesta fase |

## 4. Custo estimado do pacote recomendado (escritório único)

Premissas: até 6 OABs monitoradas e cerca de 300 processos ativos. Estimativas de esforço e de infraestrutura são aproximadas; preços de fornecedor seguem a tabela pública citada no item 2.6.

| Item | Custo mensal estimado | Esforço de implantação |
|---|---|---|
| Servidor do sistema + coletor agendado (VPS ou nuvem pequena) | R$ 80 a R$ 250 | Incluído no backend |
| DJEN (publicações por OAB) | Gratuito | 1 a 2 semanas |
| DataJud (dados e andamentos) | Gratuito | 1 semana |
| Domicílio Judicial (se aplicável) | Gratuito | 1 a 2 semanas |
| Fornecedor privado só para lacunas (novas ações por CPF/CNPJ, STF) | A partir de ~R$ 500 (plano de entrada da Judit) ou por consumo | 1 semana por fornecedor |
| Consulta direta ao TJMG (eproc/PJe), se ainda assim for necessária | Gratuito em acesso, alto em manutenção | 4 a 8 semanas + manutenção |

**Recomendação:** DJEN + DataJud cobrem, de graça, as intimações e os andamentos da grande maioria dos processos. Um fornecedor privado entra só para o que não tem fonte gratuita. A raspagem direta dos portais do TJMG deve ser evitada enquanto durar a migração PJe → eproc.

## 5. Ajustes sugeridos no modelo de dados

- `processos.sistema`: `eproc` | `pje` | `pje-jt` | `outro` (a migração do TJMG torna isso necessário; o DataJud informa o sistema).
- `processos.assuntos` e `processos.codigoClasse`: códigos da TPU vindos do DataJud.
- `processos.ultimaSincronizacao` e `processos.origemDados` (`manual` | `datajud` | `fornecedor`).
- `publicacoes.idExterno` (identificador da comunicação no DJEN) e `publicacoes.hash`, para deduplicação.
- Coleção `integracoes_log`: data, fonte, quantidade obtida, erros. Serve para provar quando uma publicação foi capturada e detectar falhas.
