// Regras de permissão (funções puras, testáveis).
// usuario = { id, papel, lotacoes: [{ setor, subsetor, formulario, gerente }] }

export const vePainelEmpresa = (u) => ['superadmin', 'diretoria'].includes(u?.papel);
export const ehSuperadmin = (u) => u?.papel === 'superadmin';
export const ehDiretoria = (u) => u?.papel === 'diretoria';

export function gerenteDe(u, setor) {
  return u?.papel === 'gerente' && u.lotacoes.some((l) => l.setor === setor && l.gerente);
}

export function acessaSetor(u, setor) {
  if (vePainelEmpresa(u)) return true;
  return u?.lotacoes?.some((l) => l.setor === setor) ?? false;
}

// Dashboard do setor: diretoria, superadmin e gerente do setor
export function veDashboardSetor(u, setor) {
  return vePainelEmpresa(u) || gerenteDe(u, setor);
}

// Formulários que o usuário preenche (pelos subsetores atribuídos)
export function formulariosDo(u) {
  if (ehDiretoria(u)) return [];
  const f = new Set(u?.lotacoes?.filter((l) => l.formulario && l.formularioAtivo !== false).map((l) => l.formulario));
  return [...f];
}

// Pode ver o lançamento? atribuidos = ids de lançamentos atribuídos ao usuário
export function veLancamento(u, lancamentoId, atribuidos) {
  if (vePainelEmpresa(u) || gerenteDe(u, 'marketing')) return true;
  return atribuidos.includes(Number(lancamentoId));
}

// Pode editar um registro operacional?
// - Diretoria nunca edita (a menos que seja superadmin)
// - O autor edita até o fim do dia de referência
// - Gerente do Marketing e superadmin corrigem registros antigos (com motivo e auditoria)
export function podeEditar(u, registro, hojeISO) {
  if (!u || !registro) return { pode: false };
  if (ehSuperadmin(u)) return { pode: true, correcao: registro.created_by !== u.id || registro.data_ref !== hojeISO };
  if (ehDiretoria(u)) return { pode: false };
  if (registro.created_by === u.id && registro.data_ref === hojeISO) return { pode: true, correcao: false };
  if (gerenteDe(u, 'marketing')) return { pode: true, correcao: true };
  return { pode: false };
}

// Pode lançar vendas e faturamento manualmente (enquanto não há integração)
export const lancaComercial = (u) => ehSuperadmin(u) || gerenteDe(u, 'marketing');
