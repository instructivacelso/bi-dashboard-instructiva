import { exigirUsuario } from '@/lib/auth.js';
import { PRIORIDADES, podeConfigurarSla } from '@/lib/suporte.js';
import { regrasSla } from '@/lib/dadosSuporte.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarSla } from '../actions.js';

export const dynamic = 'force-dynamic';
export default async function Sla() {
  const u = await exigirUsuario();
  if (!podeConfigurarSla(u)) return <Aviso tipo="erro">Só o gerente de Suporte e o administrador configuram o SLA.</Aviso>;
  const [regras, limite] = await Promise.all([regrasSla(), configuracao('suporte_horario_limite', '19:00')]);
  return (
    <>
      <Topo titulo="SLA do Suporte" descricao="Prazo para a primeira resposta e para a solução, por prioridade." />
      <div className="painel" style={{ maxWidth: 720 }}>
        <FormEstado action={salvarSla} botao="Salvar SLA">
          <div className="tabela-wrap"><table>
            <thead><tr><th>Prioridade</th><th>1ª resposta (minutos)</th><th>Solução (horas)</th></tr></thead>
            <tbody>{regras.map((r) => (
              <tr key={r.prioridade}><td><b>{PRIORIDADES[r.prioridade]}</b></td>
                <td><input name={`resposta_${r.prioridade}`} type="number" min="1" defaultValue={r.resposta_min} required aria-label={`Primeira resposta ${r.prioridade}`} /></td>
                <td><input name={`solucao_${r.prioridade}`} type="number" min="1" defaultValue={r.solucao_horas} required aria-label={`Solução ${r.prioridade}`} /></td></tr>
            ))}</tbody>
          </table></div>
          <div className="campo" style={{ maxWidth: 240 }}><label htmlFor="horario_limite">Horário-limite do fechamento diário</label><input id="horario_limite" name="horario_limite" type="time" defaultValue={limite} required /></div>
        </FormEstado>
      </div>
    </>
  );
}
