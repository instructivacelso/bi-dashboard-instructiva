import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { lancaComercial } from '@/lib/perm.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero } from '@/lib/formato.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarComercial } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function Comercial() {
  const u = await exigirUsuario();
  if (!lancaComercial(u)) return <Aviso tipo="erro">Seu perfil não lança vendas.</Aviso>;
  const [lancs, recentes] = await Promise.all([
    q(`SELECT id, nome FROM launches WHERE status <> 'cancelado' ORDER BY id DESC`),
    q(`SELECT c.*, l.nome lancamento, u.nome autor FROM commercial_launch_results c JOIN launches l ON l.id=c.launch_id LEFT JOIN users u ON u.id=c.updated_by ORDER BY c.data_ref DESC, c.id DESC LIMIT 60`),
  ]);
  return (
    <>
      <Topo titulo="Vendas por lançamento" descricao="Lançamento manual até a integração com Hotmart, TMB e Greenn. O Marketing não precisa redigitar esses números: eles alimentam CAC, ROAS e o fim do funil." />
      <div className="grade g2" style={{ alignItems: 'start' }}>
        <div className="painel">
          <FormEstado action={salvarComercial} botao="Salvar resultado">
            <div className="campo"><label htmlFor="launch_id">Lançamento</label>
              <select id="launch_id" name="launch_id" required><option value="">Escolha…</option>{lancs.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
            </div>
            <div className="linha-campos">
              <div className="campo"><label htmlFor="data_ref">Data</label><input id="data_ref" name="data_ref" type="date" defaultValue={hoje()} /></div>
              <div className="campo"><label htmlFor="vendas">Vendas no dia</label><input id="vendas" name="vendas" type="text" inputMode="numeric" required /></div>
              <div className="campo"><label htmlFor="faturamento">Faturamento no dia (R$)</label><input id="faturamento" name="faturamento" type="text" inputMode="decimal" required /></div>
            </div>
            <small className="suave">Se já existir valor nesse dia para o lançamento, ele será substituído (fica registrado na auditoria).</small>
          </FormEstado>
        </div>
        <div className="painel tabela-wrap">
          <h2>Últimos lançamentos</h2>
          <table><thead><tr><th>Data</th><th>Lançamento</th><th className="num">Vendas</th><th className="num">Faturamento</th><th>Por</th></tr></thead>
            <tbody>{recentes.map((r) => <tr key={r.id}><td>{fmtData(r.data_ref)}</td><td>{r.lancamento}</td><td className="num">{numero(r.vendas)}</td><td className="num">{moeda(r.faturamento, 0)}</td><td className="pequeno">{r.autor}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
