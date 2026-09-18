-- Módulo Comercial: vendedor e gerente comercial (Jesuítas e Toledo)

UPDATE departments SET modulo_ativo = TRUE WHERE slug IN ('comercial-jesuitas', 'comercial-toledo', 'comercial-diretoria');
UPDATE subdepartments s SET formulario = 'vendedor'
  FROM departments d WHERE d.id = s.department_id AND d.slug IN ('comercial-jesuitas', 'comercial-toledo') AND s.slug = 'vendedores';
UPDATE subdepartments s SET formulario = 'gerente_comercial'
  FROM departments d WHERE d.id = s.department_id AND d.slug IN ('comercial-jesuitas', 'comercial-toledo') AND s.slug = 'gerente';

-- Configurações simples (horário-limite etc.)
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO configuracoes (chave, valor) VALUES ('comercial_horario_limite', '19:00') ON CONFLICT DO NOTHING;

-- Metas por vendedor (R$)
CREATE TABLE IF NOT EXISTS seller_goals (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  meta_diaria NUMERIC(12,2),
  meta_semanal NUMERIC(12,2),
  meta_mensal NUMERIC(12,2),
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fechamento diário do vendedor
CREATE TABLE IF NOT EXISTS seller_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  department_id INT NOT NULL REFERENCES departments(id),
  funis TEXT[] NOT NULL,
  produtos INT[] NOT NULL,
  leads_recebidos INT NOT NULL CHECK (leads_recebidos >= 0),
  pipeline_qtd INT NOT NULL CHECK (pipeline_qtd >= 0),
  pipeline_valor NUMERIC(14,2) NOT NULL CHECK (pipeline_valor >= 0),
  negociacao_qtd INT NOT NULL CHECK (negociacao_qtd >= 0),
  negociacao_valor NUMERIC(14,2) NOT NULL CHECK (negociacao_valor >= 0),
  fechamento_qtd INT NOT NULL CHECK (fechamento_qtd >= 0),
  fechamento_valor NUMERIC(14,2) NOT NULL CHECK (fechamento_valor >= 0),
  ligacoes INT NOT NULL CHECK (ligacoes >= 0),
  followups INT NOT NULL CHECK (followups >= 0),
  agendamentos INT NOT NULL CHECK (agendamentos >= 0),
  houve_venda BOOLEAN NOT NULL,
  motivo_sem_venda TEXT,
  justificativa_pipeline TEXT,
  dificuldade TEXT NOT NULL,
  prioridade_amanha TEXT NOT NULL,
  observacao TEXT NOT NULL,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo' CHECK (pontualidade IN ('no_prazo', 'atrasado')),
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);
CREATE INDEX IF NOT EXISTS idx_seller_closing_dep_data ON seller_daily_closings (department_id, data_ref);

-- Vendas (uma linha por venda)
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  closing_id INT REFERENCES seller_daily_closings(id) ON DELETE SET NULL,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  department_id INT NOT NULL REFERENCES departments(id),
  product_id INT NOT NULL REFERENCES products(id),
  funil TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('cartao', 'pix', 'boleto')),
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL CHECK (status IN ('aprovada', 'boleto_gerado', 'aguardando', 'pago', 'cancelada')),
  identificador TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_identificador ON sales (lower(identificador)) WHERE identificador IS NOT NULL AND status <> 'cancelada';
CREATE INDEX IF NOT EXISTS idx_sales_dep_data ON sales (department_id, data_ref);
CREATE INDEX IF NOT EXISTS idx_sales_user_data ON sales (user_id, data_ref);

CREATE TABLE IF NOT EXISTS sale_status_history (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  de TEXT,
  para TEXT NOT NULL,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fechamento diário do gerente comercial
CREATE TABLE IF NOT EXISTS commercial_manager_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  department_id INT NOT NULL REFERENCES departments(id),
  operacoes TEXT[] NOT NULL,
  numeros_conferidos BOOLEAN NOT NULL,
  divergencia_descricao TEXT, divergencia_origem TEXT, divergencia_acao TEXT,
  disparos_valor NUMERIC(12,2) NOT NULL CHECK (disparos_valor >= 0),
  mensagens_enviadas INT NOT NULL CHECK (mensagens_enviadas >= 0),
  mensagens_entregues INT NOT NULL CHECK (mensagens_entregues >= 0),
  respostas INT NOT NULL CHECK (respostas >= 0),
  campanha_disparo TEXT NOT NULL,
  conversao_classificacao TEXT NOT NULL,
  conversao_justificativa TEXT,
  destaque_positivo TEXT NOT NULL,
  acao_acompanhamento TEXT NOT NULL,
  feedbacks_qtd INT NOT NULL CHECK (feedbacks_qtd >= 0),
  feedback_individual BOOLEAN NOT NULL,
  feedback_coletivo BOOLEAN NOT NULL,
  feedback_motivo TEXT,
  reuniao_realizada BOOLEAN NOT NULL,
  reuniao_temas TEXT[], reuniao_assuntos TEXT, reuniao_decisoes TEXT, reuniao_pendencias TEXT,
  reuniao_motivo TEXT, reuniao_compensacao TEXT,
  motivacao_houve BOOLEAN NOT NULL,
  motivacao_tipo TEXT, motivacao_publico TEXT, motivacao_objetivo TEXT, motivacao_resultado TEXT,
  motivacao_motivo TEXT, motivacao_proxima TEXT,
  objecoes TEXT[] NOT NULL,
  gargalo TEXT NOT NULL, etapa_afetada TEXT NOT NULL, impacto TEXT NOT NULL, acao TEXT NOT NULL,
  responsavel_id INT NOT NULL REFERENCES users(id), prazo DATE NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo' CHECK (pontualidade IN ('no_prazo', 'atrasado')),
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'enviado',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id, data_ref)
);

CREATE TABLE IF NOT EXISTS commercial_manager_feedbacks (
  id SERIAL PRIMARY KEY,
  closing_id INT NOT NULL REFERENCES commercial_manager_closings(id) ON DELETE CASCADE,
  alvo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('reconhecimento', 'correcao', 'desenvolvimento', 'alinhamento')),
  tema TEXT NOT NULL,
  acao TEXT NOT NULL,
  acompanhamento DATE NOT NULL
);

-- Ações corretivas: "atrasada" passa a existir como status calculado; aceita origem comercial
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS department_id INT REFERENCES departments(id);
