'use client';
import { useEffect, useRef, useState } from 'react';

// Conta os campos obrigatórios preenchidos do formulário em que está
export default function Progresso() {
  const ref = useRef(null);
  const [st, setSt] = useState({ feitos: 0, total: 0 });
  useEffect(() => {
    const f = ref.current?.closest('form');
    if (!f) return;
    const contar = () => {
      const grupos = new Map();
      f.querySelectorAll('[required]').forEach((el) => {
        if (el.disabled || el.type === 'hidden' || el.closest('[hidden]')) return;
        const nome = el.name;
        if (!nome) return;
        if (el.type === 'radio') {
          const marcado = f.querySelector(`input[name="${CSS.escape(nome)}"]:checked`);
          grupos.set(nome, !!marcado);
        } else grupos.set(nome, String(el.value).trim() !== '');
      });
      f.querySelectorAll('[data-grupo-obrigatorio]').forEach((g, k) => {
        if (g.closest('[hidden]')) return;
        grupos.set(`__grupo${k}`, !!g.querySelector('input[type=checkbox]:checked'));
      });
      setSt({ feitos: [...grupos.values()].filter(Boolean).length, total: grupos.size });
    };
    contar();
    f.addEventListener('input', contar);
    f.addEventListener('change', contar);
    f.addEventListener('condicionais', contar);
    return () => { f.removeEventListener('input', contar); f.removeEventListener('change', contar); f.removeEventListener('condicionais', contar); };
  }, []);
  const faltam = st.total - st.feitos;
  const pctv = st.total ? (st.feitos / st.total) * 100 : 0;
  return (
    <div ref={ref} className="progresso" aria-live="polite">
      <div className="progresso-barra"><i style={{ width: `${pctv}%` }} /></div>
      <span>{st.total === 0 ? '' : faltam === 0 ? 'Tudo preenchido' : `Faltam ${faltam} de ${st.total} campos`}</span>
    </div>
  );
}
