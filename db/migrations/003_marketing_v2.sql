-- Formulários do Marketing v2: 10 campos obrigatórios por formulário

-- Origem (manual ou integração) em todos os registros operacionais
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE manager_daily_closings ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';

-- Plataformas de tráfego atribuídas a cada pessoa em cada lançamento
ALTER TABLE launch_user_assignments ADD COLUMN IF NOT EXISTS plataformas TEXT[];

-- Tráfego: uma linha por plataforma
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS plataforma TEXT NOT NULL DEFAULT 'Meta Ads';
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS orcamento_dia NUMERIC(12,2);
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS impressoes INT;
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS cliques INT;
ALTER TABLE traffic_daily_entries ADD COLUMN IF NOT EXISTS tempo_carregamento NUMERIC(6,2);
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'traffic_daily_entries'::regclass AND contype = 'u'
     AND pg_get_constraintdef(oid) = 'UNIQUE (created_by, launch_id, data_ref)';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE traffic_daily_entries DROP CONSTRAINT %I', c); END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_trafego_plataforma ON traffic_daily_entries (data_ref, launch_id, created_by, plataforma);
CREATE INDEX IF NOT EXISTS idx_trafego_lanc_data ON traffic_daily_entries (launch_id, data_ref);

-- WhatsApp
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS grupos_ativos INT;
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS convites_entregues INT;
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS entradas_pagina INT;
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS saidas INT;
ALTER TABLE whatsapp_daily_entries ADD COLUMN IF NOT EXISTS problema_acao TEXT;
CREATE INDEX IF NOT EXISTS idx_whats_lanc_data ON whatsapp_daily_entries (launch_id, data_ref);

-- Automação: 9 etapas monitoradas
ALTER TABLE automation_daily_entries ALTER COLUMN captacao_ok DROP NOT NULL;
ALTER TABLE automation_daily_entries ALTER COLUMN onboarding_ok DROP NOT NULL;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS pagina_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS formulario_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS whatsapp_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS obrigado_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS boas_vindas_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS conta_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS grupo_ok BOOLEAN;
ALTER TABLE automation_daily_entries ADD COLUMN IF NOT EXISTS orientacao_ok BOOLEAN;
UPDATE automation_daily_entries SET
  pagina_ok = COALESCE(pagina_ok, captacao_ok), formulario_ok = COALESCE(formulario_ok, captacao_ok), whatsapp_ok = COALESCE(whatsapp_ok, captacao_ok),
  obrigado_ok = COALESCE(obrigado_ok, checkout_ok), boas_vindas_ok = COALESCE(boas_vindas_ok, onboarding_ok), conta_ok = COALESCE(conta_ok, onboarding_ok),
  grupo_ok = COALESCE(grupo_ok, onboarding_ok), orientacao_ok = COALESCE(orientacao_ok, onboarding_ok);

-- Incidentes: status em andamento e responsável
ALTER TABLE automation_incidents DROP CONSTRAINT IF EXISTS automation_incidents_status_check;
ALTER TABLE automation_incidents ADD CONSTRAINT automation_incidents_status_check CHECK (status IN ('aberto','em_andamento','resolvido'));
ALTER TABLE automation_incidents ADD COLUMN IF NOT EXISTS responsavel_id INT REFERENCES users(id);
ALTER TABLE automation_incidents ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMPTZ;

-- Editor
ALTER TABLE editor_daily_entries DROP CONSTRAINT IF EXISTS editor_daily_entries_situacao_check;
ALTER TABLE editor_daily_entries ADD CONSTRAINT editor_daily_entries_situacao_check CHECK (situacao IN ('nao_iniciado','em_producao','concluido','atrasado'));
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS solicitante TEXT;
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS prioridade TEXT;
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS quantidade_planejada INT;
ALTER TABLE editor_daily_entries ADD COLUMN IF NOT EXISTS prazo DATE;

-- Live
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS plataforma TEXT;
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS horario_previsto TIME;
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS horario_real TIME;
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS pessoas_pitch INT;
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS cliques_oferta INT;
ALTER TABLE live_results ADD COLUMN IF NOT EXISTS checkouts_iniciados INT;

-- Gerente: situação por área
ALTER TABLE manager_daily_closings ADD COLUMN IF NOT EXISTS sit_trafego TEXT;
ALTER TABLE manager_daily_closings ADD COLUMN IF NOT EXISTS sit_pagina TEXT;
ALTER TABLE manager_daily_closings ADD COLUMN IF NOT EXISTS sit_grupos TEXT;
ALTER TABLE manager_daily_closings ADD COLUMN IF NOT EXISTS sit_automacao TEXT;

CREATE INDEX IF NOT EXISTS idx_editor_lanc_data ON editor_daily_entries (launch_id, data_ref);
CREATE INDEX IF NOT EXISTS idx_live_lanc_data ON live_results (launch_id, data_ref);
CREATE INDEX IF NOT EXISTS idx_gerente_lanc_data ON manager_daily_closings (launch_id, data_ref);
