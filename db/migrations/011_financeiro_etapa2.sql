-- Financeiro — Etapa 2 (resultado do mês: custo por produto, CAC, margem, DRE, EBITDA, ponto de equilíbrio)

-- Novos grupos de categoria: depreciação e juros (separados de dívida)
ALTER TABLE fin_categories DROP CONSTRAINT IF EXISTS fin_categories_grupo_check;
ALTER TABLE fin_categories ADD CONSTRAINT fin_categories_grupo_check
  CHECK (grupo IN ('receita','custo_variavel','custo_fixo','pessoal','imposto','marketing','divida','juros','depreciacao','outra'));

-- Atribuição de um pagamento a um lançamento (para CAC e rateio de marketing)
ALTER TABLE fin_payments ADD COLUMN IF NOT EXISTS launch_id INT REFERENCES launches(id);

-- Lançamentos manuais de competência que não entram no caixa do dia (depreciação, pró-labore, ajustes de imposto/juros)
CREATE TABLE IF NOT EXISTS fin_adjustments (
  id SERIAL PRIMARY KEY,
  competencia DATE NOT NULL,                    -- primeiro dia do mês de competência
  tipo TEXT NOT NULL CHECK (tipo IN ('depreciacao','amortizacao','juros','imposto','pro_labore','provisao','outro')),
  grupo TEXT NOT NULL DEFAULT 'outra' CHECK (grupo IN ('custo_variavel','custo_fixo','pessoal','imposto','juros','depreciacao','outra')),
  descricao TEXT NOT NULL,
  product_id INT REFERENCES products(id),
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_adjustments_comp ON fin_adjustments (competencia);

-- Meta de margem de contribuição (%) para o semáforo do resultado
INSERT INTO configuracoes (chave, valor) VALUES ('financeiro_meta_margem', '30') ON CONFLICT DO NOTHING;
