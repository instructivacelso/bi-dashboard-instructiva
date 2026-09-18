-- BI Dashboard Instructiva - estrutura inicial
-- Datas de referência (data_ref) são sempre o dia no fuso de Brasília.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,          -- superadmin, diretoria, gerente, colaborador, externo
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,                 -- ex.: dashboard.empresa, admin.usuarios
  UNIQUE (role_id, chave)
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  modulo_ativo BOOLEAN NOT NULL DEFAULT FALSE,  -- false = "Módulo em configuração"
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subdepartments (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  formulario TEXT,                     -- chave do formulário (trafego, whatsapp, automacao, editor, live, gerente)
  formulario_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (department_id, slug)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  cargo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token TEXT,
  reset_expira TIMESTAMPTZ,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_department_assignments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  subdepartment_id INT REFERENCES subdepartments(id) ON DELETE CASCADE,
  gerente BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_uda ON user_department_assignments
  (user_id, department_id, COALESCE(subdepartment_id, 0));

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,                      -- profissionalizante, técnico, pós-graduação
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS launches (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  product_id INT REFERENCES products(id),
  professor TEXT,
  gerente_id INT REFERENCES users(id),
  captacao_inicio DATE,
  captacao_fim DATE,
  data_live DATE,
  live_liberada BOOLEAN NOT NULL DEFAULT FALSE,
  vendas_inicio DATE,
  vendas_fim DATE,
  orcamento NUMERIC(12,2),
  meta_cadastros INT,
  meta_grupos INT,
  meta_live INT,
  meta_lista INT,
  meta_vendas INT,
  meta_faturamento NUMERIC(12,2),
  cpl_max NUMERIC(10,2),
  cac_max NUMERIC(10,2),
  roas_min NUMERIC(10,2),
  link_pagina TEXT,
  link_grupo TEXT,
  link_live TEXT,
  link_checkout TEXT,
  status TEXT NOT NULL DEFAULT 'planejamento'
    CHECK (status IN ('planejamento','captacao','evento','vendas','encerrado','cancelado')),
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS launch_user_assignments (
  id SERIAL PRIMARY KEY,
  launch_id INT NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (launch_id, user_id)
);

-- Colunas comuns a todos os registros operacionais
-- (id, data_ref, launch_id, status, created_by, updated_by, created_at, updated_at)

CREATE TABLE IF NOT EXISTS traffic_daily_entries (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  valor_gasto NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0),
  visitas INT NOT NULL CHECK (visitas >= 0),
  cadastros INT NOT NULL CHECK (cadastros >= 0),
  houve_problema BOOLEAN NOT NULL DEFAULT FALSE,
  problema_descricao TEXT,
  problema_acao TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, launch_id, data_ref)
);

CREATE TABLE IF NOT EXISTS whatsapp_daily_entries (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  convites_api INT NOT NULL CHECK (convites_api >= 0),
  entradas_api INT NOT NULL CHECK (entradas_api >= 0),
  entradas_organico INT NOT NULL CHECK (entradas_organico >= 0),
  total_grupos INT NOT NULL CHECK (total_grupos >= 0),
  custo_disparos NUMERIC(12,2),
  houve_problema BOOLEAN NOT NULL DEFAULT FALSE,
  problema_descricao TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, launch_id, data_ref)
);

CREATE TABLE IF NOT EXISTS automation_daily_entries (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  captacao_ok BOOLEAN NOT NULL,        -- página, formulário e entrada no WhatsApp
  checkout_ok BOOLEAN NOT NULL,        -- checkout e confirmação de compra
  onboarding_ok BOOLEAN NOT NULL,      -- onboarding dos compradores
  houve_problema BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, launch_id, data_ref)
);

CREATE TABLE IF NOT EXISTS automation_incidents (
  id SERIAL PRIMARY KEY,
  entry_id INT REFERENCES automation_daily_entries(id) ON DELETE SET NULL,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  etapa TEXT NOT NULL,
  afetados INT,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  previsao_solucao DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido')),
  resolvido_em TIMESTAMPTZ,
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preparado para integrações futuras (n8n / webhooks). Não é preenchido manualmente.
CREATE TABLE IF NOT EXISTS onboarding_events (
  id SERIAL PRIMARY KEY,
  launch_id INT REFERENCES launches(id),
  origem TEXT,                         -- hotmart, tmb, greenn, n8n
  transacao TEXT,
  etapa TEXT NOT NULL,                 -- compra_aprovada, boas_vindas, conta_liberada, entrou_grupo, concluido, falha
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  dados JSONB
);

CREATE TABLE IF NOT EXISTS editor_daily_entries (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  tipo_entrega TEXT NOT NULL CHECK (tipo_entrega IN ('criativo','aula','vsl','reels','corte','outro')),
  quantidade INT NOT NULL CHECK (quantidade >= 0),
  situacao TEXT NOT NULL CHECK (situacao IN ('concluido','em_producao','atrasado')),
  entrega TEXT NOT NULL,
  motivo_atraso TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, launch_id, data_ref)
);

CREATE TABLE IF NOT EXISTS live_results (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  participantes_unicos INT NOT NULL CHECK (participantes_unicos >= 0),
  lista_reserva INT NOT NULL CHECK (lista_reserva >= 0),
  problema_tecnico BOOLEAN NOT NULL DEFAULT FALSE,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (launch_id, data_ref)
);

CREATE TABLE IF NOT EXISTS manager_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  situacao TEXT NOT NULL CHECK (situacao IN ('verde','amarelo','vermelho')),
  gargalo TEXT,
  acao TEXT,
  responsavel_id INT REFERENCES users(id),
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, launch_id, data_ref)
);

-- Vendas e faturamento por lançamento. Manual (perfil autorizado) até existir integração.
CREATE TABLE IF NOT EXISTS commercial_launch_results (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT NOT NULL REFERENCES launches(id),
  vendas INT NOT NULL CHECK (vendas >= 0),
  faturamento NUMERIC(12,2) NOT NULL CHECK (faturamento >= 0),
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (launch_id, data_ref, origem)
);

CREATE TABLE IF NOT EXISTS action_items (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  launch_id INT REFERENCES launches(id),
  origem TEXT NOT NULL,                -- gerente, trafego, whatsapp, editor, live
  origem_id INT,
  gargalo TEXT,
  acao TEXT NOT NULL,
  responsavel_id INT REFERENCES users(id),
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','concluida','cancelada')),
  concluida_em TIMESTAMPTZ,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_origem ON action_items (origem, origem_id) WHERE origem_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  acao TEXT NOT NULL,                  -- criar, editar, excluir, login, corrigir
  entidade TEXT NOT NULL,
  entidade_id INT,
  antes JSONB,
  depois JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_logs (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_data ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  nome TEXT PRIMARY KEY,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
