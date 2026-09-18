-- RH — Etapa 2 (parte 2): avaliações de desempenho e PDI, treinamentos, plano de sucessão

-- Avaliações de desempenho
CREATE TABLE IF NOT EXISTS hr_evaluations (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'periodica' CHECK (tipo IN ('experiencia','periodica','360','autoavaliacao')),
  avaliador_id INT REFERENCES users(id),
  nota_geral NUMERIC(4,2),                          -- 0 a 10
  criterios JSONB,                                  -- {resultados:8, qualidade:7, ...}
  pontos_fortes TEXT,
  pontos_desenvolver TEXT,
  potencial TEXT CHECK (potencial IN ('baixo','medio','alto') OR potencial IS NULL),
  proxima_revisao DATE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_eval_emp ON hr_evaluations (employee_id);

-- Plano de Desenvolvimento Individual (ações)
CREATE TABLE IF NOT EXISTS hr_pdi (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  evaluation_id INT REFERENCES hr_evaluations(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  responsavel TEXT,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','concluido','cancelado')),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treinamentos
CREATE TABLE IF NOT EXISTS hr_trainings (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  competencia DATE NOT NULL,
  competencia_dev TEXT,                             -- competência desenvolvida
  publico TEXT,
  instrutor TEXT,
  formato TEXT,
  carga_horaria NUMERIC(6,2) NOT NULL DEFAULT 0,
  custo NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_treino DATE,
  observacao TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_training_participants (
  id SERIAL PRIMARY KEY,
  training_id INT NOT NULL REFERENCES hr_trainings(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  presente BOOLEAN NOT NULL DEFAULT TRUE,
  nota_aprendizagem NUMERIC(4,2),
  UNIQUE (training_id, employee_id)
);

-- Plano de sucessão
CREATE TABLE IF NOT EXISTS hr_succession (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,   -- posição/pessoa-chave
  sucessor_id INT REFERENCES hr_employees(id),
  prontidao TEXT NOT NULL DEFAULT 'medio_prazo' CHECK (prontidao IN ('pronto','curto_prazo','medio_prazo','sem_sucessor')),
  risco_perda TEXT NOT NULL DEFAULT 'medio' CHECK (risco_perda IN ('baixo','medio','alto')),
  impacto TEXT NOT NULL DEFAULT 'medio' CHECK (impacto IN ('baixo','medio','alto')),
  plano_retencao TEXT,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);
