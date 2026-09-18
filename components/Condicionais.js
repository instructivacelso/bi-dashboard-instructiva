'use client';
import { useEffect, useRef } from 'react';

// Mostra/esconde blocos com data-se e liga/desliga o "obrigatório" dos campos dentro deles.
//   data-se="campo:valor1|valor2"  -> aparece quando o campo (rádio/select) tem um desses valores
//   data-se="campo>0"              -> aparece quando o número do campo é maior que zero
export default function Condicionais() {
  const ref = useRef(null);
  useEffect(() => {
    const f = ref.current?.closest('form');
    if (!f) return;
    const valorDe = (nome) => {
      const els = f.querySelectorAll(`[name="${CSS.escape(nome)}"]`);
      for (const el of els) {
        if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) return el.value; }
        else return el.value;
      }
      return '';
    };
    const aplicar = () => {
      f.querySelectorAll('[data-se]').forEach((bloco) => {
        const regra = bloco.dataset.se;
        let mostrar;
        if (regra.includes('>')) {
          const [nome, lim] = regra.split('>');
          mostrar = (Number(String(valorDe(nome)).replace(',', '.')) || 0) > Number(lim);
        } else {
          const [nome, vals] = regra.split(':');
          mostrar = vals.split('|').includes(valorDe(nome));
        }
        bloco.hidden = !mostrar;
        bloco.querySelectorAll('input, select, textarea').forEach((el) => {
          if (el.dataset.obrig === undefined) el.dataset.obrig = el.required ? '1' : '0';
          el.required = mostrar && el.dataset.obrig === '1';
        });
      });
      f.dispatchEvent(new Event('condicionais'));
    };
    aplicar();
    f.addEventListener('input', aplicar);
    f.addEventListener('change', aplicar);
    return () => { f.removeEventListener('input', aplicar); f.removeEventListener('change', aplicar); };
  }, []);
  return <span ref={ref} hidden />;
}
