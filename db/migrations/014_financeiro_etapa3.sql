-- Financeiro — Etapa 3 (dívidas, investidores/aportes, consórcios, patrimônio, metas de redução e alçadas)

-- Dívidas e financiamentos
CREATE TABLE IF NOT EXISTS fin_debts (
  id SERIAL PRIMARY KEY,
  credor TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'emprestimo' CHECK (tipo IN ('financiamento','emprestimo','cartao','parcelamento','cheque_especial','outro')),
  valor_original NUMERIC(14,2) NOT NULL CHECK (valor_original >= 0),
  saldo_devedor NUMERIC(14,2) NOT NULL CHECK (saldo_devedor >= 0),
  taxa_mensal NUMERIC(7,4) NOT NULL DEFAULT 0,          -- fração ao mês (0,0199 = 1,99%)
  parcelas_total INT NOT NULL DEFAULT 0,
  parcelas_pagas INT NOT NULL DEFAULT 0,
  parcela_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  proximo_vencimento DATE,
  garantia TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','quitada','renegociada','atrasada')),
  observacao TEXT,
  created_by INT REFERENCES users(id), updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Investidores, sócios e movimentos de capital
CREATE TABLE IF NOT EXISTS fin_capital_movements (
  id SERIAL PRIMARY KEY,
  investidor TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('aporte','retirada','distribuicao')),
  data DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  observacao TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consórcios
CREATE TABLE IF NOT EXISTS fin_consortia (
  id SERIAL PRIMARY KEY,
  administradora TEXT NOT NULL,
  bem TEXT,
  valor_carta NUMERIC(14,2) NOT NULL CHECK (valor_carta >= 0),
  parcela_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  parcelas_total INT NOT NULL DEFAULT 0,
  parcelas_pagas INT NOT NULL DEFAULT 0,
  contemplado BOOLEAN NOT NULL DEFAULT FALSE,
  contemplado_em DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','contemplado','encerrado','cancelado')),
  observacao TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patrimônio (ativos)
CREATE TABLE IF NOT EXISTS fin_assets (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'equipamento' CHECK (tipo IN ('imovel','veiculo','equipamento','mobiliario','intangivel','aplicacao','outro')),
  descricao TEXT NOT NULL,
  valor_aquisicao NUMERIC(14,2),
  valor_atual NUMERIC(14,2) NOT NULL CHECK (valor_atual >= 0),
  aquisicao_data DATE,
  observacao TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parâmetros: alçada de aprovação (acima do valor exige diretoria) e meta de redução de dívida
INSERT INTO configuracoes (chave, valor) VALUES
  ('financeiro_alcada_diretoria', '10000'),
  ('financeiro_meta_reducao_divida', '0')
  ON CONFLICT DO NOTHING;
