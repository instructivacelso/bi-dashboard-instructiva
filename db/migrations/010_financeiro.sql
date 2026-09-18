-- Módulo Financeiro — Etapa 1 (caixa do dia a dia, blocos 1 a 10)
-- Dinheiro sempre em NUMERIC(14,2). Saldo bancário é "estoque" (último valor por conta), nunca soma de saldos diários.

-- ---------- Cadastros ----------
CREATE TABLE IF NOT EXISTS fin_accounts (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  instituicao TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','aplicacao','carteira','caixa')),
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fin_categories (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN ('entrada','saida')),
  grupo TEXT NOT NULL DEFAULT 'outra' CHECK (grupo IN ('receita','custo_variavel','custo_fixo','pessoal','imposto','marketing','divida','outra')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS fin_cost_centers (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS fin_suppliers (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Compromissos recorrentes mensais (bloco 9, alimentam a projeção de caixa)
CREATE TABLE IF NOT EXISTS fin_recurring (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  category_id INT REFERENCES fin_categories(id),
  cost_center_id INT REFERENCES fin_cost_centers(id),
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Fechamento diário (bloco 1 + snapshots dos blocos 5, 8 e 10) ----------
CREATE TABLE IF NOT EXISTS fin_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando_conciliacao','conferido','fechado')),
  -- Bloco 5: contas a receber (snapshot por faixa)
  receber_hoje NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_7 NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_mes NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_30 NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_60 NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_90 NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_mais90 NUMERIC(14,2) NOT NULL DEFAULT 0,
  receber_vencido NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Bloco 8: inadimplência por faixa de atraso
  inad_clientes INT NOT NULL DEFAULT 0,
  inad_1_7 NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_8_30 NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_31_60 NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_61_90 NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_mais90 NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_recuperado NUMERIC(14,2) NOT NULL DEFAULT 0,
  inad_acordos INT NOT NULL DEFAULT 0,
  -- Bloco 10: conciliação e previsão
  bancos_conciliados BOOLEAN NOT NULL DEFAULT FALSE,
  plataformas_conciliadas BOOLEAN NOT NULL DEFAULT FALSE,
  divergencia_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  divergencia_motivo TEXT,
  divergencia_acao TEXT,
  divergencia_responsavel_id INT REFERENCES users(id),
  divergencia_prazo DATE,
  risco TEXT,
  -- metadados
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo',
  justificativa_data TEXT,
  observacao TEXT,
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  fechado_por INT REFERENCES users(id),
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bloco 2: saldo por conta no dia (estoque)
CREATE TABLE IF NOT EXISTS fin_closing_balances (
  id SERIAL PRIMARY KEY,
  closing_id INT NOT NULL REFERENCES fin_daily_closings(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES fin_accounts(id),
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  entradas NUMERIC(14,2) NOT NULL DEFAULT 0,
  saidas NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_final NUMERIC(14,2) NOT NULL DEFAULT 0,
  bloqueado NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (closing_id, account_id)
);

-- Bloco 3: entradas efetivamente recebidas no dia (fluxo)
CREATE TABLE IF NOT EXISTS fin_entries (
  id SERIAL PRIMARY KEY,
  closing_id INT NOT NULL REFERENCES fin_daily_closings(id) ON DELETE CASCADE,
  data_ref DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pix','cartao','boleto','recorrencia','transferencia','recuperacao','outra')),
  origem TEXT,
  product_id INT REFERENCES products(id),
  cliente TEXT,
  valor_bruto NUMERIC(14,2) NOT NULL CHECK (valor_bruto >= 0),
  taxa NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (taxa >= 0),
  valor_liquido NUMERIC(14,2) NOT NULL CHECK (valor_liquido >= 0),
  account_id INT REFERENCES fin_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bloco 6: contas pagas e a pagar (fluxo de saída + agenda)
CREATE TABLE IF NOT EXISTS fin_payments (
  id SERIAL PRIMARY KEY,
  closing_id INT REFERENCES fin_daily_closings(id) ON DELETE SET NULL,
  data_ref DATE NOT NULL,
  supplier_id INT REFERENCES fin_suppliers(id),
  descricao TEXT NOT NULL,
  category_id INT REFERENCES fin_categories(id),
  cost_center_id INT REFERENCES fin_cost_centers(id),
  product_id INT REFERENCES products(id),
  valor_previsto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  valor_pago NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  vencimento DATE,
  pago_em DATE,
  account_id INT REFERENCES fin_accounts(id),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix','cartao','boleto','transferencia','dinheiro','outra')),
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','aprovado','pago','vencido','renegociado','cancelado')),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_payments_venc ON fin_payments (vencimento) WHERE status IN ('previsto','aprovado','vencido','renegociado');
CREATE INDEX IF NOT EXISTS idx_fin_entries_closing ON fin_entries (closing_id);

-- ---------- Estrutura de setor ----------
UPDATE departments SET modulo_ativo = TRUE, descricao = 'Caixa do dia: saldos, entradas, contas a pagar e a receber, inadimplência e projeção de caixa.' WHERE slug = 'financeiro';

INSERT INTO subdepartments (department_id, nome, slug, formulario, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Operação financeira', 'operacao', 'financeiro_fechamento', 1, TRUE, TRUE FROM departments d WHERE d.slug = 'financeiro'
  ON CONFLICT DO NOTHING;
INSERT INTO subdepartments (department_id, nome, slug, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Gerente financeiro', 'gerencia', 2, TRUE, TRUE FROM departments d WHERE d.slug = 'financeiro'
  ON CONFLICT DO NOTHING;

-- Configurações
INSERT INTO configuracoes (chave, valor) VALUES
  ('financeiro_horario_limite', '19:00'),
  ('financeiro_prob_boleto', '80'),
  ('financeiro_prob_inadimplencia', '30')
  ON CONFLICT DO NOTHING;
