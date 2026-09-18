import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { acessaSetor, formulariosDo, veDashboardSetor, ehSuperadmin, gerenteDe } from '@/lib/perm.js';
import { tarefasDoDia } from '@/lib/dados.js';
import { hoje } from '@/lib/datas.js';
import { Topo, Vazio, Aviso, StatusTarefa } from '@/components/Ui.js';
import { Target, MessageCircle, Workflow, Clapperboard, Radio, ClipboardList, Users, BarChart3 } from 'lucide-react';

const ICONE_FORM = { trafego: Target, whatsapp: MessageCircle, automacao: Workflow, editor: Clapperboard, live: Radio, gerente: ClipboardList };

// Página do setor: só os formulários. Equipe e dashboard ficam em botões no topo.
export default async function Setor(props) {
  const params = await props.params;
  const u = await exigirUsuario();
  const setor = await q1('SELECT * FROM departments WHERE slug=$1 AND ativo', [params.slug]);
  if (!setor) notFound();
  if (!acessaSetor(u, setor.slug)) return <><Topo titulo={setor.nome} /><Aviso tipo="erro">Você não tem acesso a este setor.</Aviso></>;

  const gestor = ehSuperadmin(u) || gerenteDe(u, setor.slug);
  const botoes = (
    <>
      {gestor && <a className="btn sec" href={`/setor/${setor.slug}/equipe`}><Users aria-hidden="true" /> Equipe</a>}
      {veDashboardSetor(u, setor.slug) && setor.slug === 'marketing' && <a className="btn" href="/marketing/dashboard"><BarChart3 aria-hidden="true" /> Dashboard</a>}
    </>
  );

  if (!setor.modulo_ativo) {
    const lista = await q('SELECT slug, nome FROM subdepartments WHERE department_id=$1 AND ativo ORDER BY ordem, id', [setor.id]);
    return (
      <>
        <Topo titulo={setor.nome}>{botoes}</Topo>
        {lista.length > 0 && (
          <div className="grade g3" style={{ marginBottom: 16 }}>
            {lista.map((x) => (
              <div key={x.slug} id={x.slug} className="painel atividade">
                <div className="icone-card"><ClipboardList aria-hidden="true" /></div>
                <h3>{x.nome}</h3>
                <span className="selo neutro">Formulário em preparação</span>
              </div>
            ))}
          </div>
        )}
        {lista.length === 0 && <Vazio>O formulário deste setor ainda vai ser publicado.</Vazio>}
      </>
    );
  }

  const dia = hoje();
  const subs = await q('SELECT * FROM subdepartments WHERE department_id=$1 AND ativo AND formulario IS NOT NULL AND formulario_ativo ORDER BY ordem', [setor.id]);
  const meus = formulariosDo(u);
  const tarefas = await tarefasDoDia(u, dia);
  const visiveis = veDashboardSetor(u, setor.slug) ? subs : subs.filter((s) => meus.includes(s.formulario));

  return (
    <>
      <Topo titulo={setor.nome}>{botoes}</Topo>
      {visiveis.length === 0 ? <Vazio>Nenhum formulário atribuído a você neste setor.</Vazio> : (
        <div className="grade g3">
          {visiveis.map((s) => {
            const minhas = tarefas.filter((t) => t.form === s.formulario);
            const pend = minhas.find((t) => !t.concluido);
            const I = ICONE_FORM[s.formulario] || ClipboardList;
            return (
              <a key={s.id} href={`/marketing/${s.formulario}${pend ? `?lancamento=${pend.lancamento.id}` : ''}`} className="painel atividade" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="painel-cab" style={{ marginBottom: 0 }}>
                  <div className="icone-card"><I aria-hidden="true" /></div>
                  {minhas.length > 0 && <StatusTarefa concluido={!pend} />}
                </div>
                <h3>{s.nome}</h3>
                <div className="rodape"><span className="btn peq">{pend ? 'Preencher' : 'Abrir formulário'}</span></div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
