# Especificação da seção Jurídico — Gomes · Sistema Jurídico

Versão: protótipo single-tenant (uma organização) · Atualizado em 16/11/2026

A seção **Jurídico** reúne o trabalho processual do escritório. Ela tem quatro módulos ligados entre si:

| Módulo | Para que serve | Liga-se a |
|---|---|---|
| **Processos** | Cadastro e acompanhamento de cada ação judicial | Cliente, prazos, publicações, documentos, financeiro |
| **Publicações** | Entrada e tratamento das intimações do DJEN | Processo, prazo |
| **Clientes** | Captação de novos casos e carteira de clientes ativos | Processos, prazos, documentos, financeiro |
| **Documentos** | Arquivo central de arquivos do escritório | Cliente, processo |

Fluxo principal: **captação do cliente → aceite → cadastro do processo → chegada da publicação → geração do prazo → cumprimento → lançamentos financeiros do processo**.

Convenções de dados, válidas para todos os módulos:
- Datas no formato `AAAA-MM-DD`; data e hora em ISO 8601.
- Valores em dinheiro em **centavos (inteiro)**.
- Relações sempre por id (`clienteId`, `processoId`…).
- Todo registro recebe automaticamente `criadoEm`, `criadoPor`, `atualizadoEm` e `atualizadoPor`.
- Registros de teste levam `exemplo: true` e podem ser removidos em lote.

---

## 1. Processos

**Objetivo:** manter a carteira de ações do escritório e concentrar, numa ficha única, tudo o que acontece em cada processo.

### Telas
- **Lista de processos:** busca por número, cliente, parte contrária ou vara. Filtros por situação, área e responsável. Mostra prazos em aberto e quantos são urgentes. Exporta em Excel, PDF e CSV.
- **Ficha do processo:**
  - Esquerda: dados do processo e andamentos.
  - Direita: prazos, publicações, financeiro e documentos daquele processo.

### Campos (coleção `processos`)

| Campo | Nome na tela | Tipo | Obrigatório | Regra / descrição |
|---|---|---|---|---|
| `numero` | Nº do processo (CNJ) | texto | Sim | Padrão CNJ `0000000-00.0000.0.00.0000`. Fora do padrão, o sistema avisa mas permite salvar |
| `clienteId` | Cliente | id | Recomendado | Só clientes da carteira (ativos ou encerrados) |
| `parteContraria` | Parte contrária | texto | Não | |
| `polo` | Nosso cliente é | `ativo` \| `passivo` | Sim | Autor/requerente ou réu/requerido |
| `tribunal` | Tribunal | texto | Não | Sugestões: TJMG, TRT3, TRF6, STJ, TST, STF, JEF |
| `comarca` | Comarca | texto | Não | Padrão: Araguari |
| `vara` | Vara / órgão | texto | Não | Ex.: 1ª Vara Cível |
| `classe` | Classe / ação | texto | Não | Ex.: Procedimento comum cível |
| `area` | Área | lista | Não | Assessoria jurídica, Direito Civil, Direito Trabalhista, Direito Previdenciário, Família e Sucessões, Cobrança, Consumidor, LGPD |
| `valorCausa` | Valor da causa (R$) | centavos | Não | |
| `responsavelId` | Responsável | id equipe | Recomendado | |
| `distribuidoEm` | Distribuído em | data | Não | |
| `status` | Situação | `ativo` \| `suspenso` \| `arquivado` \| `encerrado` | Sim | Padrão: ativo |
| `obs` | Observações / estratégia | texto longo | Não | |
| `andamentos` | Andamentos | lista `{data, texto, por}` | Não | Linha do tempo manual, do mais recente para o mais antigo |

### Regras
- **Excluir** um processo não apaga os prazos vinculados; eles continuam na agenda, sem vínculo. Para processos finalizados, o recomendado é mudar a situação para **Encerrado**.
- **"+ Novo prazo neste processo"** abre o cadastro de prazo com número, cliente e responsável já preenchidos.
- **"+ Custa", "+ Despesa" e "+ Honorários"** abrem o lançamento financeiro já vinculado ao processo e ao cliente.
- O bloco financeiro da ficha (custas e despesas, valor a reembolsar pelo cliente, honorários) só aparece para quem pode **ver** o Financeiro.

---

## 2. Publicações

**Objetivo:** garantir que toda intimação seja lida, tratada e, quando houver prazo, transformada em prazo na agenda.

### Telas
- **Lista por situação:** Novas, Lidas, Tratadas, Sem providência e Todas, com contadores. Busca no texto, no processo, no órgão e no cliente. Filtro por responsável. Exportação.
- **Registrar publicação:** colar o texto da intimação.
- **Importar:** arquivo JSON do DJEN ou CSV.

### Campos (coleção `publicacoes`)

| Campo | Nome na tela | Tipo | Obrigatório | Regra / descrição |
|---|---|---|---|---|
| `texto` | Texto da publicação | texto longo | Sim | Ao colar, o número CNJ é detectado automaticamente |
| `disponibilizacao` | Data de disponibilização | data | Sim | Data em que saiu no DJEN |
| `publicacao` | Data da publicação | data | Sim | **Calculada:** 1º dia útil seguinte à disponibilização (pode ajustar) |
| `numeroProcesso` | Nº do processo | texto | Não | Preenchido pela detecção automática |
| `processoId` | Processo cadastrado | id | Não | Vinculado sozinho quando o número já existe em Processos |
| `tribunal` | Tribunal | texto | Não | |
| `orgao` | Órgão / vara | texto | Não | Preenchido a partir do processo, quando vinculado |
| `tipo` | Tipo | texto | Não | Intimação, Despacho, Decisão, Sentença, Acórdão, Edital, Certidão, Pauta |
| `responsavelId` | Responsável | id equipe | Não | Herdado do responsável do processo |
| `oab` | OAB intimada | texto | Não | Ex.: MG123456 |
| `origem` | — | `manual` \| `importacao` | Automático | |
| `status` | Situação | `nova` \| `lida` \| `tratada` \| `descartada` | Automático | Ver fluxo abaixo |
| `prazoId` | — | id | Automático | Prazo gerado a partir da publicação |
| `tratadaEm` / `tratadaPor` | — | data e hora / id | Automático | Quem tratou e quando |

### Fluxo de situação
```
Nova ──► Lida ──► Tratada (prazo gerado)
  │        │
  └────────┴────► Sem providência (descartada)
```
- **Gerar prazo:** abre o cadastro de prazo com processo, data de publicação, responsável e o início do texto como providência. Ao salvar o prazo, a publicação vira **Tratada** e fica ligada a ele.
- **Importação:** ignora publicações repetidas (mesmo processo, mesma data e mesmo início de texto) e vincula ao processo pelo número.
- **Limite desta fase:** não há captura automática do DJEN. O registro é manual ou por importação. A captura automática fica para o servidor do sistema definitivo.

---

## 3. Clientes

**Objetivo:** organizar a entrada de novos casos (captação) e manter a carteira de clientes atendidos.

### Telas (abas)
- **Captação:** quadro com Novos cadastros, Encaminhados, Em análise e Aceitos dos últimos 7 dias.
- **Carteira de clientes:** tabela de clientes ativos ou encerrados, com processos, prazos abertos e valor a receber. Exporta.
- **Não aceitos:** arquivo dos casos recusados, com o motivo.
- **Ficha do cliente:** dados e história do caso; encaminhamento e decisão; processos, prazos e financeiro (para clientes da carteira); documentos e histórico.

### Campos (coleção `clientes`)

| Campo | Nome na tela | Tipo | Obrigatório | Regra / descrição |
|---|---|---|---|---|
| `nome` | Nome / razão social | texto | Sim | |
| `tipoPessoa` | Pessoa | `PF` \| `PJ` | Sim | |
| `documento` | CPF / CNPJ | texto | Não | |
| `telefone` | Telefone / WhatsApp | texto | Não | |
| `email` | E-mail | texto | Não | |
| `endereco` | Endereço | texto | Não | |
| `area` | Área | lista | Não | Mesma lista de Processos |
| `origem` | Como chegou | texto | Não | Indicação, site, Instagram, WhatsApp, telefone, presencial, parceiro |
| `urgencia` | Urgência | `normal` \| `alta` | Sim | Alta = prazo correndo ou audiência próxima |
| `historia` | História do caso | texto longo | Recomendado | Fatos, datas, outra parte, provas, o que o cliente quer |
| `responsavelId` | Advogado(a) responsável | id equipe | Não | Definido no aceite, se estiver vazio |
| `encaminhadoPara` | Encaminhar para | lista de ids | Para encaminhar | Só aparecem advogados e administradores |
| `status` | Situação | ver fluxo | Automático | |
| `cadastradoPor` | Cadastrado por | id equipe | Automático | |
| `aceitoEm` | — | data e hora | Automático | Marca a entrada na carteira |
| `historico` | Histórico | lista `{em, por, texto}` | Automático | Cadastro, encaminhamento, análise, aceite, anexos e anotações |

### Fluxo de situação
```
Novo cadastro ──► Encaminhado ──► Em análise ──► Cliente ativo ──► Encerrado
                        │              │               ▲              │
                        └──────────────┴──► Não aceito └── Reativar ──┘
```
- **Encaminhar** exige ao menos uma advogada marcada.
- **Não aceitar** exige o motivo escrito no campo de anotação.
- **Aceitar caso:** o cliente sai do funil e entra na carteira, e o responsável é definido.
- **Casos aguardando análise** aparecem na faixa de alertas e no contador do menu, para a advogada que recebeu o caso.
- **Excluir** o cadastro não apaga os processos, prazos, documentos e lançamentos do cliente; eles ficam sem vínculo.

---

## 4. Documentos

**Objetivo:** guardar os arquivos do escritório num lugar só, vinculados ao cliente e ao processo.

### Telas
- **Arquivo central:** envio com destino (cliente e/ou processo, ou "documento geral do escritório"). Busca, filtros por tipo, cliente e processo. Exportação da lista.
- **Bloco de documentos** dentro das fichas de cliente e de processo, com envio direto.

### Campos (coleção `documentos`)

| Campo | Nome na tela | Tipo | Regra / descrição |
|---|---|---|---|
| `nome` | Arquivo | texto | Nome original do arquivo |
| `categoria` | Tipo de documento | lista | Documento pessoal, comprovante de residência, contrato, procuração, provas, documentos trabalhistas, laudo/atestado, petição/peça, decisão/sentença, guia de custas, nota fiscal/recibo, modelo do escritório, outros |
| `clienteId` | Cliente | id | Opcional |
| `processoId` | Processo | id | Opcional. Ao escolher só o processo, o cliente é herdado dele |
| `assetId` | — | id do arquivo | Referência ao arquivo armazenado |
| `contentType` / `sizeBytes` | — | texto / número | Tipo e tamanho |
| `enviadoPor` / `enviadoEm` | Enviado por / em | id / data e hora | Automático |

### Regras
- **Formatos aceitos:** PDF, imagens (JPG, PNG, WEBP, GIF), TXT, CSV e MP4, até **20 MB** por arquivo. Arquivos do Word precisam ser salvos em PDF.
- **Anexar a um cliente** registra o envio no histórico dele. Num cadastro de cliente novo, anexar salva o cadastro antes.
- **Excluir** pede um segundo clique de confirmação e apaga o arquivo de vez.

---

## 5. Permissões padrão da seção Jurídico

| Módulo | Administrador | Advogado | Assistente | Estagiário | Financeiro |
|---|---|---|---|---|---|
| Processos | Editar | Editar | Ver | Ver | Ver |
| Publicações | Editar | Editar | Editar | Ver | Nenhum |
| Clientes e captação | Editar | Editar | Editar | Ver | Ver |
| Documentos | Editar | Editar | Editar | Editar | Ver |

A matriz pode ser alterada em **Equipe e permissões → Permissões por papel**. O dono do sistema sempre tem acesso total. Nesta fase, as permissões valem na interface; no sistema definitivo, também serão aplicadas no banco de dados.

## 6. Preparação para o sistema definitivo

- Cada módulo corresponde a uma coleção, com os campos acima. Isso vira diretamente as tabelas do banco relacional.
- A migração para multiempresa exige apenas acrescentar o identificador da organização em cada registro. Nenhum campo desta especificação muda.
- Pendências para a próxima fase:
  - captura automática de publicações (servidor consultando o DJEN por OAB);
  - permissões aplicadas no banco;
  - armazenamento de arquivos próprio, com backup e registro de acessos (LGPD).
