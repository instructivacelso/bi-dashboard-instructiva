// Estrutura base da empresa (setores, subsetores e perfis).
// É gravada no banco pela migração e pode ser editada depois pela área administrativa.

export const PERFIS = [
  { chave: 'superadmin', nome: 'Superadministrador', descricao: 'Acesso total, configurações e correções com auditoria.',
    permissoes: ['*'] },
  { chave: 'diretoria', nome: 'Diretoria', descricao: 'Vê todos os dashboards e relatórios. Não altera lançamentos operacionais.',
    permissoes: ['dashboard.empresa', 'relatorios.ver', 'acoes.ver'] },
  { chave: 'gerente', nome: 'Gerente de setor', descricao: 'Vê o próprio setor, faz o fechamento gerencial e acompanha ações.',
    permissoes: ['dashboard.setor', 'fechamento.gerencial', 'acoes.gerenciar', 'equipe.ver', 'formularios.proprios'] },
  { chave: 'colaborador', nome: 'Colaborador', descricao: 'Preenche os próprios formulários e vê seu histórico.',
    permissoes: ['formularios.proprios'] },
  { chave: 'externo', nome: 'Prestador externo', descricao: 'Acesso só ao subsetor e aos lançamentos atribuídos.',
    permissoes: ['formularios.proprios'] },
];

export const SETORES = [
  { slug: 'diretoria', nome: 'Diretoria', descricao: 'Visão consolidada da empresa, metas e decisões estratégicas.', modulo_ativo: false, ordem: 0 },
  { slug: 'marketing', nome: 'Marketing', descricao: 'Captação de alunos: tráfego, grupos, automação, criativos e lives de cada lançamento.', modulo_ativo: true, ordem: 1 },
  { slug: 'comercial-jesuitas', nome: 'Comercial — Jesuítas', descricao: 'Equipe de vendas de Jesuítas.', modulo_ativo: false, ordem: 2 },
  { slug: 'comercial-toledo', nome: 'Comercial — Toledo', descricao: 'Equipe de vendas de Toledo.', modulo_ativo: false, ordem: 3 },
  { slug: 'financeiro', nome: 'Financeiro', descricao: 'Recebimentos, boletos, inadimplência e despesas.', modulo_ativo: false, ordem: 4 },
  { slug: 'rh', nome: 'RH', descricao: 'Pessoas, contratações, treinamentos e clima.', modulo_ativo: false, ordem: 5 },
  { slug: 'suporte', nome: 'Suporte', descricao: 'Atendimento ao aluno após o onboarding.', modulo_ativo: false, ordem: 6 },
  { slug: 'pos-venda', nome: 'Pós-venda', descricao: 'Relacionamento com o aluno depois da compra.', modulo_ativo: false, ordem: 7 },
  { slug: 'cscx', nome: 'CS/CX', descricao: 'Sucesso e experiência do aluno.', modulo_ativo: false, ordem: 8 },
  { slug: 'indicacoes', nome: 'Indicações', descricao: 'Funil de vendas por indicação.', modulo_ativo: false, ordem: 9 },
  { slug: 'academico', nome: 'Professores e Acadêmico', descricao: 'Produção de aulas, materiais e conteúdo.', modulo_ativo: false, ordem: 10 },
];

export const SUBSETORES_MARKETING = [
  { slug: 'trafego', nome: 'Tráfego pago', formulario: 'trafego', ordem: 1,
    descricao: 'Acompanha o investimento e a geração de cadastros dos lançamentos atribuídos, informa os números mínimos da captação e sinaliza problemas.' },
  { slug: 'whatsapp', nome: 'WhatsApp, API e orgânico', formulario: 'whatsapp', ordem: 2,
    descricao: 'Convida pessoas, administra os grupos do lançamento, acompanha entradas por API e ações orgânicas e informa o total atual nos grupos.' },
  { slug: 'automacao', nome: 'Automação e onboarding', formulario: 'automacao', ordem: 3,
    descricao: 'Garante a captação técnica (página, formulário, WhatsApp), o checkout e o onboarding do aluno até ele receber acesso, entrar no grupo e ser entregue ao Suporte.' },
  { slug: 'edicao', nome: 'Edição de vídeos e criativos', formulario: 'editor', ordem: 4,
    descricao: 'Produz e entrega criativos, vídeos, aulas, VSLs, Reels e demais materiais audiovisuais.' },
  { slug: 'lives', nome: 'Resultado da live', formulario: 'live', ordem: 5,
    descricao: 'Registra os números essenciais do evento para medir o avanço do lançamento. Aparece no dia da live ou quando o gerente libera.' },
  { slug: 'gerencia', nome: 'Fechamento do gerente', formulario: 'gerente', ordem: 6,
    descricao: 'Acompanha os números consolidados, identifica o principal gargalo e define a ação corretiva, sem redigitar números da equipe.' },
];
