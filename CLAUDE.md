# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Responda sempre em português do Brasil. Textos da interface também em português.**

## Project

Legal-practice management system for Gomes Assessoria Jurídica (Araguari/MG; a single office). It covers agenda/deadlines (prazos), processes, DJEN publications, clients (intake and portfolio), documents, team/permissions, finance and reports. The UI, code identifiers and docs are in **Portuguese (pt-BR)**, so keep new code and text in Portuguese.

Current phase: a single-tenant **prototype** with fictitious sample data. The future backend (PostgreSQL + DJEN collector) is specified in `docs/` and `banco/`, but none of it is implemented yet.

## Commands

There is no build, package manager, linter or test suite.

- Run the prototype: `cd prototipo && python -m http.server 8000`, then open http://localhost:8000. A server is needed (not `file://`).
- Reset local data: in the browser console, run `localStorage.removeItem('gomes-sistema-v2')`. It reseeds from `seed.js` on reload. `gomes-eu` holds the logged-in member in local mode (sessionStorage, or localStorage when "Manter conectado" is checked); remove it from both to see the login screen again.
- Deadline logic runs in Node (it ends with `module.exports = Prazo`):
  `node -e "const P=require('./prototipo/js/prazo-logic.js'); console.log(P.vencimento('2026-03-02', 15, 'uteis'))"`
- Database: `createdb gomes && psql -d gomes -v ON_ERROR_STOP=1 -f banco/modelo-fisico.sql`. This needs PostgreSQL 16 with `pgcrypto`, `unaccent` and `pg_trgm`.

## Prototype architecture (`prototipo/`)

**Script order matters.** `index.html` loads plain `<script>` tags with no modules, in this order: `prazo-logic.js` → `schema.js` → `seed.js` → `core.js` → `export.js` → `m-*.js` (`m-inicio.js` before `m-inicio-widgets.js`) → `login.js` → `app.js` (last). Every file is an IIFE that adds to the global `window.App` (aliased `A`). `prazo-logic.js` defines the global `Prazo`, available as `A.P`.

**core.js** is the shared kernel:
- State lives in `A.S`. `S.data[col]` holds arrays for the collections in `A.COLS`, alongside `S.config`, `S.permissoes`, `S.mode` and `S.ui` (per-module filter state via `A.ui(mod, defaults)`).
- Data layer: **all writes go through `A.save(col, obj)` / `A.remove(col, id)` / `A.saveDoc('config/geral'|'config/permissoes', obj)`.** These stamp `criadoEm/criadoPor/atualizadoEm/atualizadoPor`. Swapping storage for a real API should only touch this layer (`A.Store`). `Store.path()` is the hook for future multi-tenancy.
- Registries: modules call `A.route(id, {label, mod, render, lado?, depois?, badge?, teclas?, clique?})` and `A.on(actionName, fn)`. `teclas(e)` receives document keydowns while the route is open (return `true` if handled); `clique(e)` runs before click dispatch (e.g. to close a route's own menu on an outside click). `A.render()` is rAF-debounced and re-renders the whole `#main` from scratch, so views are pure functions that return HTML strings.
- Shared helpers include `A.esc` (always escape interpolated values), form builders (`A.inp/sel/area/field`, `A.v(id)` to read values), `A.modal/closeModal/confirm/toast`, and money/date formatters.

**app.js** handles boot, navigation and event delegation:
- Hash routing (`#inicio`, `#agenda`, `#processos`, `#fin-pagar`, …). `#inicio` (the dashboard) is the default route. Old hashes `#ano`, `#mes` and `#prazos` are aliases (`A.aliases`) that open the Agenda in the matching view. The sidebar groups live in `GRUPOS`, so a new route must be added there to appear in the nav.
- One delegated listener per event type: `data-action="x"` on click → `A.actions.x(el, e)`, `data-onchange="x"` on change, and `data-ui="mod.key"` writes straight into `A.ui(mod)[key]` and re-renders. Wire UI through these attributes rather than adding listeners.
- **Two storage modes.** If `window.claude.use('db')` exists (published as a Claude artifact), the app uses a shared realtime DB with `onSnapshot` per collection, and `S.mode` is `db`/`slow`/`erro`. Otherwise it runs in `local` mode on `localStorage`. File uploads (Documentos) and user identity (`isOwner`, `contaId`) only work in the Claude mode.
- **Login (`login.js` + `css/login.css`, local mode only):** `renderNow` calls `A.renderLogin()`, which shows the `#login` overlay while no active member is identified. For now there is **no authentication**: "Entrar" always lets the user in. If the e-mail field matches a member (by e-mail, OAB digits, full name or a unique first name), they enter as that member; otherwise as the nameless administrator (`gomes-eu` = `*`). The "Sair" button in the header runs the `sair` action. Forms submit through `data-onsubmit="x"`.

**Permissions:** the roles are `admin|advogado|assistente|estagiario|gerente` (the old `financeiro` role was removed; stored members with it are read as `gerente`). Each module gets a level of `nenhum|ver|editar` (`A.PERM_PADRAO`, overridable through `config/permissoes`). Check with `A.pode(mod, 'ver'|'editar')`. Every route declares its `mod`, and `renderNow` blocks views the user can't see.

**Dashboard (`#inicio`):** `m-inicio.js` holds the route, header, per-user layout prefs (localStorage `gomes-inicio-<meId>`), shortcuts (`A.ATALHOS`) and the `ini-*` actions. Widgets live in `m-inicio-widgets.js` and register with `A.widget(id, {titulo, icone, tam, visivel, render(ctx), acoes?})`. Registration order is the default order. Widgets only read data and reuse existing actions (`editar-prazo`, `concluir-prazo`, `abrir-processo`, `notif-abrir`, …). The monitoring widget reuses `A.notificacoes()`. "Tarefas" are prazos plus compromissos of type `Tarefa interna`. There is no activity log: "Últimas atividades" is derived from the `criadoEm/atualizadoEm` stamps.

**Financial dashboard (`#fin`, `m-fin-painel.js` + `css/fin-painel.css`):** shows **one chart at a time**. `calcDash(ym)` gathers the month's figures (same rules as before: `realizados`, `A.saldoAte`). Each entry in `GRAFICOS` has `{id, titulo, sub, formato (default), dados(c)}`, and `dados` returns a generic set `{labels, dicas?, series:[{nome, cor, valores}], linha?, periodo, destaque:{rotulo, valor, sinal?|tom?, sub}, leitura, vazio?}`. A single renderer, `desenhar(d, formato)`, draws any `FORMATOS` entry (`barras` reuses `A.chartBarras`; `hbarras`, `linhas`, `area` and `rosca` are local SVG/HTML; `tabela` adds a totals footer). Rosca drops negative values and uses one slice per label (single series) or per series total. Two drop-down menus ("Gráfico", "Formato") are `role="menu"` with `menuitemradio`. Menu state lives in module variables, not `A.ui`, and the `teclas`/`clique` route hooks close them on Esc or an outside click. ←/→ switch charts when no field is focused. Per-user prefs live in localStorage `gomes-findash-<meId>` as `{grafico, formatos:{[id]: formato}}`. To add a chart, push an entry to `GRAFICOS`.

**Exports:** each module registers `A.exportadores[name] = () => ({titulo, filtros, linhas, colunas:[{t, v, tipo?}]})` and renders `A.botoesExport(name)`. `export.js` lazy-loads SheetJS and jsPDF from cdnjs.

**Sample data:** every seeded record carries `exemplo: true`, which is what the "Remover exemplos" button deletes. The exception is `seed.equipeFixa` (the real team, e.g. Dr. Lucas Fernando, OAB/MG 181.253): no `exemplo` flag, and `app.js` re-adds any missing fixed member on load (matched by id or OAB), in both local and shared mode.

## Domain rules

- Dates are `AAAA-MM-DD` strings, compared lexically. Instants are ISO 8601.
- Money is always **integer cents**: use `A.cents()` to parse and `A.brl()` / `A.num()` to display.
- Deadlines (`prazo-logic.js`, CPC arts. 219/220/224): counting starts the business day after publication. Non-business days are weekends, national holidays (including Easter-based ones), configured local holidays (`P.setLocais`) and the forensic recess from Dec 20 to Jan 20. `situacao()` classifies a deadline as `vencido|hoje|critico (≤2 business days)|atencao (≤ config.antecedencia)|ok|concluido`. The computed date is only an aid; the official date is DJEN's or the court's.
- `schema.js` (`A.SCHEMA`) is the reference for collection fields. `docs/modelo-fisico.md` maps prototype fields to the SQL tables. Keep the three in sync when adding fields.

## Roadmap (from README / docs)

1. A PostgreSQL backend using `banco/modelo-fisico.sql`.
2. The DJEN collector (`docs/coletor-djen.md`). Phase 0 is a script that outputs JSON for the prototype's **Importar** button in Publicações.
3. DataJud integration for processes and their andamentos.
4. Individual auth, with permissions enforced in the database.
