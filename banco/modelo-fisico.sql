-- =====================================================================
-- Gomes · Sistema Jurídico — Modelo físico PostgreSQL 16
-- Versão: 16/11/2026
-- Referências: especificacao/juridico.md, especificacao/integracoes.md,
--              especificacao/coletor-djen.md e js/schema.js do protótipo.
--
-- Convenções
--   * Schema único: app.
--   * Chaves: uuid (gen_random_uuid()); tabelas de alto volume usam bigint identity.
--   * Single-tenant agora, multiempresa depois: TODA tabela de negócio tem
--     org_id NOT NULL com valor padrão app.org_atual(). Row-Level Security já
--     vem criada; para multiempresa basta a aplicação definir app.org_id por sessão.
--   * Dinheiro em centavos (bigint). Datas de calendário em date; instantes em timestamptz.
--   * Domínios fechados em text + CHECK (mais fácil de evoluir que ENUM).
--   * Colunas de rastreio: criado_em, criado_por, atualizado_em, atualizado_por.
--   * Exclusão: registros de negócio usam situação (ativo/encerrado/cancelado);
--     DELETE físico só onde a especificação permite.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca sem acento
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca aproximada por nome/texto

CREATE SCHEMA IF NOT EXISTS app;
SET search_path = app, public;

-- ---------------------------------------------------------------------
-- 1. Organização (single-tenant: uma linha) e funções de apoio
-- ---------------------------------------------------------------------
CREATE TABLE organizacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  cnpj           text,
  cidade         text,
  uf             char(2),
  fuso_horario   text NOT NULL DEFAULT 'America/Sao_Paulo',
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Organização da sessão: app.org_id (multiempresa) ou a única organização (single-tenant).
CREATE OR REPLACE FUNCTION org_atual() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.org_id', true), '')::uuid,
    (SELECT id FROM app.organizacoes ORDER BY criado_em LIMIT 1)
  )
$$;

-- Membro da equipe que está agindo (definido pela aplicação a cada transação).
CREATE OR REPLACE FUNCTION membro_atual() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.membro_id', true), '')::uuid
$$;

-- Atualiza atualizado_em/atualizado_por automaticamente.
CREATE OR REPLACE FUNCTION tg_rastreio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := COALESCE(app.membro_atual(), NEW.atualizado_por);
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := COALESCE(NEW.criado_em, now());
    NEW.criado_por := COALESCE(NEW.criado_por, app.membro_atual());
  END IF;
  RETURN NEW;
END $$;

-- Só dígitos (número CNJ, CPF/CNPJ, OAB).
CREATE OR REPLACE FUNCTION so_digitos(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

-- Texto normalizado para busca e deduplicação.
CREATE OR REPLACE FUNCTION normalizar(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(public.unaccent('public.unaccent'::regdictionary, regexp_replace(coalesce(t, ''), '<[^>]+>', ' ', 'g')), '\s+', ' ', 'g'))
$$;

-- Valida o dígito verificador do número CNJ (Res. CNJ 65/2008, módulo 97).
CREATE OR REPLACE FUNCTION cnj_valido(numero text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text := app.so_digitos(numero); n numeric;
BEGIN
  IF length(d) <> 20 THEN RETURN false; END IF;
  -- NNNNNNN DD AAAA J TR OOOO -> NNNNNNN AAAA J TR OOOO DD
  n := (substr(d,1,7) || substr(d,10,4) || substr(d,14,1) || substr(d,15,2) || substr(d,17,4) || substr(d,8,2))::numeric;
  RETURN n % 97 = 1;
END $$;

-- ---------------------------------------------------------------------
-- 2. Acesso, equipe e permissões
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (                       -- contas de login
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  senha_hash       text,                      -- argon2/bcrypt; nulo se login externo (SSO)
  provedor_externo text,                      -- ex.: 'google', 'microsoft'
  mfa_ativo        boolean NOT NULL DEFAULT false,
  ativo            boolean NOT NULL DEFAULT true,
  ultimo_acesso_em timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (lower(email));

CREATE TABLE equipe (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  nome            text NOT NULL,
  cargo           text,
  papel           text NOT NULL DEFAULT 'advogado'
                  CHECK (papel IN ('admin','advogado','assistente','estagiario','financeiro')),
  oab_numero      text,                       -- só dígitos
  oab_uf          char(2),
  oab_suplementar text,                       -- texto livre (ex.: 'OAB/SP 12.345')
  email           text,
  genero          char(1) CHECK (genero IN ('M','F')),  -- nulo = "Dr(a)." / "advogado(a)" nos modelos
  cor             char(7) NOT NULL DEFAULT '#273884' CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo           boolean NOT NULL DEFAULT true,
  usuario_id      uuid REFERENCES usuarios(id),
  vinculo_pendente_usuario_id uuid REFERENCES usuarios(id),
  vinculo_pendente_em timestamptz,
  exemplo         boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid
);
CREATE UNIQUE INDEX ux_equipe_usuario ON equipe (org_id, usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX ux_equipe_oab ON equipe (org_id, oab_numero, oab_uf) WHERE oab_numero IS NOT NULL;

-- Referências de auditoria de quem criou/alterou (adicionadas depois de equipe existir)
ALTER TABLE equipe ADD CONSTRAINT fk_equipe_criado_por FOREIGN KEY (criado_por) REFERENCES equipe(id) ON DELETE SET NULL;
ALTER TABLE equipe ADD CONSTRAINT fk_equipe_atualizado_por FOREIGN KEY (atualizado_por) REFERENCES equipe(id) ON DELETE SET NULL;

CREATE TABLE permissoes_papel (
  org_id  uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  papel   text NOT NULL CHECK (papel IN ('admin','advogado','assistente','estagiario','financeiro')),
  modulo  text NOT NULL CHECK (modulo IN ('prazos','processos','publicacoes','clientes','documentos','modelos','financeiro','relatorios','equipe')),
  nivel   text NOT NULL CHECK (nivel IN ('nenhum','ver','editar')),
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id),
  PRIMARY KEY (org_id, papel, modulo)
);

-- ---------------------------------------------------------------------
-- 3. Configurações e calendário
-- ---------------------------------------------------------------------
CREATE TABLE configuracoes (
  org_id                     uuid PRIMARY KEY DEFAULT org_atual() REFERENCES organizacoes(id),
  antecedencia_alerta_dias   smallint NOT NULL DEFAULT 5 CHECK (antecedencia_alerta_dias BETWEEN 1 AND 30),
  meta_interna_dias_uteis    smallint NOT NULL DEFAULT 2 CHECK (meta_interna_dias_uteis BETWEEN 0 AND 10),
  recesso_inicio_mmdd        char(5)  NOT NULL DEFAULT '12-20',
  recesso_fim_mmdd           char(5)  NOT NULL DEFAULT '01-20',
  comarca_padrao             text     NOT NULL DEFAULT 'Araguari',
  confirmacao_automatica_prazo boolean NOT NULL DEFAULT false,
  confianca_minima_auto      numeric(3,2) NOT NULL DEFAULT 0.90,
  escalonar_apos_horas_uteis smallint NOT NULL DEFAULT 4,
  escritorio_nome            text     NOT NULL DEFAULT 'Gomes Assessoria Jurídica',  -- {{escritorio.nome}} nos modelos
  escritorio_cidade          text     NOT NULL DEFAULT 'Araguari/MG',                -- {{escritorio.cidade}}
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id)
);

CREATE TABLE feriados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  data        date NOT NULL,
  nome        text NOT NULL,
  abrangencia text NOT NULL CHECK (abrangencia IN ('nacional','forense','estadual','municipal','tribunal','suspensao')),
  uf          char(2),
  comarca     text,                 -- nulo = vale para todas
  tribunal    text,                 -- ex.: 'TJMG', 'TRT3'; nulo = todos
  ato_normativo text,               -- ex.: 'Portaria Conjunta 1.800/2026'
  exemplo     boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id)
);
CREATE UNIQUE INDEX ux_feriados ON feriados (org_id, data, coalesce(comarca,''), coalesce(tribunal,''), nome);
CREATE INDEX ix_feriados_data ON feriados (org_id, data);

-- ---------------------------------------------------------------------
-- 4. Clientes (captação e carteira)
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  nome             text NOT NULL,
  tipo_pessoa      char(2) NOT NULL CHECK (tipo_pessoa IN ('PF','PJ')),
  documento        text,                         -- CPF/CNPJ como digitado
  documento_digitos text GENERATED ALWAYS AS (app.so_digitos(documento)) STORED,
  telefone         text,
  email            text,
  endereco         text,
  cidade           text,
  nacionalidade    text,                         -- qualificação (PF), usada em {{cliente.qualificacao}}
  estado_civil     text,
  profissao        text,
  rg               text,
  representante_nome  text,                      -- qualificação (PJ)
  representante_cpf   text,
  representante_cargo text,
  data_nascimento  date,                          -- PF; trazidos do Projuris e usados em ações trabalhistas/previdenciárias
  naturalidade     text,
  nome_mae         text,
  nome_pai         text,
  empresa          text,                          -- empregador (PF)
  ctps             text,
  pis              text,
  obs              text,                          -- observações gerais (CNH, título, inscrições, pendências)
  importado_de     text CHECK (importado_de IS NULL OR importado_de IN ('projuris')),  -- permite desfazer a importação
  revisar          boolean NOT NULL DEFAULT false, -- importado com campo a conferir
  uf               char(2),
  origem           text,                         -- como chegou
  area             text CHECK (area IN ('Assessoria jurídica','Direito Civil','Direito Trabalhista','Direito Previdenciário','Família e Sucessões','Cobrança','Consumidor','LGPD','Direito Criminal','Direito Bancário','Direito Administrativo','Direito Tributário','Direito Imobiliário','Direito Empresarial','Outras')),
  historia         text,
  urgencia         text NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal','alta')),
  status           text NOT NULL DEFAULT 'novo'
                   CHECK (status IN ('novo','encaminhado','analise','ativo','encerrado','recusado')),
  responsavel_id   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  cadastrado_por   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  aceito_em        timestamptz,
  encerrado_em     timestamptz,
  motivo_recusa    text,
  exemplo          boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  CONSTRAINT ck_cliente_recusa CHECK (status <> 'recusado' OR motivo_recusa IS NOT NULL),
  CONSTRAINT ck_cliente_aceite CHECK (status NOT IN ('ativo','encerrado') OR aceito_em IS NOT NULL)
);
CREATE INDEX ix_clientes_status ON clientes (org_id, status);
CREATE INDEX ix_clientes_doc ON clientes (org_id, documento_digitos) WHERE documento_digitos <> '';
CREATE INDEX ix_clientes_nome_trgm ON clientes USING gin (app.normalizar(nome) gin_trgm_ops);

CREATE TABLE cliente_encaminhamentos (           -- "Encaminhar para"
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  membro_id       uuid NOT NULL REFERENCES equipe(id) ON DELETE CASCADE,
  encaminhado_em  timestamptz NOT NULL DEFAULT now(),
  encaminhado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  PRIMARY KEY (cliente_id, membro_id)
);
CREATE INDEX ix_cli_enc_membro ON cliente_encaminhamentos (membro_id);

CREATE TABLE cliente_historico (                 -- linha do tempo do cliente
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  cliente_id  uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  em          timestamptz NOT NULL DEFAULT now(),
  por         uuid REFERENCES equipe(id) ON DELETE SET NULL,
  tipo        text NOT NULL DEFAULT 'nota'
              CHECK (tipo IN ('cadastro','encaminhamento','analise','aceite','recusa','encerramento','reativacao','documento','nota')),
  texto       text NOT NULL
);
CREATE INDEX ix_cli_hist ON cliente_historico (cliente_id, em DESC);

-- ---------------------------------------------------------------------
-- 5. Processos
-- ---------------------------------------------------------------------
CREATE TABLE processos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  pasta           integer NOT NULL CHECK (pasta > 0),  -- nº interno do caso (1 pasta = 1 processo); vem do Projuris na migração
  numero          text CHECK (numero IS NULL OR btrim(numero) <> ''),  -- como exibido (máscara CNJ); NULL enquanto não ajuizado
  numero_digitos  text GENERATED ALWAYS AS (app.so_digitos(numero)) STORED,
  numero_valido   boolean GENERATED ALWAYS AS (app.cnj_valido(numero)) STORED,
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  parte_contraria text,
  polo            text NOT NULL DEFAULT 'ativo' CHECK (polo IN ('ativo','passivo')),
  tribunal        text,                           -- TJMG, TRT3, TRF6, STJ…
  sistema         text CHECK (sistema IN ('eproc','pje','pje-jt','esaj','projudi','outro')),
  grau            text CHECK (grau IN ('G1','G2','JE','TR','SUP','OUTRO')),
  comarca         text,
  vara            text,
  classe          text,
  classe_codigo   integer,                        -- TPU/CNJ
  assuntos        jsonb NOT NULL DEFAULT '[]',    -- [{codigo, nome}] TPU
  area            text CHECK (area IN ('Assessoria jurídica','Direito Civil','Direito Trabalhista','Direito Previdenciário','Família e Sucessões','Cobrança','Consumidor','LGPD','Direito Criminal','Direito Bancário','Direito Administrativo','Direito Tributário','Direito Imobiliário','Direito Empresarial','Outras')),
  valor_causa     bigint CHECK (valor_causa IS NULL OR valor_causa >= 0),  -- centavos
  responsavel_id  uuid REFERENCES equipe(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','arquivado','encerrado')),
  distribuido_em  date,
  segredo_justica boolean NOT NULL DEFAULT false,
  obs             text,
  origem_dados    text NOT NULL DEFAULT 'manual' CHECK (origem_dados IN ('manual','datajud','fornecedor')),
  importado_de    text CHECK (importado_de IS NULL OR importado_de IN ('projuris')),  -- permite desfazer a migração
  revisar         boolean NOT NULL DEFAULT false,  -- importado com algo a conferir
  ultima_sincronizacao timestamptz,
  exemplo         boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX ux_processos_numero ON processos (org_id, numero_digitos) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX ux_processos_pasta ON processos (org_id, pasta);

-- Numeração automática da pasta: se o INSERT não informar a pasta, usa a maior do escritório + 1.
-- O advisory lock por escritório impede que dois cadastros simultâneos peguem o mesmo número.
CREATE OR REPLACE FUNCTION tg_processos_pasta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pasta IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('pasta:' || NEW.org_id::text));
    SELECT coalesce(max(pasta), 0) + 1 INTO NEW.pasta FROM app.processos WHERE org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_processos_pasta BEFORE INSERT ON processos FOR EACH ROW EXECUTE FUNCTION tg_processos_pasta();
CREATE INDEX ix_processos_cliente ON processos (cliente_id);
CREATE INDEX ix_processos_resp ON processos (org_id, responsavel_id, status);

CREATE TABLE processo_partes (                   -- detalhamento opcional das partes
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id  uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  polo         text NOT NULL CHECK (polo IN ('ativo','passivo','terceiro')),
  nome         text NOT NULL,
  documento    text,
  advogados    text,                            -- texto livre com advogados da parte
  e_cliente    boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_partes_proc ON processo_partes (processo_id);

CREATE TABLE processo_andamentos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  processo_id   uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  data          timestamptz NOT NULL,
  texto         text NOT NULL,
  codigo_tpu    integer,                         -- movimento TPU (DataJud)
  origem        text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','datajud','fornecedor','publicacao')),
  chave_externa text,                            -- dedup de movimentos importados
  por           uuid REFERENCES equipe(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_andamentos_proc ON processo_andamentos (processo_id, data DESC);
CREATE UNIQUE INDEX ux_andamentos_ext ON processo_andamentos (processo_id, chave_externa) WHERE chave_externa IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Coletor DJEN (alvos, capturas, respostas brutas)
-- ---------------------------------------------------------------------
CREATE TABLE djen_alvos (                        -- OABs monitoradas
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  membro_id   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  numero_oab  text NOT NULL CHECK (numero_oab ~ '^\d+$'),
  uf_oab      char(2) NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  desde       date NOT NULL DEFAULT current_date,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, numero_oab, uf_oab)
);

CREATE TABLE djen_capturas (                     -- uma varredura (OAB x janela)
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  alvo_id         uuid NOT NULL REFERENCES djen_alvos(id),
  janela_inicio   date NOT NULL,
  janela_fim      date NOT NULL,
  rodada          text NOT NULL,                 -- ex.: '2026-11-16T09:10'
  motivo          text NOT NULL CHECK (motivo IN ('rotina','reconciliacao','recuperacao','manual')),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','executando','concluida','parcial','falhou')),
  iniciada_em     timestamptz,
  concluida_em    timestamptz,
  paginas         integer NOT NULL DEFAULT 0,
  total_informado integer,
  total_recebido  integer NOT NULL DEFAULT 0,
  novas           integer NOT NULL DEFAULT 0,
  duplicadas      integer NOT NULL DEFAULT 0,
  erro            text,
  correlacao_id   uuid NOT NULL DEFAULT gen_random_uuid(),
  CHECK (janela_fim >= janela_inicio),
  UNIQUE (org_id, alvo_id, janela_inicio, janela_fim, rodada)
);
CREATE INDEX ix_capturas_alvo ON djen_capturas (alvo_id, concluida_em DESC);
CREATE INDEX ix_capturas_status ON djen_capturas (org_id, status, iniciada_em);

CREATE TABLE djen_respostas (                    -- prova de captura (imutável)
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id       uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  captura_id   uuid NOT NULL REFERENCES djen_capturas(id),
  pagina       integer NOT NULL,
  url          text NOT NULL,
  http_status  smallint NOT NULL,
  headers      jsonb NOT NULL,
  corpo        jsonb,
  sha256       char(64) NOT NULL,
  recebida_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_respostas_captura ON djen_respostas (captura_id, pagina);

-- ---------------------------------------------------------------------
-- 7. Publicações
-- ---------------------------------------------------------------------
CREATE TABLE publicacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  disponibilizacao date NOT NULL,
  publicacao       date NOT NULL,                 -- 1º dia útil após a disponibilização
  tribunal         text,
  orgao            text,
  numero_processo  text,
  numero_digitos   text GENERATED ALWAYS AS (app.so_digitos(numero_processo)) STORED,
  processo_id      uuid REFERENCES processos(id) ON DELETE SET NULL,
  tipo             text,                          -- Intimação, Despacho, Sentença…
  tipo_documento   text,
  texto            text NOT NULL,
  oab              text,                          -- OAB intimada (ex.: MG123456)
  destinatarios    jsonb NOT NULL DEFAULT '[]',   -- advogados/partes informados pela fonte
  origem           text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','importacao','djen','fornecedor')),
  status           text NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','lida','tratada','descartada')),
  cancelada        boolean NOT NULL DEFAULT false,
  motivo_descarte  text,
  responsavel_id   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  tratada_em       timestamptz,
  tratada_por      uuid REFERENCES equipe(id) ON DELETE SET NULL,
  id_externo       text,                          -- identificador da comunicação na fonte
  hash_conteudo    char(64) NOT NULL,             -- deduplicação (ver coletor-djen.md §5.4)
  resposta_id      bigint REFERENCES djen_respostas(id),
  capturada_em     timestamptz,
  link_fonte       text,
  exemplo          boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  CHECK (publicacao >= disponibilizacao),
  CHECK (status <> 'descartada' OR motivo_descarte IS NOT NULL)
);
CREATE UNIQUE INDEX ux_pub_hash ON publicacoes (org_id, hash_conteudo);
CREATE UNIQUE INDEX ux_pub_externo ON publicacoes (org_id, id_externo) WHERE id_externo IS NOT NULL;
CREATE INDEX ix_pub_status ON publicacoes (org_id, status, disponibilizacao DESC);
CREATE INDEX ix_pub_proc ON publicacoes (processo_id);
CREATE INDEX ix_pub_numero ON publicacoes (org_id, numero_digitos);
CREATE INDEX ix_pub_texto_trgm ON publicacoes USING gin (app.normalizar(texto) gin_trgm_ops);

CREATE TABLE publicacoes_quarentena (            -- itens fora do formato esperado
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id       uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  resposta_id  bigint REFERENCES djen_respostas(id),
  item         jsonb NOT NULL,
  erro         text NOT NULL,
  resolvido    boolean NOT NULL DEFAULT false,
  resolvido_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. Regras de prazo e prazos
-- ---------------------------------------------------------------------
CREATE TABLE regras_prazo (                      -- camada B do motor (editável pelas advogadas)
  id           text NOT NULL,                    -- ex.: 'civel.sentenca.apelacao'
  org_id       uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  descricao    text NOT NULL,
  ramo         text NOT NULL CHECK (ramo IN ('civel','juizado','trabalhista','previdenciario','familia','penal','outro')),
  gatilho      text NOT NULL,                    -- expressão regular sobre o texto/tipo do ato
  tipo_prazo   text NOT NULL,                    -- ex.: 'Recurso de Apelação'
  providencia  text,
  dias         smallint CHECK (dias > 0),
  unidade      text NOT NULL DEFAULT 'dias' CHECK (unidade IN ('dias','horas')),
  contagem     text NOT NULL DEFAULT 'uteis' CHECK (contagem IN ('uteis','corridos')),
  fundamento   text,                             -- ex.: 'CPC art. 1.003 §5º'
  confianca    numeric(3,2) NOT NULL DEFAULT 0.70 CHECK (confianca BETWEEN 0 AND 1),
  prioridade   smallint NOT NULL DEFAULT 100,
  ativa        boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE prazos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  processo_id      uuid REFERENCES processos(id) ON DELETE SET NULL,
  processo_numero  text,                          -- texto livre quando não há processo cadastrado
  cliente_id       uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome     text,
  publicacao_id    uuid REFERENCES publicacoes(id) ON DELETE SET NULL,
  tipo             text NOT NULL,
  descricao        text,
  data_publicacao  date,
  dias             smallint CHECK (dias IS NULL OR dias > 0),
  contagem         text NOT NULL DEFAULT 'uteis' CHECK (contagem IN ('uteis','corridos')),
  vencimento       date NOT NULL,
  meta_interna     date,
  vencimento_manual boolean NOT NULL DEFAULT false,  -- data fatal ajustada à mão
  responsavel_id   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  prioridade       text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal','alta')),
  status           text NOT NULL DEFAULT 'pendente' CHECK (status IN ('sugerido','pendente','concluido','descartado')),
  origem           text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','automatica')),
  regra_org_id     uuid,
  regra_id         text,
  confianca        numeric(3,2) CHECK (confianca IS NULL OR confianca BETWEEN 0 AND 1),
  fundamentacao    text,
  confirmado_por   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  confirmado_em    timestamptz,
  concluido_em     timestamptz,
  concluido_por    uuid REFERENCES equipe(id) ON DELETE SET NULL,
  motivo_descarte  text,
  obs              text,
  exemplo          boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  FOREIGN KEY (regra_org_id, regra_id) REFERENCES regras_prazo(org_id, id) ON DELETE SET NULL (regra_id),
  CHECK (meta_interna IS NULL OR meta_interna <= vencimento),
  CHECK (data_publicacao IS NULL OR vencimento >= data_publicacao),
  CHECK (status <> 'descartado' OR motivo_descarte IS NOT NULL),
  CHECK (origem <> 'automatica' OR publicacao_id IS NOT NULL)
);
CREATE INDEX ix_prazos_venc ON prazos (org_id, status, vencimento);
CREATE INDEX ix_prazos_resp ON prazos (org_id, responsavel_id, vencimento) WHERE status IN ('sugerido','pendente');
CREATE INDEX ix_prazos_proc ON prazos (processo_id);
CREATE UNIQUE INDEX ux_prazo_auto_pub ON prazos (publicacao_id) WHERE origem = 'automatica';  -- 1 sugestão por publicação

-- Compromissos da agenda (atendimentos, audiências, reuniões): têm horário, diferentemente dos prazos.
CREATE TABLE compromissos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  tipo             text NOT NULL DEFAULT 'Atendimento',  -- Atendimento, Audiência, Reunião, Inicial, Consulta, Diligência…
  titulo           text NOT NULL,
  data             date NOT NULL,
  dia_inteiro      boolean NOT NULL DEFAULT false,
  hora_inicio      time,
  hora_fim         time,
  responsavel_id   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  participantes    uuid[] NOT NULL DEFAULT '{}',          -- outros membros da equipe
  processo_id      uuid REFERENCES processos(id) ON DELETE SET NULL,
  cliente_id       uuid REFERENCES clientes(id) ON DELETE SET NULL,
  local            text,                                  -- endereço ou link da sala virtual
  status           text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','concluido','cancelado')),
  obs              text,
  exemplo          boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  CHECK (dia_inteiro OR hora_inicio IS NOT NULL),
  CHECK (hora_fim IS NULL OR hora_inicio IS NULL OR hora_fim >= hora_inicio)
);
CREATE INDEX ix_comp_data ON compromissos (org_id, data, hora_inicio);
CREATE INDEX ix_comp_resp ON compromissos (org_id, responsavel_id, data);
CREATE INDEX ix_comp_part ON compromissos USING gin (participantes);

-- ---------------------------------------------------------------------
-- 9. Documentos
-- ---------------------------------------------------------------------
CREATE TABLE documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  nome          text NOT NULL,
  categoria     text NOT NULL DEFAULT 'Outros',
  cliente_id    uuid REFERENCES clientes(id) ON DELETE SET NULL,
  processo_id   uuid REFERENCES processos(id) ON DELETE SET NULL,
  storage_chave text NOT NULL,                   -- caminho no armazenamento (ex.: S3)
  content_type  text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  sha256        char(64) NOT NULL,
  enviado_por   uuid REFERENCES equipe(id) ON DELETE SET NULL,
  enviado_em    timestamptz NOT NULL DEFAULT now(),
  excluido_em   timestamptz,                     -- exclusão lógica; arquivo removido por rotina
  exemplo       boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_docs_cliente ON documentos (cliente_id) WHERE excluido_em IS NULL;
CREATE INDEX ix_docs_processo ON documentos (processo_id) WHERE excluido_em IS NULL;
CREATE UNIQUE INDEX ux_docs_storage ON documentos (org_id, storage_chave);

-- Modelos de texto com campos {{cliente.nome}}, {{processo.numero}}, {{advogada.oab}}, {{data_hoje_extenso}}...
-- O preenchimento acontece na aplicação; o documento gerado é gravado em "documentos" (PDF).
CREATE TABLE modelos_documento (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  nome      text NOT NULL,
  tipo      text NOT NULL DEFAULT 'Outro' CHECK (tipo IN ('Procuração','Contrato','Declaração','Petição','Outro')),
  texto     text NOT NULL CHECK (length(btrim(texto)) > 0),
  ativo     boolean NOT NULL DEFAULT true,
  exemplo   boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  UNIQUE (org_id, nome)
);

-- ---------------------------------------------------------------------
-- 10. Financeiro (lançamentos e baixas manuais; sem integração bancária)
-- ---------------------------------------------------------------------
CREATE TABLE centros_custo (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  codigo    text NOT NULL,
  nome      text NOT NULL,
  ativo     boolean NOT NULL DEFAULT true,
  exemplo   boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  UNIQUE (org_id, codigo)
);

CREATE TABLE contas_financeiras (                -- contas e caixas (sem integração bancária)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  nome                text NOT NULL,
  tipo                text NOT NULL DEFAULT 'conta' CHECK (tipo IN ('caixa','conta','outro')),
  saldo_inicial       bigint NOT NULL DEFAULT 0,  -- centavos
  saldo_inicial_data  date NOT NULL DEFAULT current_date,
  ativa               boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  UNIQUE (org_id, nome)
);

CREATE TABLE fin_lancamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  tipo            text NOT NULL CHECK (tipo IN ('receber','pagar')),
  categoria       text NOT NULL,
  natureza        text NOT NULL DEFAULT 'operacional'
                  CHECK (natureza IN ('honorarios','custas','despesa_processual','operacional','reembolso','outros')),
  descricao       text NOT NULL,
  valor           bigint NOT NULL CHECK (valor > 0),          -- centavos
  vencimento      date NOT NULL,
  competencia     date NOT NULL,                              -- 1º dia do mês de competência
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  pago_em         date,
  valor_pago      bigint CHECK (valor_pago IS NULL OR valor_pago > 0),
  forma           text,                                       -- informativo (transferência, dinheiro…)
  conta_id        uuid REFERENCES contas_financeiras(id) ON DELETE SET NULL,
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  processo_id     uuid REFERENCES processos(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES centros_custo(id) ON DELETE SET NULL,
  reembolsavel    boolean NOT NULL DEFAULT false,
  reembolso_de    uuid REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  documento       text,                                       -- nº NF, recibo, guia
  parcela_grupo   uuid,
  parcela_n       smallint,
  parcela_total   smallint,
  obs             text,
  cancelado_em    timestamptz,
  exemplo         boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid REFERENCES equipe(id) ON DELETE SET NULL,
  CHECK (competencia = date_trunc('month', competencia)::date),
  CHECK ((status = 'pago') = (pago_em IS NOT NULL AND valor_pago IS NOT NULL)),
  CHECK (tipo = 'pagar' OR reembolsavel = false),
  CHECK ((parcela_grupo IS NULL) = (parcela_n IS NULL) AND (parcela_n IS NULL) = (parcela_total IS NULL)),
  CHECK (parcela_n IS NULL OR parcela_n BETWEEN 1 AND parcela_total)
);
CREATE INDEX ix_fin_venc ON fin_lancamentos (org_id, tipo, status, vencimento);
CREATE INDEX ix_fin_pago ON fin_lancamentos (org_id, pago_em) WHERE status = 'pago';
CREATE INDEX ix_fin_processo ON fin_lancamentos (processo_id);
CREATE INDEX ix_fin_cliente ON fin_lancamentos (cliente_id);
CREATE INDEX ix_fin_centro ON fin_lancamentos (centro_custo_id);
CREATE INDEX ix_fin_parcelas ON fin_lancamentos (parcela_grupo) WHERE parcela_grupo IS NOT NULL;

-- ---------------------------------------------------------------------
-- 11. Fila de jobs, avisos e registro de integrações
-- ---------------------------------------------------------------------
CREATE TABLE jobs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  tipo           text NOT NULL CHECK (tipo IN ('djen.varrer','djen.pagina','djen.comunicacao','djen.reconciliar',
                   'prazo.sugerir','aviso.enviar','aviso.escalar','cobertura.verificar','datajud.sincronizar','manutencao.limpeza')),
  chave          text NOT NULL,                   -- idempotência
  payload        jsonb NOT NULL DEFAULT '{}',
  prioridade     smallint NOT NULL DEFAULT 5 CHECK (prioridade BETWEEN 1 AND 9),
  status         text NOT NULL DEFAULT 'pronto' CHECK (status IN ('pronto','executando','concluido','falhou','morto')),
  tentativas     integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 6,
  executar_apos  timestamptz NOT NULL DEFAULT now(),
  travado_ate    timestamptz,
  worker         text,
  ultimo_erro    text,
  correlacao_id  uuid,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  concluido_em   timestamptz,
  UNIQUE (org_id, tipo, chave)
);
CREATE INDEX ix_jobs_fila ON jobs (prioridade, executar_apos, id) WHERE status = 'pronto';
CREATE INDEX ix_jobs_travados ON jobs (travado_ate) WHERE status = 'executando';

-- Retira o próximo job de um conjunto de tipos (uso: SELECT * FROM app.proximo_job(ARRAY['djen.varrer','djen.pagina'], 'coletor-1'))
CREATE OR REPLACE FUNCTION proximo_job(tipos text[], nome_worker text, lease interval DEFAULT '5 minutes')
RETURNS SETOF jobs LANGUAGE sql AS $$
  UPDATE app.jobs j SET status = 'executando', tentativas = j.tentativas + 1,
         travado_ate = now() + lease, worker = nome_worker
   WHERE j.id = (SELECT id FROM app.jobs
                  WHERE status = 'pronto' AND executar_apos <= now() AND tipo = ANY(tipos)
                  ORDER BY prioridade, executar_apos, id
                  FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING j.*
$$;

-- Devolve à fila jobs cujo worker caiu (lease vencido).
CREATE OR REPLACE FUNCTION liberar_jobs_travados() RETURNS integer LANGUAGE sql AS $$
  WITH x AS (UPDATE app.jobs SET status = 'pronto', travado_ate = NULL, worker = NULL
              WHERE status = 'executando' AND travado_ate < now() RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE TABLE avisos (                            -- notificações enviadas/pendentes
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  evento         text NOT NULL,                  -- prazo.sugerido, prazo.urgente, captura.suspensa…
  entidade       text,
  entidade_id    text,
  destinatario_id uuid REFERENCES equipe(id) ON DELETE SET NULL,
  canal          text NOT NULL CHECK (canal IN ('sistema','email','whatsapp')),
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falhou','lido')),
  enviado_em     timestamptz,
  lido_em        timestamptz,
  dispensado_em  timestamptz,                    -- central de notificações: "Dispensar" (some da lista, sem apagar)
  erro           text,
  correlacao_id  uuid,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, evento, entidade_id, destinatario_id, canal)
);
CREATE INDEX ix_avisos_dest ON avisos (destinatario_id, status, criado_em DESC);

CREATE TABLE integracoes_log (                   -- resumo por execução de qualquer integração
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  fonte         text NOT NULL CHECK (fonte IN ('djen','datajud','domicilio','fornecedor','outro')),
  operacao      text NOT NULL,
  status        text NOT NULL CHECK (status IN ('ok','parcial','erro')),
  iniciado_em   timestamptz NOT NULL,
  concluido_em  timestamptz,
  itens         integer,
  detalhes      jsonb NOT NULL DEFAULT '{}',
  correlacao_id uuid
);
CREATE INDEX ix_integ_log ON integracoes_log (org_id, fonte, iniciado_em DESC);

-- ---------------------------------------------------------------------
-- 12. Auditoria (append-only, encadeada por hash)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL DEFAULT org_atual() REFERENCES organizacoes(id),
  em            timestamptz NOT NULL DEFAULT clock_timestamp(),
  ator          text NOT NULL,                   -- 'sistema:coletor' | 'membro:<uuid>' | 'banco'
  acao          text NOT NULL,                   -- ex.: prazo.confirmado, publicacao.criada, INSERT/UPDATE/DELETE
  entidade      text NOT NULL,
  entidade_id   text NOT NULL,
  antes         jsonb,
  depois        jsonb,
  correlacao_id uuid,
  hash_anterior char(64),
  hash          char(64) NOT NULL
);
CREATE INDEX ix_aud_entidade ON auditoria (entidade, entidade_id, em);
CREATE INDEX ix_aud_em ON auditoria (org_id, em);

CREATE OR REPLACE FUNCTION tg_auditoria_hash() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE ultimo char(64);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('app.auditoria:' || NEW.org_id::text));  -- serializa a cadeia por organização
  SELECT hash INTO ultimo FROM app.auditoria WHERE org_id = NEW.org_id ORDER BY id DESC LIMIT 1;
  NEW.hash_anterior := ultimo;
  NEW.hash := encode(digest(coalesce(ultimo,'') || NEW.em::text || NEW.ator || NEW.acao || NEW.entidade || NEW.entidade_id
                            || coalesce(NEW.antes::text,'') || coalesce(NEW.depois::text,''), 'sha256'), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER tg_auditoria_hash BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION tg_auditoria_hash();

CREATE OR REPLACE FUNCTION tg_bloqueia_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Tabela % é somente inserção', TG_TABLE_NAME; END $$;
CREATE TRIGGER tg_auditoria_imutavel BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION tg_bloqueia_alteracao();
CREATE TRIGGER tg_respostas_imutavel BEFORE UPDATE OR DELETE ON djen_respostas FOR EACH ROW EXECUTE FUNCTION tg_bloqueia_alteracao();

-- Confere a integridade da cadeia; retorna o primeiro id quebrado (NULL = íntegra).
CREATE OR REPLACE FUNCTION verificar_auditoria(p_org uuid DEFAULT org_atual()) RETURNS bigint
LANGUAGE plpgsql STABLE AS $$
DECLARE r record; ant char(64) := NULL; calc char(64);
BEGIN
  FOR r IN SELECT * FROM app.auditoria WHERE org_id = p_org ORDER BY id LOOP
    calc := encode(digest(coalesce(ant,'') || r.em::text || r.ator || r.acao || r.entidade || r.entidade_id
                          || coalesce(r.antes::text,'') || coalesce(r.depois::text,''), 'sha256'), 'hex');
    IF r.hash <> calc OR r.hash_anterior IS DISTINCT FROM ant THEN RETURN r.id; END IF;
    ant := r.hash;
  END LOOP;
  RETURN NULL;
END $$;

-- Auditoria automática de alterações nas tabelas de negócio.
CREATE OR REPLACE FUNCTION tg_auditar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE linha jsonb := to_jsonb(COALESCE(NEW, OLD));
BEGIN
  INSERT INTO app.auditoria (org_id, ator, acao, entidade, entidade_id, antes, depois, correlacao_id)
  VALUES (
    COALESCE((linha->>'org_id')::uuid, app.org_atual()),
    COALESCE('membro:' || app.membro_atual()::text, NULLIF(current_setting('app.ator', true), ''), 'banco'),
    TG_OP, TG_TABLE_NAME, COALESCE(linha->>'id', linha->>'cliente_id', '?'),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    NULLIF(current_setting('app.correlacao_id', true), '')::uuid);
  RETURN COALESCE(NEW, OLD);
END $$;

-- ---------------------------------------------------------------------
-- 13. Gatilhos de rastreio e auditoria
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipe','feriados','clientes','processos','publicacoes','prazos','compromissos','modelos_documento','centros_custo','contas_financeiras','fin_lancamentos'] LOOP
    EXECUTE format('CREATE TRIGGER tg_rastreio BEFORE INSERT OR UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.tg_rastreio()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['equipe','permissoes_papel','configuracoes','feriados','clientes','cliente_encaminhamentos','processos',
                           'publicacoes','regras_prazo','prazos','compromissos','documentos','modelos_documento','centros_custo','contas_financeiras','fin_lancamentos','djen_alvos'] LOOP
    EXECUTE format('CREATE TRIGGER tg_auditar AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.tg_auditar()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 14. Row-Level Security (pronta para multiempresa)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipe','permissoes_papel','configuracoes','feriados','clientes','cliente_historico','processos','processo_andamentos',
                           'djen_alvos','djen_capturas','djen_respostas','publicacoes','publicacoes_quarentena','regras_prazo','prazos','compromissos','documentos','modelos_documento',
                           'centros_custo','contas_financeiras','fin_lancamentos','jobs','avisos','integracoes_log','auditoria'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pol_org ON app.%I USING (org_id = app.org_atual()) WITH CHECK (org_id = app.org_atual())', t);
  END LOOP;
END $$;
-- Tabelas filhas sem org_id (cliente_encaminhamentos, processo_partes) herdam o isolamento pelo pai via FK.

-- ---------------------------------------------------------------------
-- 15. Visões de apoio
-- ---------------------------------------------------------------------
CREATE VIEW vw_saldo_contas AS
SELECT c.org_id, c.id AS conta_id, c.nome,
       c.saldo_inicial
       + COALESCE(SUM(CASE WHEN l.tipo = 'receber' THEN l.valor_pago ELSE -l.valor_pago END)
                  FILTER (WHERE l.status = 'pago' AND l.pago_em >= c.saldo_inicial_data AND l.pago_em <= current_date), 0) AS saldo_atual
  FROM contas_financeiras c
  LEFT JOIN fin_lancamentos l ON l.conta_id = c.id
 GROUP BY c.org_id, c.id, c.nome, c.saldo_inicial;

CREATE VIEW vw_fluxo_mensal AS                     -- realizado (baixas) por mês
SELECT org_id, date_trunc('month', pago_em)::date AS mes,
       SUM(valor_pago) FILTER (WHERE tipo = 'receber') AS entradas,
       SUM(valor_pago) FILTER (WHERE tipo = 'pagar')   AS saidas
  FROM fin_lancamentos WHERE status = 'pago'
 GROUP BY org_id, date_trunc('month', pago_em);

CREATE VIEW vw_cobertura_djen AS                   -- última captura concluída por OAB
SELECT a.org_id, a.id AS alvo_id, a.uf_oab || a.numero_oab AS oab, a.membro_id,
       max(c.concluida_em) FILTER (WHERE c.status = 'concluida') AS ultima_concluida,
       count(*) FILTER (WHERE c.status = 'falhou' AND c.iniciada_em > now() - interval '24 hours') AS falhas_24h
  FROM djen_alvos a LEFT JOIN djen_capturas c ON c.alvo_id = a.id
 WHERE a.ativo
 GROUP BY a.org_id, a.id;

CREATE VIEW vw_prazos_abertos AS
SELECT p.*, pr.pasta AS processo_pasta, pr.numero AS processo_numero_cadastrado, cl.nome AS cliente_cadastrado, e.nome AS responsavel_nome
  FROM prazos p
  LEFT JOIN processos pr ON pr.id = p.processo_id
  LEFT JOIN clientes cl ON cl.id = p.cliente_id
  LEFT JOIN equipe e ON e.id = p.responsavel_id
 WHERE p.status IN ('sugerido','pendente');

-- ---------------------------------------------------------------------
-- 16. Papéis de banco e permissões
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN CREATE ROLE app_rw NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_leitura') THEN CREATE ROLE app_leitura NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA app TO app_rw, app_leitura;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO app_leitura;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_rw;
REVOKE UPDATE, DELETE, TRUNCATE ON app.auditoria, app.djen_respostas FROM app_rw;   -- somente inserção
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO app_rw;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_rw, app_leitura;
-- Usuários de login (ex.: app_api, app_worker) devem ser criados fora deste script e receber "GRANT app_rw".

-- ---------------------------------------------------------------------
-- 17. Dados iniciais (organização única, configuração, permissões e regras)
-- ---------------------------------------------------------------------
INSERT INTO organizacoes (nome, cidade, uf) VALUES ('Gomes Assessoria Jurídica', 'Araguari', 'MG');
INSERT INTO configuracoes (org_id) SELECT org_atual();

INSERT INTO permissoes_papel (papel, modulo, nivel)
SELECT p, m, n FROM (VALUES
 ('admin','prazos','editar'),('admin','processos','editar'),('admin','publicacoes','editar'),('admin','clientes','editar'),
 ('admin','documentos','editar'),('admin','financeiro','editar'),('admin','relatorios','editar'),('admin','equipe','editar'),
 ('advogado','prazos','editar'),('advogado','processos','editar'),('advogado','publicacoes','editar'),('advogado','clientes','editar'),
 ('advogado','documentos','editar'),('advogado','financeiro','ver'),('advogado','relatorios','ver'),('advogado','equipe','ver'),
 ('assistente','prazos','ver'),('assistente','processos','ver'),('assistente','publicacoes','editar'),('assistente','clientes','editar'),
 ('assistente','documentos','editar'),('assistente','financeiro','nenhum'),('assistente','relatorios','nenhum'),('assistente','equipe','ver'),
 ('estagiario','prazos','editar'),('estagiario','processos','ver'),('estagiario','publicacoes','ver'),('estagiario','clientes','ver'),
 ('estagiario','documentos','editar'),('estagiario','financeiro','nenhum'),('estagiario','relatorios','nenhum'),('estagiario','equipe','ver'),
 ('financeiro','prazos','ver'),('financeiro','processos','ver'),('financeiro','publicacoes','nenhum'),('financeiro','clientes','ver'),
 ('financeiro','documentos','ver'),('financeiro','financeiro','editar'),('financeiro','relatorios','editar'),('financeiro','equipe','ver'),
 ('admin','modelos','editar'),('advogado','modelos','editar'),('assistente','modelos','ver'),('estagiario','modelos','ver'),('financeiro','modelos','nenhum')
) v(p, m, n);

INSERT INTO feriados (data, nome, abrangencia, comarca) VALUES
 ('2026-08-06','Senhor Bom Jesus da Cana Verde','municipal','Araguari'),
 ('2026-08-15','Nossa Senhora da Abadia','municipal','Araguari'),
 ('2026-08-28','Dia da Cidade','municipal','Araguari'),
 ('2027-08-06','Senhor Bom Jesus da Cana Verde','municipal','Araguari'),
 ('2027-08-15','Nossa Senhora da Abadia','municipal','Araguari'),
 ('2027-08-28','Dia da Cidade','municipal','Araguari');

-- Regras iniciais do motor de prazos (camada B). Devem ser revisadas pelas advogadas antes do uso.
INSERT INTO regras_prazo (id, descricao, ramo, gatilho, tipo_prazo, providencia, dias, contagem, fundamento, confianca, prioridade) VALUES
 ('civel.prazo_expresso',   'Prazo expresso no texto',                    'civel',       '(prazo de|no prazo de|em) \d+ ?(\(\w+\))? dias', 'Manifestação', 'Cumprir o determinado', NULL, 'uteis', 'Texto da intimação', 0.90, 10),
 ('civel.sentenca.apelacao','Sentença no cível: apelação',                'civel',       '\msenten[cç]a\M',                     'Recurso de Apelação',     'Avaliar e interpor apelação',          15, 'uteis', 'CPC art. 1.003 §5º',  0.70, 50),
 ('civel.decisao.embargos', 'Decisão: embargos de declaração',            'civel',       '\mdecis[aã]o\M',                      'Embargos de Declaração',  'Avaliar omissão/contradição',           5,  'uteis', 'CPC art. 1.023',      0.60, 60),
 ('civel.contrarrazoes',    'Intimação para contrarrazões',               'civel',       'contrarraz[oõ]es',                    'Contrarrazões',           'Apresentar contrarrazões',              15, 'uteis', 'CPC art. 1.010 §1º',  0.70, 40),
 ('jec.sentenca.recurso',   'Sentença no Juizado Especial: recurso inominado','juizado', '\msenten[cç]a\M',                     'Recurso Inominado',       'Avaliar e interpor recurso',            10, 'uteis', 'Lei 9.099/95 art. 42', 0.70, 45),
 ('trab.sentenca.ro',       'Sentença trabalhista: recurso ordinário',    'trabalhista', '\msenten[cç]a\M',                     'Recurso Ordinário',       'Avaliar e interpor recurso ordinário',  8,  'uteis', 'CLT art. 895',        0.70, 45),
 ('trab.contrarrazoes',     'Trabalhista: contrarrazões',                 'trabalhista', 'contrarraz[oõ]es',                    'Contrarrazões',           'Apresentar contrarrazões',              8,  'uteis', 'CLT art. 900',        0.70, 40),
 ('penal.prazo',            'Matéria penal: contagem em dias corridos',   'penal',       '.',                                   'Prazo penal',             'Conferir prazo (dias corridos)',        NULL,'corridos','CPP art. 798',      0.50, 90);

COMMIT;
