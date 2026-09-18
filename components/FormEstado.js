'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import Progresso from './Progresso.js';

function Enviar({ texto, textoEnviando }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? textoEnviando || 'Salvando…' : texto}
    </button>
  );
}

// Formulário com mensagem de erro/sucesso vinda de uma server action
export default function FormEstado({ action, children, botao = 'Salvar', botaoEnviando, className = 'form', sucesso, protegerSaida = false, extra, progresso = false }) {
  const [estado, acao] = useActionState(action, null);
  const ref = useRef(null);
  const sujo = useRef(false);
  // Pergunta antes de sair da página com o formulário preenchido e não enviado
  useEffect(() => {
    if (!protegerSaida || !ref.current) return;
    const f = ref.current;
    const marcar = () => { sujo.current = true; };
    const avisar = (e) => { if (sujo.current) { e.preventDefault(); e.returnValue = ''; } };
    f.addEventListener('input', marcar);
    window.addEventListener('beforeunload', avisar);
    return () => { f.removeEventListener('input', marcar); window.removeEventListener('beforeunload', avisar); };
  }, [protegerSaida]);
  useEffect(() => { if (estado?.ok) sujo.current = false; }, [estado]);
  useEffect(() => {
    if (!ref.current) return;
    const f = ref.current;
    const limpar = () => { sujo.current = false; };
    f.addEventListener('submit', limpar);
    return () => f.removeEventListener('submit', limpar);
  }, []);
  return (
    <form action={acao} className={className} ref={ref}>
      {estado?.erro && <div className="aviso erro" role="alert">{estado.erro}</div>}
      {children}
      {estado?.erro && progresso && <div className="aviso erro" role="alert">{estado.erro}</div>}
      <div className={progresso ? 'rodape-fixo' : 'acoes-linha'}>
        {progresso && <Progresso />}
        <div className="acoes-linha"><Enviar texto={botao} textoEnviando={botaoEnviando} />{extra}</div>
      </div>
      {estado?.ok && <div className="aviso ok" role="status">{estado.mensagem || sucesso || 'Salvo.'}</div>}
    </form>
  );
}
