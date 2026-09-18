export async function auditar(db, { userId, acao, entidade, entidadeId = null, antes = null, depois = null }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, acao, entidade, entidade_id, antes, depois) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, acao, entidade, entidadeId, antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null]
  );
}
