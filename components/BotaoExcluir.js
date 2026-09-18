'use client';
// Botão de exclusão com confirmação
export default function BotaoExcluir({ action, id, nome, registros }) {
  return (
    <form action={action} onSubmit={(e) => {
      const msg = registros > 0
        ? `Excluir "${nome}"?\n\nIsso apaga também ${registros} registro(s) de formulários, ações e vendas ligados a ele. Não dá para desfazer.\n\nSe quiser só parar os envios, mude o status para Encerrado ou Cancelado.`
        : `Excluir "${nome}"? Não dá para desfazer.`;
      if (!window.confirm(msg)) e.preventDefault();
    }}>
      <input type="hidden" name="id" value={id} />
      <button className="btn sec peq" type="submit" style={{ color: 'var(--vermelho)' }}>Excluir</button>
    </form>
  );
}
