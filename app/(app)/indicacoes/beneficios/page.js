import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtDataHora } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { TIPOS_BENEFICIO, STATUS_BENEFICIO, gereBeneficios } from '@/lib/indicacao.js';
import { Topo, Aviso, Vazio, Semaforo } from '@/components/Ui.js';
import { atualizarBeneficio } from '../actions.js';

export const dynamic = 'force-dynamic';
export default async function Beneficios() {
  const u = await exigirUsuario();
  if (!gereBeneficios(u)) return <Aviso tipo="erro">Área do gerente de Indicação e do Financeiro.</Aviso>;
  const lista = await q(`SELECT b.*, s.nome aluno, s.telefone, s.email, c.nome campanha FROM referral_benefits b JOIN students s ON s.id=b.referrer_id JOIN referral_campaigns c ON c.id=b.campaign_id
                          ORDER BY CASE b.status WHEN 'pendente' THEN 0 WHEN 'aprovado' THEN 1 ELSE 2 END, b.created_at`);
  return (
    <>
      <Topo titulo="Benefícios" descricao="Gerados automaticamente quando o aluno atinge a quantidade de indicações validadas da campanha."><a className="btn sec" href="/indicacoes">Voltar</a></Topo>
      {lista.length === 0 ? <Vazio>Nenhum benefício gerado ainda.</Vazio> : (
        <div className="painel tabela-wrap"><table>
          <thead><tr><th>Aluno</th><th>Benefício</th><th className="num">Valor</th><th>Sorteio</th><th>Gerado em</th><th>Status</th></tr></thead>
          <tbody>{lista.map((b) => {
            const atrasado = ['pendente', 'aprovado'].includes(b.status) && (Date.now() - new Date(b.created_at)) / 86400000 > 7;
            return (
              <tr key={b.id}><td><b>{b.aluno}</b><br /><span className="suave pequeno">{b.telefone || b.email}</span></td>
                <td className="pequeno">{TIPOS_BENEFICIO[b.tipo]} · {b.descricao}<br /><span className="suave">{b.campanha} · {b.marco}º benefício</span></td>
                <td className="num">{moeda(Number(b.valor))}</td><td>{b.numero_sorteio ? `Nº ${b.numero_sorteio}` : '—'}</td>
                <td className="pequeno">{fmtDataHora(b.created_at)}{atrasado && <> <Semaforo cor="vermelho" texto="Atrasado" /></>}</td>
                <td><form action={atualizarBeneficio} className="acoes-linha" style={{ flexWrap: 'nowrap' }}><input type="hidden" name="id" value={b.id} />
                  <select name="status" defaultValue={b.status} aria-label="Status do benefício" style={{ width: 'auto' }}>{Object.entries(STATUS_BENEFICIO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
                  <button className="btn sec peq">Salvar</button></form></td></tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
