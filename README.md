# Gomes · Sistema Jurídico

Sistema de gestão jurídica da Gomes Assessoria Jurídica (Araguari/MG · Uberlândia/MG): agenda e prazos, processos, publicações do DJEN, clientes (captação e carteira), documentos, modelos de documentos (procuração, contrato, declaração), equipe e permissões, financeiro e relatórios.

> **Fase atual:** protótipo funcional, para uma única organização (single-tenant), com dados de exemplo fictícios. O sistema definitivo terá backend próprio (PostgreSQL + coletor DJEN), já especificado em `docs/`.

## Estrutura

```
prototipo/            Protótipo navegável (HTML + CSS + JavaScript puro, sem build)
  index.html          Página principal: carrega os scripts na ordem certa
  css/app.css         Estilos (paleta do site da Gomes: marinho #273884)
  logo.png
  js/
    prazo-logic.js    Cálculo de prazos: dias úteis, feriados, recesso (CPC 219, 220, 224)
    schema.js         Esquema de dados (referência para o backend)
    seed.js           Dados de exemplo (fictícios)
    core.js           Núcleo: estado, camada de dados, permissões, interface comum
    export.js         Exportação Excel/PDF/CSV e gráficos SVG
    m-agenda.js       Agenda única (Ano/Mês/Semana/Dia/Lista): prazos, compromissos, alertas
    m-processos.js    Processos e ficha do processo
    m-publicacoes.js  Publicações: registro, importação, tratamento
    m-clientes.js     Captação, carteira, ficha do cliente
    m-documentos.js   Documentos
    m-modelos.js      Modelos com campos {{...}}, gerador de documentos e kit de entrada (fichas de cliente e processo)
    m-equipe.js       Equipe, permissões, configurações
    m-financeiro.js   Contas a pagar/receber, custas, centros de custo
    m-fin-painel.js   Dashboard financeiro e fluxo de caixa
    m-relatorios.js   Relatórios
    app.js            Inicialização, navegação, eventos (carregado por último)
banco/
  modelo-fisico.sql   DDL completo PostgreSQL 16 (28 tabelas; modelos_documento ainda sem validação)
docs/
  juridico.md         Especificação da seção Jurídico
  integracoes.md      Entrada manual x integrações externas (DJEN, DataJud, tribunais)
  coletor-djen.md     Arquitetura do coletor DJEN e geração automática de prazos
  modelo-fisico.md    Explicação do modelo de banco e mapeamento protótipo → banco
```

## Como rodar o protótipo

Não precisa instalar nada. Na pasta `prototipo/`, suba um servidor local:

```bash
cd prototipo
python3 -m http.server 8000
# abra http://localhost:8000
```

Fora da plataforma Claude, o protótipo roda em **modo local**: os dados ficam no `localStorage` do navegador, começando com os dados de exemplo. O envio de arquivos (Documentos) só funciona na versão publicada no Claude. Isso vale também para o botão "Salvar em Documentos" do gerador de modelos. Imprimir / salvar como PDF funciona nos dois modos, inclusive no "Kit de entrada" da ficha do cliente (procuração, contrato e declaração numa única impressão).

Para zerar os dados locais, abra o console do navegador e rode `localStorage.removeItem('gomes-sistema-v2')`.

## Como subir o banco

```bash
createdb gomes
psql -d gomes -v ON_ERROR_STOP=1 -f banco/modelo-fisico.sql
```

Requer PostgreSQL 16 com as extensões `pgcrypto`, `unaccent` e `pg_trgm` (vêm no pacote `postgresql-contrib`).

## Convenções

- Datas `AAAA-MM-DD`; instantes em ISO 8601.
- Dinheiro sempre em **centavos (inteiro)**.
- Toda leitura e gravação do protótipo passa por `App.save` / `App.remove` em `js/core.js`. Ao trocar o armazenamento pela API do backend, só essa camada muda.
- Cada módulo registra suas telas com `App.route(...)` e suas ações com `App.on(...)`.

## Próximos passos (ver `docs/`)

1. Backend com PostgreSQL usando `banco/modelo-fisico.sql`.
2. Coletor DJEN (`docs/coletor-djen.md`), começando pela fase 0: script que gera o JSON para o botão **Importar** do protótipo.
3. Integração DataJud para preencher processos e andamentos.
4. Autenticação individual e permissões aplicadas no banco.

## Aviso

Os dados de exemplo são fictícios. O cálculo de prazos é um apoio: a data oficial é sempre a do DJEN e do sistema do tribunal.
