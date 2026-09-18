'use client';
import { useEffect, useRef, useState } from 'react';

// Linhas repetíveis: uma para cada unidade informada no campo de quantidade
// campos: [{ nome, rotulo, tipo: 'texto'|'data'|'opcao', opcoes }]
export default function ListaQtd({ campoQtd, prefixo, titulo, campos, inicial = [] }) {
  const ref = useRef(null);
  const [n, setN] = useState(inicial.length);
  useEffect(() => {
    const f = ref.current?.closest('form');
    const ler = () => { const el = f.querySelector(`[name="${campoQtd}"]`); setN(el && !el.closest('[hidden]') ? Math.min(20, Math.max(0, parseInt(el.value, 10) || 0)) : 0); };
    ler();
    f.addEventListener('input', ler); f.addEventListener('condicionais', ler);
    return () => { f.removeEventListener('input', ler); f.removeEventListener('condicionais', ler); };
  }, [campoQtd]);
  return (
    <div ref={ref} className="campo">
      {Array.from({ length: n }, (_, i) => {
        const v = inicial[i] || {};
        return (
          <div key={i} className="linha-venda">
            <input type="hidden" name={`${prefixo}_idx`} value={i} />
            <div className="linha-venda-topo"><b>{titulo} {i + 1}</b></div>
            <div className="linha-campos">
              {campos.map((c) => {
                const nome = `${prefixo}${i}_${c.nome}`;
                return (
                  <div className="campo" key={c.nome}>
                    <label htmlFor={nome}>{c.rotulo}</label>
                    {c.tipo === 'opcao'
                      ? <select id={nome} name={nome} defaultValue={v[c.nome] || ''} required={!c.opcional}><option value="">{c.opcional ? 'Não informado' : 'Escolha…'}</option>{Object.entries(c.opcoes).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
                      : <input id={nome} name={nome} type={c.tipo === 'data' ? 'date' : 'text'} defaultValue={v[c.nome] || ''} required={!c.opcional} maxLength={300} inputMode={c.tipo === 'telefone' ? 'tel' : undefined} placeholder={c.tipo === 'telefone' ? '(45) 99999-9999' : undefined} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
