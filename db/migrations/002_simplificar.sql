-- Remove o setor Diretoria da lista e renomeia o administrador
UPDATE departments SET ativo = FALSE WHERE slug = 'diretoria';
UPDATE roles SET nome = 'Administrador' WHERE chave = 'superadmin';
UPDATE users SET nome = 'Escola Instructiva' WHERE nome = 'Superadministrador';
