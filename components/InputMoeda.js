'use client';
import { useState } from 'react';

// Campo de moeda brasileira: digita só números e o valor aparece como 1.234,56
const fmt = (centavos) => (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InputMoeda({ id, name, valorInicial, required = true, ariaLabel }) {
  const ini = valorInicial === null || valorInicial === undefined || valorInicial === '' ? '' : fmt(Math.round(Number(valorInicial) * 100));
  const [v, setV] = useState(ini);
  return (
    <div className="moeda">
      <span aria-hidden="true">R$</span>
      <input
        id={id} name={name} type="text" inputMode="numeric" autoComplete="off" required={required} aria-label={ariaLabel}
        value={v} placeholder="0,00"
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
          setV(digitos === '' ? '' : fmt(Number(digitos)));
        }}
      />
    </div>
  );
}
