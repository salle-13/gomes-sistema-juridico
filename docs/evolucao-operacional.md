# Evolução operacional

Versão: 25/11/2026 · branch `evolucao-operacional`

Este documento registra as decisões das fases 1 e 2 da evolução do protótipo para a gestão operacional do escritório e lista as próximas fases. Tudo é automação tradicional (regras sobre os dados), sem IA generativa, sem APIs de IA e sem serviços pagos.

## Princípios

- **Sem servidor, por enquanto.** As automações rodam no navegador. No modo compartilhado várias abas podem executar a mesma regra, então todo registro criado automaticamente tem **id determinístico**: a segunda aba apenas sobrescreve o mesmo registro.
- **Alertas e gargalos são derivados dos dados.** Eles não são gravados: cada um é recalculado a cada desenho, com chave estável (`gar:<tipo>:<id>:<desde>`). Só se gravam tarefas, itens de checklist e histórico.
- **Nada de listas dentro de registros.** Histórico, comentários e itens de checklist vivem em coleções próprias, um registro por evento. Duas pessoas salvando ao mesmo tempo não se sobrescrevem.
- **Pessoas são referenciadas pela `equipe`** (não por `usuarios`).
- **Migrações idempotentes** que preservam o dado original e só rodam para quem tem permissão de edição.
- **Permissão conferida dentro da ação** (`A.exigir`), não só escondendo o botão.

## Fase 1: fundação das regras

- `js/regras-logic.js` (global `Regras`, `A.R`): funções puras e testáveis em Node (`node --test`).
- `config/operacional`: limites dos gargalos, rótulos e limites das 10 etapas, categorias e pesos de tarefa. Validado por `Regras.normalizar`; editado em Configurações › Limites operacionais.
- **Dias úteis do escritório** (`uteisEscritorio`): contam fins de semana e feriados, mas **não** o recesso forense. O recesso suspende prazos processuais, não o trabalho interno.
- Gargalos (`Regras.avaliarGargalos`): cliente sem primeiro atendimento, cliente parado na etapa, cliente sem responsável, documentação parada em conferência, tarefa atrasada, tarefa atrasada repetidamente, excesso de tarefas por pessoa, reunião sem providência e processo sem providência futura. Entram nas notificações na categoria "Operacional". A exceção é "processo sem providência", que fica só no quadro do Início para não inundar o sino com pastas importadas.
- Coleção `historico` (só inclusão), gravada por `A.save` para campos rastreados e por `A.registrar` para os demais eventos. No banco, ela corresponde às linhas `app:*` da `auditoria` (`registrar_historico()`, `vw_historico`).
- Desempenho: `A.memo` (cache por ciclo de desenho) e `A.idx` (índices por campo).

## Fase 2: captação, tarefas e checklists

### Captação em 10 etapas

1. Novo contato · 2. Primeiro atendimento · 3. Reunião agendada · 4. Reunião realizada · 5. Aguardando documentos · 6. Documentação recebida · 7. Conferência documental · 8. Cadastro e criação da pasta · 9. Preparação para distribuição · 10. Entrega à advogada responsável.

- O escritório **não recusa casos** e **não há aceite da advogada**. Concluir a etapa 10 leva o cliente à carteira (`status: 'ativo'`, `aceitoEm`) e exige o(a) advogado(a) responsável.
- A única saída é **"Arquivar: contato não seguiu"**, com motivo obrigatório. Internamente é `status: 'recusado'`, e a aba "Não aceitos" passou a se chamar "Arquivados". Os registros antigos continuam lá, e é possível reabrir na captação.
- Os campos `etapa` (chaves fixas), `etapaDesde`, `dataEntrada`, `atendimentoResponsavelId`, `tipoDemanda` e `proximaProvidencia` são novos. `encaminhadoPara` e a lista antiga `clientes.historico` continuam gravados, só para leitura.
- **Migração** (ao carregar, idempotente): `novo` vai para a etapa 1. `encaminhado` e `analise` vão para a etapa 2, com o registro "migrado do fluxo antigo, conferir etapa" (id `mig-etapa-<cliente>`). `ativo`, `encerrado` e `recusado` não mudam. O `status` antigo não é reescrito.
- Kanban com 10 colunas e rolagem horizontal. Cada cartão mostra o responsável pelo atendimento, os dias úteis na etapa (em destaque quando passam do limite) e a próxima providência. O cartão se move com "Avançar" e "←", e a ficha também tem a lista de etapas.
- A ficha mostra a trilha das etapas e a linha do tempo, que vem do `historico` do cliente, dos itens de checklist e das tarefas, mais os registros antigos. Também mostra as reuniões (botão "Agendar reunião", que abre o compromisso já preenchido), as tarefas e o checklist.

### Central de tarefas (`#tarefas`)

- Coleção `tarefas` e comentários em `tarefa_comentarios`. Módulo de permissão novo `tarefas`: `editar` para todos os papéis e `ver` no perfil Consulta.
- **Prioridade calculada** (`Regras.prioridadeTarefa`), com pesos em `config/operacional`: vencida, vence hoje, vence em 2 ou em 5 dias úteis, cliente urgente, categoria urgente, processo com prazo próximo e bloqueada. O ajuste manual liga `prioridadeManual`.
- **Dependências**: uma tarefa com dependência aberta aparece como "bloqueada". Dependências circulares são recusadas, e concluir uma tarefa bloqueada pede confirmação.
- **Recorrência** (diária em dias úteis, semanal ou mensal, com intervalo): ao concluir, cria a próxima com id `rec-<serieId>-<prazo>`. Reabrir e concluir de novo não duplica.
- **Migração das "Tarefas internas"** da agenda: cada compromisso vira a tarefa `mig-<id>`. O compromisso não é apagado: ganha `migradoParaTarefa`, continua na agenda e sai das listas de tarefas. Um compromisso "Tarefa interna" criado depois na agenda também é convertido na hora.
- Visões: Minhas, Equipe, Atrasadas, Hoje, Próximos 7 dias, Sem responsável, Aguardando terceiros, Concluídas e Recorrentes. Filtros por responsável, categoria, cliente e processo, mais exportação.

### Checklists de documentos (`#checklists`)

- `checklist_modelos` (nome, área, tipo de demanda, itens obrigatórios ou opcionais): a tela fica disponível para quem edita a Equipe. Há um modelo de exemplo de aposentadoria rural (`exemplo: true`).
- `checklist_itens`: um registro por documento exigido, com situação `pendente`, `solicitado`, `recebido`, `conferencia`, `aprovado`, `rejeitado` ou `substituir`. Toda mudança de situação ou de arquivo (inclusive substituição) vai para o `historico`.
- "Aplicar checklist" sugere o modelo pela área e pelo tipo de demanda. Os ids `chk-<cliente>-<modelo>-<n>` evitam duplicar ao aplicar de novo.
- O item é vinculado a um documento já enviado em Documentos, sem armazenamento novo. Vincular um arquivo a um item pendente, rejeitado ou "substituir" (ou trocar o arquivo de um item aprovado ou em conferência) volta o item para "recebido".
- **Documentação completa** = todos os itens obrigatórios aprovados. O gargalo "documentação parada em conferência" usa essa regra.

## Próximas fases

1. **Automações por evento.** Regras do tipo "quando X, criar tarefa Y" (por exemplo: cliente entrou em "Reunião realizada" → tarefa "Solicitar documentos"; item rejeitado → tarefa "Pedir substituição"). Ids determinísticos por regra e por evento, histórico com `origem: 'automacao'` e um painel para ligar e desligar as regras.
2. **Painel de atenção operacional.** Uma visão única dos gargalos por pessoa, etapa e tipo, com a carga de cada um e atalhos para redistribuir.
3. **Agenda com conflitos.** Aviso de sobreposição de horários por pessoa, de audiência com prazo no mesmo dia e de reunião sem sala.
4. **Dashboard gerencial.** Tempo médio por etapa da captação, conversão (carteira × arquivados), motivos de arquivamento, tarefas concluídas no prazo e evolução da carga da equipe.
5. **Central de regras.** Edição, num só lugar, de limites, pesos, categorias, modelos de checklist e automações, com histórico das mudanças de configuração.

Pendências conhecidas: o DDL das tabelas novas (`tarefas`, `tarefa_comentarios`, `checklist_modelos`, `checklist_itens`, colunas de `clientes`) ainda não foi aplicado num PostgreSQL 16. Anexos de tarefas usam o bloco de documentos do cliente ou do processo vinculado.
