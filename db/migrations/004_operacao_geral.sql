-- Lançamento fixo "Operação geral": garante que ninguém fique sem formulário
ALTER TABLE launches ADD COLUMN IF NOT EXISTS permanente BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO launches (nome, status, permanente)
SELECT 'Operação geral', 'captacao', TRUE
WHERE NOT EXISTS (SELECT 1 FROM launches WHERE permanente);
