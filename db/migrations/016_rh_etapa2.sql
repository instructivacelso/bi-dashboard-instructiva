-- RH — Etapa 2 (folha e custo de pessoal, clima e eNPS)
-- Dados de folha são sensíveis: só gerente de RH e diretoria. O financeiro recebe os totais aprovados, sem redigitar.

CREATE TABLE IF NOT EXISTS hr_payroll (
  id SERIAL PRIMARY KEY,
  competencia DATE NOT NULL,                       -- primeiro dia do mês
  employee_id INT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  variavel NUMERIC(14,2) NOT NULL DEFAULT 0,        -- variável, comissão, horas extras, adicionais
  beneficios NUMERIC(14,2) NOT NULL DEFAULT 0,
  encargos NUMERIC(14,2) NOT NULL DEFAULT 0,
  descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  provisoes NUMERIC(14,2) NOT NULL DEFAULT 0,       -- férias + 13º provisionados
  custo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','fechada','enviada_financeiro')),
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competencia, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_comp ON hr_payroll (competencia);

-- Clima organizacional e eNPS (resultado agregado por competência; anônimo, com mínimo de respostas para exibir)
CREATE TABLE IF NOT EXISTS hr_climate (
  id SERIAL PRIMARY KEY,
  competencia DATE NOT NULL,
  department_id INT REFERENCES departments(id),     -- NULL = empresa toda
  respostas INT NOT NULL DEFAULT 0,
  promotores INT NOT NULL DEFAULT 0,
  neutros INT NOT NULL DEFAULT 0,
  detratores INT NOT NULL DEFAULT 0,
  satisfacao_media NUMERIC(4,2),                    -- 0 a 10, opcional
  observacao TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competencia, department_id)
);

INSERT INTO configuracoes (chave, valor) VALUES
  ('rh_folha_encargos_pct', '0'), ('rh_min_respostas_clima', '5'), ('rh_meta_enps', '20')
  ON CONFLICT DO NOTHING;
