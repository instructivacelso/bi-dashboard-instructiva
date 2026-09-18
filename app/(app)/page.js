import { exigirUsuario } from '@/lib/auth.js';
import { tarefasDoDia, lancamentosDoUsuario, problemasAbertos } from '@/lib/dados.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { STATUS_LANCAMENTO, lancamentoAberto, DESCRICOES } from '@/lib/formularios.js';
import { vePainelEmpresa, veDashboardSetor } from '@/lib/perm.js';
import { Topo, StatusTarefa, Vazio, Semaforo } from '@/components/Ui.js';

export default async function Inicio() {
  const u = await exigirUsuario();
  const dia = hoje();
  const [tarefas, lancs, problemas] = await Promise.all([tarefasDoDia(u, dia), lancamentosDoUsuario(u), problemasAbertos(u)]);
  const ativos = lancs.filter(lancamentoAberto);
  const pendentes = tarefas.filter((t) => !t.concluido).length;
  const funcoes = [...new Set(u.lotacoes.map((l) => (l.subsetorNome ? `${l.setorNome} · ${l.subsetorNome}` : l.setorNome)))];
  const prim = u.nome.split(' ')[0];
  const iniciais = u.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  // Tela simples para quem só preenche formulário
  if (['colaborador', 'externo'].includes(u.papel)) {
    const abertos = [...problemas.incidentes.filter((i) => i.responsavel_id === u.id || i.created_by === u.id), ...problemas.acoes.filter((x) => x.responsavel_id === u.id)];
    return (
      <>
        <Topo avatar={iniciais} titulo={`Olá, ${prim}`} descricao={`${funcoes.join(', ') || u.papel_nome} · ${ativos.length} ${ativos.length === 1 ? 'lançamento ativo' : 'lançamentos ativos'}`}>
          <a className="btn sec" href="/historico">Ver histórico</a>
        </Topo>
        {tarefas.length === 0 ? <Vazio>Nenhum formulário para hoje. Quando houver, ele aparece aqui.</Vazio> : (
          <div className="grade g2">
            {tarefas.map((t) => (
              <article key={`${t.form}-${t.lancamento.id}`} className="painel atividade">
                <div className="painel-cab" style={{ marginBottom: 0 }}>
                  <h2>{t.titulo}</h2>
                  <StatusTarefa concluido={t.concluido} />
                </div>
                <p><b style={{ color: 'var(--texto)' }}>{t.lancamento.nome}</b></p>
                <p className="pequeno">{DESCRICOES[t.form]}</p>
                <p className="pequeno">{t.ultimoEnvio ? `Último envio hoje às ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(t.ultimoEnvio))}` : 'Ainda não enviado hoje'}{t.detalhe ? ` · ${t.detalhe}` : ''}</p>
                <div className="rodape">
                  <a className={`btn ${t.concluido ? 'sec' : ''}`} href={`/marketing/${t.form}?lancamento=${t.lancamento.id}`}>{t.concluido ? 'Revisar envio' : 'Preencher agora'}</a>
                  <a className="btn sec" href={`/historico?form=${t.form}`}>Ver histórico</a>
                </div>
              </article>
            ))}
          </div>
        )}
        {abertos.length > 0 && (
          <section className="secao painel">
            <div className="painel-cab"><h2>Problemas e ações em aberto</h2></div>
            <table><tbody>{abertos.slice(0, 6).map((x, k) => (
              <tr key={k}><td><span className={`selo ${x.prioridade ? 'vermelho' : 'laranja'}`}>{x.prioridade ? 'Incidente' : 'Ação'}</span></td><td>{x.descricao || x.acao}<br /><span className="suave pequeno">{x.lancamento || 'Geral'}</span></td></tr>
            ))}</tbody></table>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <Topo
        avatar={iniciais}
        titulo={`Olá, ${prim}`}
        descricao={`${u.papel_nome}${funcoes.length ? ` — ${funcoes.join(', ')}` : ''}. Hoje é ${fmtData(dia)}.`}
      >
        <a className="btn sec" href="/historico">Meu histórico</a>
        {veDashboardSetor(u, 'marketing') && <a className="btn" href="/marketing/dashboard">Dashboard do Marketing</a>}
      </Topo>

      <section className="secao">
        <h2>{tarefas.length ? (pendentes ? `Você tem ${pendentes} ${pendentes === 1 ? 'formulário pendente' : 'formulários pendentes'} hoje` : 'Tudo preenchido hoje') : 'Formulários de hoje'}</h2>
        {tarefas.length === 0 ? (
          <Vazio>
            {vePainelEmpresa(u)
              ? 'Seu perfil acompanha os resultados e não tem formulários diários.'
              : 'Nenhum formulário para hoje. Eles aparecem quando você tem um lançamento ativo atribuído.'}
          </Vazio>
        ) : (
          <div className="grade g3">
            {tarefas.map((t) => (
              <div className="painel atividade" key={`${t.form}-${t.lancamento.id}`}>
                <div className="painel-cab" style={{ marginBottom: 0 }}>
                  <h3>{t.titulo}</h3>
                  <StatusTarefa concluido={t.concluido} />
                </div>
                <p>{t.lancamento.nome}</p>
                <div className="rodape">
                  <a className={`btn ${t.concluido ? 'sec' : ''} peq`} href={`/marketing/${t.form}?lancamento=${t.lancamento.id}`}>
                    {t.concluido ? 'Revisar envio' : 'Preencher formulário'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="secao grade g2">
        <div className="painel">
          <div className="painel-cab"><h2>Meus lançamentos ativos</h2></div>
          {ativos.length === 0 ? (
            <p className="suave">Nenhum lançamento ativo atribuído a você.</p>
          ) : (
            <table>
              <thead><tr><th>Lançamento</th><th>Fase</th><th>Live</th></tr></thead>
              <tbody>
                {ativos.map((l) => (
                  <tr key={l.id}><td>{l.nome}<br /><span className="suave pequeno">{l.produto || '—'}</span></td><td>{STATUS_LANCAMENTO[l.status]}</td><td>{fmtData(l.data_live)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="painel">
          <div className="painel-cab"><h2>Problemas em aberto</h2><a href="/acoes" className="pequeno">Ver todos</a></div>
          {problemas.incidentes.length + problemas.acoes.length === 0 ? (
            <p className="suave">Nada em aberto sob sua responsabilidade.</p>
          ) : (
            <table>
              <tbody>
                {problemas.incidentes.slice(0, 4).map((i) => (
                  <tr key={`i${i.id}`}>
                    <td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto={`Incidente ${i.prioridade === 'critica' ? 'crítico' : i.prioridade === 'media' ? 'médio' : i.prioridade}`} /></td>
                    <td>{i.descricao}<br /><span className="suave pequeno">{i.lancamento} · {i.etapa}</span></td>
                  </tr>
                ))}
                {problemas.acoes.slice(0, 4).map((a) => (
                  <tr key={`a${a.id}`}>
                    <td><span className="selo laranja">Ação</span></td>
                    <td>{a.acao}<br /><span className="suave pequeno">{a.lancamento || 'Geral'} · prazo {fmtData(a.prazo)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
