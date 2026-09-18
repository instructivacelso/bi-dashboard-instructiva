-- Módulo Suporte: tickets, SLA, fechamento do atendente e do gerente

UPDATE departments SET modulo_ativo = TRUE WHERE slug = 'suporte';

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_email ON students (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_telefone ON students (telefone) WHERE telefone IS NOT NULL;

-- SLA por prioridade (minutos para 1ª resposta, horas para solução)
CREATE TABLE IF NOT EXISTS support_sla (
  prioridade TEXT PRIMARY KEY CHECK (prioridade IN ('baixa','normal','alta','critica')),
  resposta_min INT NOT NULL CHECK (resposta_min > 0),
  solucao_horas INT NOT NULL CHECK (solucao_horas > 0),
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO support_sla (prioridade, resposta_min, solucao_horas) VALUES
  ('baixa', 480, 72), ('normal', 240, 48), ('alta', 60, 24), ('critica', 15, 4)
ON CONFLICT DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS support_protocolo_seq;

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  student_id INT NOT NULL REFERENCES students(id),
  product_id INT REFERENCES products(id),           -- NULL = atendimento geral
  canal TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','normal','alta','critica')),
  status TEXT NOT NULL CHECK (status IN ('novo','em_atendimento','aguardando_aluno','aguardando_setor','resolvido','encerrado','reaberto')),
  acao_realizada TEXT NOT NULL,
  encaminhamento TEXT NOT NULL DEFAULT 'suporte',
  enc_responsavel TEXT, enc_motivo TEXT, enc_prazo TIMESTAMPTZ, enc_em TIMESTAMPTZ,
  solucao TEXT, aluno_confirmou BOOLEAN, satisfacao INT CHECK (satisfacao BETWEEN 1 AND 5),
  proxima_acao TEXT, prox_responsavel TEXT, prox_prazo DATE, prox_contato DATE,
  responsavel_id INT NOT NULL REFERENCES users(id),
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  primeira_resposta_em TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  encerrado_em TIMESTAMPTZ,
  reaberturas INT NOT NULL DEFAULT 0,
  sla_resposta_limite TIMESTAMPTZ NOT NULL,
  sla_solucao_limite TIMESTAMPTZ NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_resp_status ON support_tickets (responsavel_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_aberto ON support_tickets (aberto_em);

-- Linha do tempo (imutável)
CREATE TABLE IF NOT EXISTS support_ticket_events (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  evento TEXT NOT NULL,          -- aberto, atualizado, status, primeira_resposta, encaminhado, retorno, resolvido, encerrado, reaberto
  de TEXT, para TEXT, detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_events ON support_ticket_events (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_events_user ON support_ticket_events (user_id, created_at);

-- Fechamento diário do atendente
CREATE TABLE IF NOT EXISTS support_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  turno TEXT NOT NULL,
  numeros JSONB NOT NULL,                 -- fotografia dos números automáticos no envio
  confere_recebidos BOOLEAN NOT NULL, divergencia_recebidos TEXT,
  confere_trabalhados BOOLEAN NOT NULL, divergencia_trabalhados TEXT,
  classificacao TEXT NOT NULL,
  justificativa_backlog TEXT,
  motivo_atraso_sla TEXT,
  problema_recorrente TEXT NOT NULL, curso_afetado TEXT NOT NULL, causa TEXT NOT NULL, prevencao TEXT NOT NULL,
  encaminhamento_critico TEXT NOT NULL,
  caso_critico BOOLEAN NOT NULL, reclamacao_grave BOOLEAN NOT NULL, risco_cancelamento BOOLEAN NOT NULL, aluno_sem_resposta BOOLEAN NOT NULL,
  aval_positivas INT NOT NULL CHECK (aval_positivas >= 0), aval_negativas INT NOT NULL CHECK (aval_negativas >= 0),
  casos JSONB,
  dificuldade TEXT NOT NULL, melhoria TEXT NOT NULL, acao_amanha TEXT NOT NULL,
  responsavel_id INT NOT NULL REFERENCES users(id), prazo DATE NOT NULL, observacao TEXT NOT NULL,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo',
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);

-- Fechamento diário do gerente de Suporte
CREATE TABLE IF NOT EXISTS support_manager_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  numeros JSONB NOT NULL,
  cobertura_suficiente BOOLEAN NOT NULL, ausencia_sobrecarga BOOLEAN NOT NULL, ajuste_distribuicao TEXT NOT NULL,
  impacto_cobertura TEXT, acao_cobertura TEXT,
  numeros_corretos BOOLEAN NOT NULL, divergencia TEXT, responsavel_correcao TEXT,
  classificacao_sla TEXT NOT NULL, causa_sla TEXT, acao_sla TEXT,
  motivo_backlog TEXT NOT NULL, qtd_priorizar INT NOT NULL CHECK (qtd_priorizar >= 0), estrategia_backlog TEXT NOT NULL, responsavel_backlog TEXT NOT NULL,
  motivo_insatisfacao TEXT NOT NULL, atendimento_revisao TEXT NOT NULL, acao_qualidade TEXT NOT NULL,
  problema_recorrente TEXT NOT NULL, curso_afetado TEXT NOT NULL, causa_provavel TEXT NOT NULL, setor_causa TEXT NOT NULL,
  sugestao_preventiva TEXT NOT NULL, prioridade_recorrente TEXT NOT NULL,
  casos_qtd INT NOT NULL CHECK (casos_qtd >= 0), casos JSONB,
  reconhecimento TEXT NOT NULL, acao_acompanhamento TEXT NOT NULL, redistribuicao TEXT NOT NULL,
  feedbacks_qtd INT NOT NULL CHECK (feedbacks_qtd >= 0), feedbacks JSONB, motivo_sem_feedback TEXT,
  reuniao_realizada BOOLEAN NOT NULL, reuniao_tema TEXT, reuniao_assuntos TEXT, reuniao_decisoes TEXT, reuniao_justificativa TEXT,
  treinamento BOOLEAN NOT NULL, treinamento_tema TEXT, proximo_acompanhamento DATE NOT NULL,
  gargalo TEXT NOT NULL, etapa_afetada TEXT NOT NULL, setor_envolvido TEXT NOT NULL, impacto TEXT NOT NULL, acao TEXT NOT NULL,
  responsavel_id INT NOT NULL REFERENCES users(id), prazo DATE NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo',
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);
INSERT INTO configuracoes (chave, valor) VALUES ('suporte_horario_limite', '19:00') ON CONFLICT DO NOTHING;
