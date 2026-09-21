'use client';
import { useRouter } from 'next/navigation';

// Primeiro campo do formulário: escolher o lançamento. Ao trocar, recarrega com os dados dele.
export default function SeletorLancamento({ opcoes, atual, form, desabilitado }) {
  const router = useRouter();
  return (
    <div className="campo">
      <label htmlFor="launch_id">Lançamento</label>
      <select
        id="launch_id" name="launch_id" required={!desabilitado} disabled={desabilitado} defaultValue={atual ?? ''}
        onChange={(e) => e.target.value && router.push(`/marketing/${form}?lancamento=${e.target.value}`)}
      >
        {desabilitado ? <option value="">Nenhum lançamento disponível hoje</option> : opcoes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
      <small>{desabilitado ? 'Veja acima o que falta liberar, ou cadastre um lançamento.' : 'Escolha o lançamento a que estes números se referem.'}</small>
    </div>
  );
}
