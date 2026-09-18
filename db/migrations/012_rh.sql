-- Módulo RH — Etapa 1 (estrutura, colaboradores, fechamento diário, ponto resumido, recrutamento e indicadores)
-- Dados sensíveis (salário) ficam em coluna restrita, liberada só a gerente de RH e diretoria; toda alteração é auditada.

CREATE TABLE IF NOT EXISTS hr_positions (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  department_id INT REFERENCES departments(id),
  nivel TEXT,
  faixa_min NUMERIC(14,2),
  faixa_max NUMERIC(14,2),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS hr_employees (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),               -- vínculo opcional com o login
  nome TEXT NOT NULL,
  matricula TEXT,
  unidade TEXT,
  cidade TEXT,
  department_id INT REFERENCES departments(id),
  position_id INT REFERENCES hr_positions(id),
  gestor_id INT REFERENCES hr_employees(id),
  admissao DATE,
  vinculo TEXT NOT NULL DEFAULT 'clt' CHECK (vinculo IN ('clt','pj','estagio','temporario','terceiro','socio','outro')),
  jornada TEXT,
  modalidade TEXT NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial','hibrido','remoto')),
  salario NUMERIC(14,2),                            -- RESTRITO
  centro_custo TEXT,
  experiencia_fim DATE,
  contrato_fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','ferias','afastado','aviso','desligado','suspenso')),
  desligado_em DATE,
  desligado_tipo TEXT CHECK (desligado_tipo IN ('voluntario','involuntario','fim_contrato','outro')),
  observacao TEXT,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees (status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_dep ON hr_employees (department_id);

-- Histórico de movimentações (admissão, desligamento, promoção, alteração)
CREATE TABLE IF NOT EXISTS hr_movements (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES hr_employees(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admissao','desligamento','promocao','transferencia','alteracao_salario','alteracao_cargo','ferias','afastamento','retorno')),
  detalhe TEXT,
  valor NUMERIC(14,2),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fechamento diário do RH (condicional; cada seção pode ser marcada "sem ocorrência")
CREATE TABLE IF NOT EXISTS hr_daily_closings (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  unidade TEXT,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('rascunho','enviado','conferido')),
  -- Movimentação
  sem_movimentacao BOOLEAN NOT NULL DEFAULT FALSE,
  admissoes INT NOT NULL DEFAULT 0, deslig_vol INT NOT NULL DEFAULT 0, deslig_invol INT NOT NULL DEFAULT 0,
  transferencias INT NOT NULL DEFAULT 0, promocoes INT NOT NULL DEFAULT 0, exp_inicio INT NOT NULL DEFAULT 0, exp_fim INT NOT NULL DEFAULT 0,
  -- Ponto e jornada
  sem_ponto BOOLEAN NOT NULL DEFAULT FALSE,
  presentes INT NOT NULL DEFAULT 0, faltas_just INT NOT NULL DEFAULT 0, faltas_injust INT NOT NULL DEFAULT 0,
  atrasos INT NOT NULL DEFAULT 0, saidas_antec INT NOT NULL DEFAULT 0, horas_extras NUMERIC(8,2) NOT NULL DEFAULT 0, pendencias_ponto INT NOT NULL DEFAULT 0,
  -- Ocorrências e atendimentos
  sem_ocorrencias BOOLEAN NOT NULL DEFAULT FALSE,
  solicitacoes INT NOT NULL DEFAULT 0, solic_resolvidas INT NOT NULL DEFAULT 0, solic_pendentes INT NOT NULL DEFAULT 0, conflitos INT NOT NULL DEFAULT 0,
  -- Recrutamento
  sem_recrutamento BOOLEAN NOT NULL DEFAULT FALSE,
  vagas_abertas INT NOT NULL DEFAULT 0, candidatos INT NOT NULL DEFAULT 0, entrevistas INT NOT NULL DEFAULT 0,
  aprovados INT NOT NULL DEFAULT 0, propostas INT NOT NULL DEFAULT 0, contratacoes INT NOT NULL DEFAULT 0,
  -- Treinamentos
  sem_treinamentos BOOLEAN NOT NULL DEFAULT FALSE,
  integracoes INT NOT NULL DEFAULT 0, treinamentos INT NOT NULL DEFAULT 0, treino_participantes INT NOT NULL DEFAULT 0, treino_ausentes INT NOT NULL DEFAULT 0,
  -- Riscos e prioridades
  risco TEXT, precisa_diretoria BOOLEAN NOT NULL DEFAULT FALSE, plano TEXT, prazo DATE, responsavel_id INT REFERENCES users(id),
  observacao TEXT,
  pontualidade TEXT NOT NULL DEFAULT 'no_prazo',
  justificativa_data TEXT,
  created_by INT NOT NULL REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_ref)
);

-- Ativa o setor e cria subsetores
UPDATE departments SET modulo_ativo = TRUE, descricao = 'Pessoas: quadro, admissões, desligamentos, ponto, recrutamento, treinamentos e custo de pessoal.' WHERE slug = 'rh';
INSERT INTO subdepartments (department_id, nome, slug, formulario, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Operação de RH', 'operacao', 'rh_fechamento', 1, TRUE, TRUE FROM departments d WHERE d.slug = 'rh' ON CONFLICT DO NOTHING;
INSERT INTO subdepartments (department_id, nome, slug, ordem, ativo, formulario_ativo)
  SELECT d.id, 'Gerente de RH', 'gerencia', 2, TRUE, TRUE FROM departments d WHERE d.slug = 'rh' ON CONFLICT DO NOTHING;

INSERT INTO configuracoes (chave, valor) VALUES
  ('rh_horario_limite', '19:00'), ('rh_meta_absenteismo', '3'), ('rh_meta_turnover', '4')
  ON CONFLICT DO NOTHING;
