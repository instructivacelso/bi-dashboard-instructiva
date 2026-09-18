-- Módulo Indicação: campanhas, convites, indicações, benefícios e fechamento do gerente

UPDATE departments SET modulo_ativo = TRUE WHERE slug = 'indicacoes';

CREATE TABLE IF NOT EXISTS referral_campaigns (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  product_id INT REFERENCES products(id),
  qtd_por_beneficio INT NOT NULL DEFAULT 5 CHECK (qtd_por_beneficio > 0),
  beneficio_tipo TEXT NOT NULL CHECK (beneficio_tipo IN ('bonus_curso','cashback','apostila','outro')),
  beneficio_descricao TEXT NOT NULL,
  beneficio_valor NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (beneficio_valor >= 0),
  gera_sorteio BOOLEAN NOT NULL DEFAULT FALSE,
  meta_diaria_indicacoes INT, meta_diaria_vendas INT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','encerrada')),
  created_by INT REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_invitations (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES referral_campaigns(id),
  student_id INT NOT NULL REFERENCES students(id),
  resposta TEXT NOT NULL CHECK (resposta IN ('aceitou','recusou','sem_resposta')),
  produto_origem_id INT REFERENCES products(id),
  convidado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_inv_data ON referral_invitations (convidado_em);

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES referral_campaigns(id),
  referrer_id INT NOT NULL REFERENCES students(id),          -- aluno indicador
  nome TEXT NOT NULL,
  telefone TEXT,                                              -- normalizado (+55...)
  telefone_digitado TEXT NOT NULL,
  interesse_product_id INT REFERENCES products(id),
  aviso TEXT NOT NULL CHECK (aviso IN ('avisado','nao_confirmado','autorizado','bloqueado')),
  validacao TEXT NOT NULL DEFAULT 'pendente' CHECK (validacao IN ('pendente','valida','invalida','duplicada','telefone_incorreto','fora_perfil')),
  motivo_invalidacao TEXT,
  validado_em TIMESTAMPTZ,
  vendedor_id INT REFERENCES users(id),
  distribuido_em TIMESTAMPTZ,
  etapa TEXT NOT NULL DEFAULT 'nova' CHECK (etapa IN ('nova','contatado','respondeu','conversa','agendado','proposta','venda','perdida','sem_interesse')),
  primeiro_contato_em TIMESTAMPTZ,
  tentativas INT NOT NULL DEFAULT 0,
  venda_valor NUMERIC(12,2), venda_pagamento TEXT, venda_status TEXT, venda_em TIMESTAMPTZ, venda_product_id INT REFERENCES products(id),
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_tel ON referrals (telefone);
CREATE INDEX IF NOT EXISTS idx_referrals_vend ON referrals (vendedor_id, etapa);
CREATE INDEX IF NOT EXISTS idx_referrals_criado ON referrals (created_at);

CREATE TABLE IF NOT EXISTS referral_events (
  id BIGSERIAL PRIMARY KEY,
  referral_id INT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  evento TEXT NOT NULL,         -- criada, validada, distribuida, tentativa, contato, resposta, conversa, agendado, proposta, venda, perdida, bloqueada
  de TEXT, para TEXT, detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_events ON referral_events (evento, created_at);

CREATE SEQUENCE IF NOT EXISTS referral_sorteio_seq;
CREATE TABLE IF NOT EXISTS referral_benefits (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES referral_campaigns(id),
  referrer_id INT NOT NULL REFERENCES students(id),
  marco INT NOT NULL,                  -- 1º, 2º... benefício do aluno na campanha
  tipo TEXT NOT NULL, descricao TEXT NOT NULL, valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  numero_sorteio INT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','entregue','cancelado')),
  excepcional BOOLEAN NOT NULL DEFAULT FALSE, justificativa TEXT,
  aprovado_por INT REFERENCES users(id), aprovado_em TIMESTAMPTZ, entregue_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, referrer_id, marco)
);

CREATE TABLE IF NOT EXISTS referral_manager_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  numeros JSONB NOT NULL,
  campanhas INT[] NOT NULL, produto_principal TEXT NOT NULL, equipe_envolvida TEXT NOT NULL,
  meta_indicacoes INT NOT NULL CHECK (meta_indicacoes >= 0), meta_vendas INT NOT NULL CHECK (meta_vendas >= 0), situacao_campanha TEXT NOT NULL,
  convites_conferidos BOOLEAN NOT NULL, convites_divergencia TEXT, classificacao_convites TEXT NOT NULL, causa_convites TEXT, acao_convites TEXT,
  motivo_invalidacao TEXT NOT NULL, problema_qualidade TEXT NOT NULL, acao_qualidade TEXT NOT NULL,
  problema_privacidade BOOLEAN NOT NULL, acao_privacidade TEXT NOT NULL, ajuste_mensagem TEXT NOT NULL,
  problema_atendimento TEXT NOT NULL, qtd_priorizar INT NOT NULL CHECK (qtd_priorizar >= 0), acao_recuperacao TEXT NOT NULL,
  vendas_corretas BOOLEAN NOT NULL, vendas_divergencia TEXT, vendas_origem TEXT, vendas_acao TEXT,
  etapa_maior_quebra TEXT NOT NULL, motivo_quebra TEXT NOT NULL, acao_conversao TEXT NOT NULL,
  feedbacks_qtd INT NOT NULL CHECK (feedbacks_qtd >= 0), feedbacks JSONB, reconhecimento TEXT NOT NULL, acao_acompanhamento TEXT NOT NULL, redistribuicao TEXT NOT NULL,
  beneficios_atrasados BOOLEAN NOT NULL, pendencia_beneficio TEXT, responsavel_beneficio TEXT, prazo_beneficio DATE,
  beneficio_excepcional BOOLEAN NOT NULL, justificativa_excepcional TEXT, aprovacao_excepcional TEXT,
  reuniao_realizada BOOLEAN NOT NULL, reuniao_tema TEXT, reuniao_assuntos TEXT, reuniao_motivo TEXT, reuniao_compensacao TEXT,
  objecoes TEXT[] NOT NULL, gargalo TEXT NOT NULL, etapa_afetada TEXT NOT NULL, acao TEXT NOT NULL,
  responsavel_id INT NOT NULL REFERENCES users(id), prazo DATE NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo', origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);
INSERT INTO configuracoes (chave, valor) VALUES ('indicacao_horario_limite', '19:00') ON CONFLICT DO NOTHING;
