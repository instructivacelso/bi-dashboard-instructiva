import { exigirUsuario } from '@/lib/auth.js';
import { problemasAbertos } from '@/lib/dados.js';
import { fmtData, hoje } from '@/lib/datas.js';
import { ETAPAS_AUTOMACAO_ROTULOS, PRIORIDADES } from '@/lib/formularios.js';
import { ehDiretoria, ehSuperadmin, gerenteDe, formulariosDo } from '@/lib/perm.js';
import { Topo, Semaforo, Vazio } from '@/components/Ui.js';
import { atualizarAcao, resolverIncidente } from './actions.js';

export const dynamic = 'force-dynamic';
const STATUS = { aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };

export default async function Acoes() {
  const u = await exigirUsuario();
  const { acoes, incidentes } = await problemasAbertos(u);
  const dia = hoje();
  const resolveInc = !ehDiretoria(u) && (ehSuperadmin(u) || gerenteDe(u, 'marketing') || formulariosDo(u).includes('automacao'));
  return (
    <>
      <Topo titulo="Ações e problemas" descricao="Incidentes da automação e ações corretivas em aberto. Ações vêm do fechamento do gerente e dos problemas informados nos formulários." />
      <section className="painel">
        <div className="painel-cab"><h2>Incidentes da automação</h2></div>
        {incidentes.length === 0 ? <p className="suave">Nenhum incidente aberto.</p> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Prioridade</th><th>Incidente</th><th>Afetados</th><th>Previsão</th><th /></tr></thead>
            <tbody>{incidentes.map((i) => (
              <tr key={i.id}>
                <td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto={PRIORIDADES[i.prioridade]} /></td>
                <td>{i.descricao}<br /><span className="suave pequeno">{i.lancamento} · {ETAPAS_AUTOMACAO_ROTULOS[i.etapa]} · {fmtData(i.data_ref)} · {i.autor}</span></td>
                <td>{i.afetados ?? '—'}</td>
                <td>{i.previsao_solucao ? <span className={i.previsao_solucao < dia ? 'selo vermelho' : ''}>{fmtData(i.previsao_solucao)}</span> : '—'}</td>
                <td>{resolveInc && <form action={resolverIncidente}><input type="hidden" name="id" value={i.id} /><button className="btn sec peq">Marcar resolvido</button></form>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section className="painel">
        <div className="painel-cab"><h2>Ações corretivas</h2></div>
        {acoes.length === 0 ? <Vazio>Nenhuma ação em aberto.</Vazio> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
            <tbody>{acoes.map((a) => {
              const pode = !ehDiretoria(u) && (ehSuperadmin(u) || gerenteDe(u, 'marketing') || a.responsavel_id === u.id);
              return (
                <tr key={a.id}>
                  <td>{a.acao}{a.gargalo && <><br /><span className="pequeno">Gargalo: {a.gargalo}</span></>}<br /><span className="suave pequeno">{a.lancamento || 'Geral'} · desde {fmtData(a.data_ref)}</span></td>
                  <td>{a.responsavel || '—'}</td>
                  <td>{a.prazo ? <span className={a.prazo < dia ? 'selo vermelho' : ''}>{fmtData(a.prazo)}</span> : '—'}</td>
                  <td>{pode ? (
                    <form action={atualizarAcao} className="acoes-linha">
                      <input type="hidden" name="id" value={a.id} />
                      <select name="status" defaultValue={a.status} aria-label="Status da ação" style={{ width: 'auto' }}>
                        {Object.entries(STATUS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                      </select>
                      <button className="btn sec peq">Salvar</button>
                    </form>
                  ) : STATUS[a.status]}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
