-- Módulo CS/CX (registro manual): carteira, registros, health score e fechamento do gerente

UPDATE departments SET modulo_ativo = TRUE WHERE slug = 'cscx';

-- Regra de health score versionada (pesos e limites editáveis)
CREATE TABLE IF NOT EXISTS cs_health_rules (
  versao SERIAL PRIMARY KEY,
  pesos JSONB NOT NULL,
  limites JSONB NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO cs_health_rules (pesos, limites)
SELECT '{"acesso":30,"progresso":25,"satisfacao":15,"reclamacoes":10,"cancelamento":15,"resposta":5}',
       '{"dias_ok":7,"dias_atencao":15,"dias_risco":30,"saudavel":70,"atencao":50,"risco":30}'
WHERE NOT EXISTS (SELECT 1 FROM cs_health_rules);

-- Carteira: uma ficha por aluno
CREATE TABLE IF NOT EXISTS cs_alunos (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL UNIQUE REFERENCES students(id),
  product_id INT REFERENCES products(id),
  responsavel_id INT REFERENCES users(id),
  turma TEXT,
  matricula TEXT NOT NULL DEFAULT 'ativa' CHECK (matricula IN ('ativa','suspensa','cancelada','concluida')),
  compra_em DATE NOT NULL,
  valor_contrato NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_contrato >= 0),
  boas_vindas BOOLEAN NOT NULL DEFAULT FALSE,
  acesso_liberado_em DATE,
  entrou_grupo BOOLEAN NOT NULL DEFAULT FALSE,
  orientado BOOLEAN NOT NULL DEFAULT FALSE,
  primeiro_acesso_em DATE,
  iniciou_curso BOOLEAN NOT NULL DEFAULT FALSE,
  progresso INT NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  ultimo_acesso DATE,
  health_score INT,
  faixa TEXT,
  regra_versao INT REFERENCES cs_health_rules(versao),
  health_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_alunos_resp ON cs_alunos (responsavel_id);

-- Histórico do health score (qual regra foi usada em cada cálculo)
CREATE TABLE IF NOT EXISTS cs_health_history (
  id BIGSERIAL PRIMARY KEY,
  cs_aluno_id INT NOT NULL REFERENCES cs_alunos(id) ON DELETE CASCADE,
  score INT NOT NULL, faixa TEXT NOT NULL, regra_versao INT NOT NULL, componentes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registros manuais da equipe (contato, pesquisa, voz do cliente, cancelamento, oportunidade)
CREATE TABLE IF NOT EXISTS cs_registros (
  id SERIAL PRIMARY KEY,
  cs_aluno_id INT NOT NULL REFERENCES cs_alunos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('contato','pesquisa','voz','cancelamento','oportunidade')),
  subtipo TEXT NOT NULL,
  canal TEXT,
  escala TEXT, nota INT,
  categoria TEXT,
  gravidade TEXT,
  setor_destino TEXT,
  status TEXT,
  valor NUMERIC(12,2),
  estrategia TEXT,
  descricao TEXT NOT NULL,
  voz_cliente BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_reg_tipo ON cs_registros (tipo, created_at);
CREATE INDEX IF NOT EXISTS idx_cs_reg_aluno ON cs_registros (cs_aluno_id);

CREATE TABLE IF NOT EXISTS cs_manager_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  numeros JSONB NOT NULL,
  respostas JSONB NOT NULL,
  responsavel_id INT NOT NULL REFERENCES users(id),
  prazo DATE NOT NULL,
  prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo', origem TEXT NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);
INSERT INTO configuracoes (chave, valor) VALUES ('cs_horario_limite', '19:00') ON CONFLICT DO NOTHING;
