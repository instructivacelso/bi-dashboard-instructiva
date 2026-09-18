-- Time de Indicação: colaborador, pipeline de 13 estágios, formulário diário, metas e benefício escolhido

-- Pipeline com os 13 estágios do documento
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_etapa_check;
UPDATE referrals SET etapa = CASE etapa
  WHEN 'nova' THEN 'recebida' WHEN 'contatado' THEN 'contato_realizado' WHEN 'respondeu' THEN 'contato_realizado'
  WHEN 'conversa' THEN 'interesse' WHEN 'agendado' THEN 'interesse' WHEN 'proposta' THEN 'negociacao' ELSE etapa END;
UPDATE referrals SET etapa = 'invalida' WHERE validacao IN ('invalida','duplicada','telefone_incorreto','fora_perfil') AND etapa = 'recebida';
UPDATE referrals SET etapa = 'validada' WHERE validacao = 'valida' AND etapa = 'recebida';
ALTER TABLE referrals ALTER COLUMN etapa SET DEFAULT 'recebida';
ALTER TABLE referrals ADD CONSTRAINT referrals_etapa_check CHECK (etapa IN (
  'recebida','aguardando_contato','tentativa','contato_realizado','validada','interesse','encaminhada','negociacao','venda',
  'sem_resposta','sem_interesse','invalida','perdida'));

-- Dados do cadastro individual
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS uf TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS origem_indicacao TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS responsavel_id INT REFERENCES users(id);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS proximo_contato DATE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS proximo_passo TEXT;
UPDATE referrals SET responsavel_id = created_by WHERE responsavel_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_resp ON referrals (responsavel_id, etapa);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals (lower(email));

-- Benefício escolhido pelo aluno indicador
ALTER TABLE referral_benefits ADD COLUMN IF NOT EXISTS escolha TEXT;

-- Formulário diário do colaborador de indicação (10 campos)
CREATE TABLE IF NOT EXISTS referral_daily_forms (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  origens TEXT[] NOT NULL,
  origem_outra TEXT,
  recebidas INT NOT NULL CHECK (recebidas >= 0),
  trabalhados INT NOT NULL CHECK (trabalhados >= 0),
  responderam INT NOT NULL CHECK (responderam >= 0),
  validadas INT NOT NULL CHECK (validadas >= 0),
  followups INT NOT NULL CHECK (followups >= 0),
  encaminhadas INT NOT NULL CHECK (encaminhadas >= 0),
  vendas_qtd INT NOT NULL CHECK (vendas_qtd >= 0),
  vendas_valor NUMERIC(12,2) NOT NULL CHECK (vendas_valor >= 0),
  vendas JSONB,
  objecao TEXT, motivo_invalidas TEXT, motivo_perda TEXT, gargalo TEXT,
  precisa_ajuda BOOLEAN NOT NULL DEFAULT FALSE, ajuda_descricao TEXT, observacao TEXT,
  justificativa_data TEXT, justificativa_numeros TEXT,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo', origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);

-- Metas por colaborador
CREATE TABLE IF NOT EXISTS referral_goals (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  meta_trabalhados_dia INT, meta_validadas_dia INT, meta_validadas_semana INT, meta_vendas_mes INT, meta_receita_mes NUMERIC(12,2),
  updated_by INT REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prazos configuráveis dos alertas
INSERT INTO configuracoes (chave, valor) VALUES ('indicacao_prazo_primeiro_contato_h', '24'), ('indicacao_dias_parada', '3') ON CONFLICT DO NOTHING;

-- Subsetor "Coleta" vira "Colaborador de indicação" com formulário diário
UPDATE subdepartments s SET nome = 'Colaborador de indicação', formulario = 'indicacao_colaborador'
  FROM departments d WHERE d.id = s.department_id AND d.slug = 'indicacoes' AND s.slug = 'coleta';
