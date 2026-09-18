-- Módulo Professores e Acadêmico — Etapa 1 (produtividade diária, pipeline de conteúdo, metas)

CREATE TABLE IF NOT EXISTS academic_teachers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  nome TEXT NOT NULL,
  especialidade TEXT,
  unidade TEXT,
  gestor_id INT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','afastado','inativo')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Formulário diário dinâmico (blocos por atividade; cada bloco pode ficar zerado)
CREATE TABLE IF NOT EXISTS academic_daily_forms (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  unidade TEXT,
  horas NUMERIC(6,2) NOT NULL DEFAULT 0,
  atividades TEXT[] NOT NULL DEFAULT '{}',
  entrega_principal TEXT,
  dificuldade TEXT,
  prioridade TEXT,
  -- Gravação de aulas
  grav_aulas INT NOT NULL DEFAULT 0, grav_minutos NUMERIC(8,2) NOT NULL DEFAULT 0, grav_tempo NUMERIC(8,2) NOT NULL DEFAULT 0,
  grav_publicadas INT NOT NULL DEFAULT 0, grav_regravadas INT NOT NULL DEFAULT 0,
  -- Criativos
  criativos_produzidos INT NOT NULL DEFAULT 0, criativos_aprovados INT NOT NULL DEFAULT 0, criativos_publicados INT NOT NULL DEFAULT 0, criativos_refacao INT NOT NULL DEFAULT 0,
  -- Materiais
  mat_paginas_novas INT NOT NULL DEFAULT 0, mat_paginas_revisadas INT NOT NULL DEFAULT 0, mat_exercicios INT NOT NULL DEFAULT 0, mat_concluidos INT NOT NULL DEFAULT 0,
  -- Suporte
  sup_alunos INT NOT NULL DEFAULT 0, sup_chamados INT NOT NULL DEFAULT 0, sup_resolvidos INT NOT NULL DEFAULT 0, sup_primeiro INT NOT NULL DEFAULT 0, sup_pendentes INT NOT NULL DEFAULT 0,
  -- Lives
  live_realizadas INT NOT NULL DEFAULT 0, live_inscritos INT NOT NULL DEFAULT 0, live_presentes INT NOT NULL DEFAULT 0, live_leads INT NOT NULL DEFAULT 0, live_vendas INT NOT NULL DEFAULT 0, live_receita NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Vendas do professor
  vnd_leads INT NOT NULL DEFAULT 0, vnd_followups INT NOT NULL DEFAULT 0, vnd_qtd INT NOT NULL DEFAULT 0, vnd_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  vnd_pix NUMERIC(14,2) NOT NULL DEFAULT 0, vnd_cartao NUMERIC(14,2) NOT NULL DEFAULT 0, vnd_boleto NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Planejamento / reuniões
  plan_reunioes INT NOT NULL DEFAULT 0, plan_decisao TEXT,
  observacao TEXT,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo', justificativa_data TEXT,
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);

-- Pipeline de produção de conteúdo (Kanban, 12 estágios)
CREATE TABLE IF NOT EXISTS academic_content (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  product_id INT REFERENCES products(id),
  curso TEXT,
  tipo TEXT,
  etapa TEXT NOT NULL DEFAULT 'ideia' CHECK (etapa IN ('ideia','pesquisa','roteiro','preparacao','gravacao','edicao','revisao','ajustes','aprovacao','publicacao','atualizacao','arquivado')),
  responsavel_id INT REFERENCES users(id),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  prazo DATE,
  link TEXT,
  observacao TEXT,
  created_by INT REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_academic_content_etapa ON academic_content (etapa);

-- Histórico de mudanças de etapa
CREATE TABLE IF NOT EXISTS academic_content_events (
  id SERIAL PRIMARY KEY,
  content_id INT NOT NULL REFERENCES academic_content(id) ON DELETE CASCADE,
  de TEXT, para TEXT NOT NULL, user_id INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metas por professor
CREATE TABLE IF NOT EXISTS academic_goals (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  meta_aulas_mes INT, meta_criativos_mes INT, meta_paginas_mes INT, meta_lives_mes INT, meta_receita_mes NUMERIC(14,2), meta_entrega_prazo INT,
  updated_by INT REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE departments SET modulo_ativo = TRUE, descricao = 'Produtividade dos professores: gravações, criativos, materiais, suporte, lives, vendas e pipeline de conteúdo.' WHERE slug = 'academico';
INSERT INTO subdepartments (department_id, nome, slug, formulario, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Professores', 'professores', 'professor_diario', 1, TRUE, TRUE FROM departments d WHERE d.slug = 'academico' ON CONFLICT DO NOTHING;
INSERT INTO subdepartments (department_id, nome, slug, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Coordenação acadêmica', 'coordenacao', 2, TRUE, TRUE FROM departments d WHERE d.slug = 'academico' ON CONFLICT DO NOTHING;

INSERT INTO configuracoes (chave, valor) VALUES ('academico_horario_limite', '20:00') ON CONFLICT DO NOTHING;
