'use client';
import { useFormState, useFormStatus } from 'react-dom';

function Enviar({ texto, textoEnviando }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? textoEnviando || 'Salvando…' : texto}
    </button>
  );
}

// Formulário com mensagem de erro/sucesso vinda de uma server action
export default function FormEstado({ action, children, botao = 'Salvar', botaoEnviando, className = 'form', sucesso }) {
  const [estado, acao] = useFormState(action, null);
  return (
    <form action={acao} className={className}>
      {estado?.erro && <div className="aviso erro" role="alert">{estado.erro}</div>}
      {estado?.ok && <div className="aviso ok" role="status">{estado.mensagem || sucesso || 'Salvo.'}</div>}
      {children}
      <div><Enviar texto={botao} textoEnviando={botaoEnviando} /></div>
    </form>
  );
}
