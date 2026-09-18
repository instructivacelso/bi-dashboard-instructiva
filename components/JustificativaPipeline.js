'use client';
import { useEffect, useRef, useState } from 'react';
import { inconsistenciasPipeline } from '@/lib/comercial.js';

// Pede justificativa quando os números da pipeline não batem (mesmas regras do servidor)
export default function JustificativaPipeline({ anterior, valorInicial }) {
  const ref = useRef(null);
  const [problemas, setProblemas] = useState([]);
  useEffect(() => {
    const f = ref.current.closest('form');
    const num = (n) => { const v = f.querySelector(`[name="${n}"]`)?.value || ''; return Number(String(v).replace(/\./g, '').replace(',', '.')) || 0; };
    const checar = () => {
      let vendas = 0;
      f.querySelectorAll('[name^="v"][name$="_valor"]').forEach((el) => { vendas += Number(el.value.replace(/\./g, '').replace(',', '.')) || 0; });
      setProblemas(inconsistenciasPipeline({
        pipeline_valor: num('pipeline_valor'), negociacao_qtd: num('negociacao_qtd'), negociacao_valor: num('negociacao_valor'),
        fechamento_qtd: num('fechamento_qtd'), fechamento_valor: num('fechamento_valor'),
      }, anterior, vendas));
    };
    // Lê depois que o campo de R$ terminar de formatar o valor
    const depois = () => setTimeout(checar, 0);
    checar();
    f.addEventListener('input', depois);
    return () => f.removeEventListener('input', depois);
  }, [anterior]);
  return (
    <div ref={ref}>
      {problemas.length > 0 && (
        <div className="campo" style={{ border: '1px solid rgba(251,191,36,.35)', background: 'rgba(251,191,36,.06)', padding: 14, borderRadius: 14 }}>
          <label htmlFor="justificativa_pipeline">Explique a diferença na pipeline</label>
          <small>{problemas.join(' ')}</small>
          <textarea id="justificativa_pipeline" name="justificativa_pipeline" defaultValue={valorInicial || ''} required maxLength={400} />
        </div>
      )}
    </div>
  );
}
