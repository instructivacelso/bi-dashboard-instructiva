import { exigirUsuario } from '@/lib/auth.js';
import { veRh, PRONTIDAO, NIVEIS } from '@/lib/rh.js';
import { sucessaoLista, listaColaboradores } from '@/lib/dadosRh.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarSucessao } from '../actions.js';

export const dynamic = 'force-dynamic';
const CORP = { alta: 'vermelho', media: 'amarelo', baixa: 'verde' };

export default async function Sucessao() {
  const u = await exigirUsuario();
  if (!veRh(u)) return <><Topo titulo="Plano de sucessão" /><Aviso tipo="erro">Área do gerente de RH e da diretoria.</Aviso></>;
  const [lista, colabs] = await Promise.all([sucessaoLista(), listaColaboradores({ status: 'ativo' })]);
  const opt = (o) => Object.entries(o).map(([v, r]) => <option key={v} value={v}>{r}</option>);

  return (
    <>
      <Topo titulo="Plano de sucessão" descricao="Posições-chave, sucessores, prontidão e risco de perda."><a className="btn sec" href="/rh">Painel</a></Topo>

      <section className="secao painel"><h2>Registrar posição-chave</h2>
        <FormEstado action={salvarSucessao} botao="Salvar sucessão">
          <div className="linha-campos">
            <div className="campo"><label>Posição-chave (colaborador)</label><select name="employee_id" required defaultValue=""><option value="">Escolha…</option>{colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div className="campo"><label>Sucessor</label><select name="sucessor_id" defaultValue=""><option value="">Sem sucessor</option>{colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div className="campo"><label>Prontidão</label><select name="prontidao" defaultValue="medio_prazo">{opt(PRONTIDAO)}</select></div>
          </div>
          <div className="linha-campos">
            <div className="campo"><label>Risco de perda</label><select name="risco_perda" defaultValue="medio">{opt(NIVEIS)}</select></div>
            <div className="campo"><label>Impacto da saída</label><select name="impacto" defaultValue="medio">{opt(NIVEIS)}</select></div>
            <div className="campo"><label>Plano de retenção</label><input name="plano_retencao" /></div>
          </div>
        </FormEstado>
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Matriz de sucessão</h2></div>
        {lista.length === 0 ? <Aviso>Nenhuma posição-chave mapeada ainda.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Posição-chave</th><th>Setor</th><th>Sucessor</th><th>Prontidão</th><th>Risco</th><th>Impacto</th><th>Prioridade</th></tr></thead>
            <tbody>{lista.map((s) => (
              <tr key={s.id}><td>{s.colaborador}<div className="suave pequeno">{s.cargo || ''}</div></td><td>{s.setor || '—'}</td><td>{s.sucessor || <span className="suave">— sem sucessor —</span>}</td>
                <td>{PRONTIDAO[s.prontidao]}</td><td>{NIVEIS[s.risco_perda]}</td><td>{NIVEIS[s.impacto]}</td>
                <td><Semaforo cor={CORP[s.prioridade]} texto={s.prioridade === 'alta' ? 'Alta' : s.prioridade === 'media' ? 'Média' : 'Baixa'} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
