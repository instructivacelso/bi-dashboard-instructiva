-- Acadêmico — Etapa 2 (qualidade e aprovação de conteúdo, retrabalho, pontuação opcional)

-- Contadores de revisão no conteúdo
ALTER TABLE academic_content ADD COLUMN IF NOT EXISTS ciclos_revisao INT NOT NULL DEFAULT 0;
ALTER TABLE academic_content ADD COLUMN IF NOT EXISTS aprovado_primeira BOOLEAN;
ALTER TABLE academic_content ADD COLUMN IF NOT EXISTS publicado_em DATE;

-- Avaliação de qualidade de uma entrega (feita pela coordenação)
CREATE TABLE IF NOT EXISTS academic_quality (
  id SERIAL PRIMARY KEY,
  content_id INT NOT NULL REFERENCES academic_content(id) ON DELETE CASCADE,
  avaliador_id INT REFERENCES users(id),
  criterios JSONB,                                  -- {precisao:9, didatica:8, ...} 0 a 10
  nota NUMERIC(4,2),
  status TEXT NOT NULL CHECK (status IN ('aprovado','aprovado_ajuste','reprovado')),
  motivo TEXT,
  prazo_correcao DATE,
  no_prazo BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_academic_quality_content ON academic_quality (content_id);

-- Pesos da pontuação opcional (por atividade)
CREATE TABLE IF NOT EXISTS academic_weights (
  chave TEXT PRIMARY KEY,
  peso NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO academic_weights (chave, peso) VALUES
  ('aula_publicada', 10), ('aula_gravada', 4), ('criativo_aprovado', 3), ('pagina_nova', 1), ('pagina_revisada', 0.5),
  ('chamado_resolvido', 0.5), ('live', 8), ('venda', 5)
  ON CONFLICT DO NOTHING;

INSERT INTO configuracoes (chave, valor) VALUES ('academico_pontuacao_ativa', 'false') ON CONFLICT DO NOTHING;
