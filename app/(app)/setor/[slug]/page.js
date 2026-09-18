import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { acessaSetor, formulariosDo, veDashboardSetor } from '@/lib/perm.js';
import { tarefasDoDia, pendenciasEquipe } from '@/lib/dados.js';
import { hoje } from '@/lib/datas.js';
import { Topo, Vazio, Aviso } from '@/components/Ui.js';

export default async function Setor(props) {
  const params = await props.params;
  const u = await exigirUsuario();
  const setor = await q1('SELECT * FROM departments WHERE slug=$1 AND ativo', [params.slug]);
  if (!setor) notFound();
  if (!acessaSetor(u, setor.slug)) {
    return <><Topo titulo={setor.nome} /><Aviso tipo="erro">Você não tem acesso a este setor.</Aviso></>;
  }
  const subs = await q('SELECT * FROM subdepartments WHERE department_id=$1 AND ativo ORDER BY ordem', [setor.id]);

  if (!setor.modulo_ativo) {
    return (
      <>
        <Topo titulo={setor.nome} descricao={setor.descricao} />
        <div className="painel">
          <h2>Módulo em configuração</h2>
          <p className="suave" style={{ marginTop: 8, maxWidth: '70ch' }}>
            A estrutura deste setor já está pronta para receber subsetores, formulários, indicadores, metas, histórico e dashboard.
            Os formulários serão liberados depois que as métricas forem definidas e aprovadas pela Escola Instructiva.
          </p>
          {subs.length > 0 && <ul>{subs.map((s) => <li key={s.id}>{s.nome}</li>)}</ul>}
        </div>
      </>
    );
  }

  const dia = hoje();
  const meus = formulariosDo(u);
  const minhas = await tarefasDoDia(u, dia);
  const gestor = veDashboardSetor(u, setor.slug);
  const equipe = gestor ? await pendenciasEquipe(dia, setor.slug) : [];
  // Colaborador vê só os cards das próprias atividades; gestor e diretoria veem todos
  const visiveis = gestor ? subs : subs.filter((s) => meus.includes(s.formulario));

  return (
    <>
      <Topo titulo={setor.nome} descricao={setor.descricao}>
        {gestor && <a className="btn" href="/marketing/dashboard">Abrir dashboard</a>}
      </Topo>
      {visiveis.length === 0 && <Vazio>Nenhuma atividade atribuída a você neste setor.</Vazio>}
      <div className="grade g3">
        {visiveis.map((s) => {
          const minhasDoForm = minhas.filter((t) => t.form === s.formulario);
          const daEquipe = equipe.filter((t) => t.form === s.formulario);
          const feitas = daEquipe.filter((t) => t.concluido).length;
          const preenche = meus.includes(s.formulario);
          const pendenteMeu = minhasDoForm.find((t) => !t.concluido);
          return (
            <article className="painel atividade" key={s.id}>
              <h3>{s.nome}</h3>
              <p>{s.descricao}</p>
              <div className="pequeno">
                <strong>Formulário:</strong> {s.formulario_ativo ? 'ativo' : 'desativado pelo administrador'}
              </div>
              <div className="acoes-linha">
                {preenche && (minhasDoForm.length === 0
                  ? <span className="selo neutro">Nada para hoje</span>
                  : pendenteMeu
                    ? <span className="selo laranja">Pendente ({minhasDoForm.filter((t) => !t.concluido).length})</span>
                    : <span className="selo verde">Concluído hoje</span>)}
                {gestor && daEquipe.length > 0 && (
                  <span className={`selo ${feitas === daEquipe.length ? 'verde' : 'amarelo'}`}>Equipe: {feitas} de {daEquipe.length}</span>
                )}
                {gestor && daEquipe.length === 0 && !preenche && <span className="selo neutro">Sem envios previstos hoje</span>}
              </div>
              <div className="rodape">
                {preenche && s.formulario_ativo && minhasDoForm.length > 0 && (
                  <a className="btn peq" href={`/marketing/${s.formulario}${pendenteMeu ? `?lancamento=${pendenteMeu.lancamento.id}` : ''}`}>Preencher formulário</a>
                )}
                <a className="btn sec peq" href={`/historico?form=${s.formulario}`}>{gestor ? 'Histórico da equipe' : 'Meu histórico'}</a>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
