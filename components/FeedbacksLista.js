'use client';
import { useEffect, useRef, useState } from 'react';

// Uma linha de feedback para cada feedback informado na quantidade
export default function FeedbacksLista({ tipos, inicial = [] }) {
  const ref = useRef(null);
  const [n, setN] = useState(inicial.length);
  useEffect(() => {
    const f = ref.current?.closest('form');
    const ler = () => setN(Math.min(20, Math.max(0, parseInt(f.querySelector('[name="feedbacks_qtd"]')?.value, 10) || 0)));
    ler();
    f.addEventListener('input', ler);
    return () => f.removeEventListener('input', ler);
  }, []);
  return (
    <div ref={ref} className="campo">
      {Array.from({ length: n }, (_, i) => {
        const v = inicial[i] || {};
        return (
          <div key={i} className="linha-venda">
            <input type="hidden" name="fb_idx" value={i} />
            <div className="linha-venda-topo"><b>Feedback {i + 1}</b></div>
            <div className="linha-campos">
              <div className="campo"><label htmlFor={`fb${i}_alvo`}>Vendedor ou grupo</label><input id={`fb${i}_alvo`} name={`fb${i}_alvo`} type="text" defaultValue={v.alvo} required maxLength={120} /></div>
              <div className="campo"><label htmlFor={`fb${i}_tipo`}>Tipo</label>
                <select id={`fb${i}_tipo`} name={`fb${i}_tipo`} defaultValue={v.tipo || ''} required><option value="">Escolha…</option>{Object.entries(tipos).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
            </div>
            <div className="campo"><label htmlFor={`fb${i}_tema`}>Tema</label><input id={`fb${i}_tema`} name={`fb${i}_tema`} type="text" defaultValue={v.tema} required maxLength={200} /></div>
            <div className="linha-campos">
              <div className="campo"><label htmlFor={`fb${i}_acao`}>Ação combinada</label><input id={`fb${i}_acao`} name={`fb${i}_acao`} type="text" defaultValue={v.acao} required maxLength={300} /></div>
              <div className="campo"><label htmlFor={`fb${i}_data`}>Acompanhar em</label><input id={`fb${i}_data`} name={`fb${i}_data`} type="date" defaultValue={v.acompanhamento} required /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
