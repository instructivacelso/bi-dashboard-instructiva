-- Módulo Pós-venda — Etapa 1 (retenção e renovação: onboarding, acompanhamento, renovações, cancelamentos, upsell, satisfação e inadimplência)

CREATE TABLE IF NOT EXISTS posvenda_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  unidade TEXT,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('rascunho','enviado','conferido')),
  -- Onboarding de novos alunos
  sem_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  novos_alunos INT NOT NULL DEFAULT 0, onboarding_concluidos INT NOT NULL DEFAULT 0,
  -- Acompanhamento
  sem_acompanhamento BOOLEAN NOT NULL DEFAULT FALSE,
  contatos INT NOT NULL DEFAULT 0, alunos_risco INT NOT NULL DEFAULT 0,
  -- Renovações
  sem_renovacoes BOOLEAN NOT NULL DEFAULT FALSE,
  renov_vencendo INT NOT NULL DEFAULT 0, renov_feitas INT NOT NULL DEFAULT 0, renov_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Cancelamentos / churn
  sem_cancelamentos BOOLEAN NOT NULL DEFAULT FALSE,
  cancelamentos INT NOT NULL DEFAULT 0, cancel_motivo TEXT,
  -- Upsell / cross-sell
  sem_upsell BOOLEAN NOT NULL DEFAULT FALSE,
  upsell_ofertas INT NOT NULL DEFAULT 0, upsell_vendas INT NOT NULL DEFAULT 0, upsell_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Satisfação (NPS)
  sem_satisfacao BOOLEAN NOT NULL DEFAULT FALSE,
  nps_respostas INT NOT NULL DEFAULT 0, nps_promotores INT NOT NULL DEFAULT 0, nps_neutros INT NOT NULL DEFAULT 0, nps_detratores INT NOT NULL DEFAULT 0,
  -- Inadimplência de renovação
  sem_inadimplencia BOOLEAN NOT NULL DEFAULT FALSE,
  inad_alunos INT NOT NULL DEFAULT 0, inad_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Riscos
  risco TEXT, plano TEXT, prazo DATE, observacao TEXT,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo', justificativa_data TEXT,
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);

UPDATE departments SET modulo_ativo = TRUE, descricao = 'Retenção e renovação: onboarding, acompanhamento, renovações, cancelamentos, upsell e satisfação do aluno depois da compra.' WHERE slug = 'pos-venda';
INSERT INTO subdepartments (department_id, nome, slug, formulario, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Operação de pós-venda', 'operacao', 'posvenda_fechamento', 1, TRUE, TRUE FROM departments d WHERE d.slug = 'pos-venda' ON CONFLICT DO NOTHING;
INSERT INTO subdepartments (department_id, nome, slug, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Gerente de pós-venda', 'gerencia', 2, TRUE, TRUE FROM departments d WHERE d.slug = 'pos-venda' ON CONFLICT DO NOTHING;

INSERT INTO configuracoes (chave, valor) VALUES
  ('posvenda_horario_limite', '19:00'), ('posvenda_meta_renovacao', '85'), ('posvenda_meta_nps', '50')
  ON CONFLICT DO NOTHING;
