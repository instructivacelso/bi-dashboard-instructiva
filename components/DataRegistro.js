'use client';
import { useRouter } from 'next/navigation';

// Campo de data do formulário diário: ao trocar, recarrega o formulário daquela data
export default function DataRegistro({ valor, min, max, rota }) {
  const router = useRouter();
  return (
    <div className="campo">
      <label htmlFor="data_ref">Data do registro</label>
      <input id="data_ref" name="data_ref" type="date" defaultValue={valor} min={min} max={max} required
        onChange={(e) => { if (e.target.value) router.push(`${rota}?data=${e.target.value}`); }} />
      <small>Vem com a data de hoje. Para registrar outro dia (até 7 dias atrás), escolha a data e justifique.</small>
    </div>
  );
}
