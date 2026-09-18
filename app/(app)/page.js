import { exigirUsuario } from '@/lib/auth.js';
import { tarefasDoDia, lancamentosDoUsuario, problemasAbertos } from '@/lib/dados.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { STATUS_LANCAMENTO, lancamentoAberto } from '@/lib/formularios.js';
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
    return (
      <>
        <Topo avatar={iniciais} titulo={`Olá, ${prim}`} descricao={pendentes ? `Você tem ${pendentes} ${pendentes === 1 ? 'formulário' : 'formulários'} para preencher hoje.` : tarefas.length ? 'Tudo preenchido hoje. Obrigado!' : 'Nenhum formulário para hoje.'} />
        {tarefas.length === 0 ? <Vazio>Quando houver um formulário para você, ele aparece aqui.</Vazio> : (
          <div className="grade g2">
            {tarefas.map((t) => (
              <a key={`${t.form}-${t.lancamento.id}`} href={`/marketing/${t.form}?lancamento=${t.lancamento.id}`} className="painel atividade" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="painel-cab" style={{ marginBottom: 0 }}>
                  <h2>{t.titulo}</h2>
                  <StatusTarefa concluido={t.concluido} />
                </div>
                <p>{t.lancamento.nome}</p>
                <div className="rodape"><span className={`btn ${t.concluido ? 'sec' : ''}`}>{t.concluido ? 'Revisar envio' : 'Preencher agora'}</span></div>
              </a>
            ))}
          </div>
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
