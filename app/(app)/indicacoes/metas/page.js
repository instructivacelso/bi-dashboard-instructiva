import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { veTodaIndicacao } from '@/lib/indicacao.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Vazio } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarMetasIndicacao } from '../actions.js';

export const dynamic = 'force-dynamic';
export default async function MetasIndicacao() {
  const u = await exigirUsuario();
  if (!veTodaIndicacao(u)) return <Aviso tipo="erro">Área do gerente de Indicação.</Aviso>;
  const [lista, prazoH, diasParada, limite] = await Promise.all([
    q(`SELECT DISTINCT x.id, x.nome, g.* FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id JOIN subdepartments s ON s.id=a.subdepartment_id
         LEFT JOIN referral_goals g ON g.user_id=x.id WHERE x.ativo AND d.slug='indicacoes' AND s.slug='coleta' ORDER BY x.nome`),
    configuracao('indicacao_prazo_primeiro_contato_h', '24'), configuracao('indicacao_dias_parada', '3'), configuracao('indicacao_horario_limite', '19:00'),
  ]);
  const cel = (nome, v) => <td><input name={nome} type="text" inputMode="decimal" defaultValue={v ?? ''} style={{ minWidth: 90 }} aria-label={nome} /></td>;
  return (
    <>
      <Topo titulo="Metas e alertas — Indicação" descricao="Metas por colaborador e prazos usados nos alertas."><a className="btn sec" href="/indicacoes">Voltar</a></Topo>
      <div className="painel">
        <FormEstado action={salvarMetasIndicacao} botao="Salvar">
          <div className="linha-campos">
            <div className="campo"><label htmlFor="prazo_h">Prazo para a 1ª tentativa (horas)</label><input id="prazo_h" name="prazo_h" type="number" min="1" defaultValue={prazoH} required /></div>
            <div className="campo"><label htmlFor="dias_parada">Dias para considerar “parada”</label><input id="dias_parada" name="dias_parada" type="number" min="1" defaultValue={diasParada} required /></div>
            <div className="campo"><label htmlFor="horario_limite">Horário-limite do formulário</label><input id="horario_limite" name="horario_limite" type="time" defaultValue={limite} required /></div>
          </div>
          {lista.length === 0 ? <Vazio>Nenhum colaborador de indicação cadastrado (atividade “Colaborador de indicação”).</Vazio> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Colaborador</th><th>Trabalhados/dia</th><th>Validadas/dia</th><th>Validadas/semana</th><th>Vendas/mês</th><th>Receita/mês (R$)</th></tr></thead>
              <tbody>{lista.map((c) => (
                <tr key={c.id}><td><input type="hidden" name="colaborador" value={c.id} /><b>{c.nome}</b></td>
                  {cel(`trab_${c.id}`, c.meta_trabalhados_dia)}{cel(`valid_dia_${c.id}`, c.meta_validadas_dia)}{cel(`valid_sem_${c.id}`, c.meta_validadas_semana)}{cel(`vendas_mes_${c.id}`, c.meta_vendas_mes)}{cel(`receita_mes_${c.id}`, c.meta_receita_mes)}</tr>
              ))}</tbody>
            </table></div>
          )}
        </FormEstado>
      </div>
    </>
  );
}
