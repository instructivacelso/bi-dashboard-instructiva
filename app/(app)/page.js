import { exigirUsuario } from '@/lib/auth.js';
import { q1 } from '@/lib/db.js';
import { tarefasDoDia, problemasAbertos, pendenciasEquipe } from '@/lib/dados.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { DESCRICOES } from '@/lib/formularios.js';
import { vePainelEmpresa, gerenteDe, ehSuperadmin } from '@/lib/perm.js';
import { Topo, StatusTarefa, Vazio } from '@/components/Ui.js';
import { Target, MessageCircle, Workflow, Clapperboard, Radio, ClipboardList, Rocket, UserPlus, BarChart3, Tv, Check, Briefcase, Users, Wallet, UsersRound, GraduationCap, HeartHandshake } from 'lucide-react';
import { veDashboardComercial, cidadesVisiveis } from '@/lib/comercial.js';
import { ehDoSuporte, veTodoSuporte } from '@/lib/suporte.js';
import { ehDaIndicacao, veTodaIndicacao } from '@/lib/indicacao.js';
import { ehDoCs, veTodoCs } from '@/lib/cscx.js';

const ICONE = { cs_gerente: Users, indicacao_gerente: Users, indicacao_colaborador: ClipboardList, suporte_fechamento: ClipboardList, suporte_gerente: Users, trafego: Target, whatsapp: MessageCircle, automacao: Workflow, editor: Clapperboard, live: Radio, gerente: ClipboardList, vendedor: Briefcase, gerente_comercial: Users, financeiro_fechamento: Wallet, rh_fechamento: UsersRound, professor_diario: GraduationCap, posvenda_fechamento: HeartHandshake };
const hora = (d) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

function CartaoFormulario({ t }) {
  const I = ICONE[t.form] || ClipboardList;
  if (t.aguardando) {
    return (
      <article className="painel cartao-form aguardando">
        <div className="cartao-topo"><span className="icone-card"><I aria-hidden="true" /></span><span className="selo neutro">Aguardando</span></div>
        <h2>{t.titulo}</h2>
        <p className="suave pequeno">Nenhum lançamento aberto no momento. Quando o gerente abrir um, seu formulário libera aqui.</p>
      </article>
    );
  }
  return (
    <a href={t.href || `/marketing/${t.form}?lancamento=${t.lancamento.id}`} className={`painel cartao-form ${t.concluido ? 'feito' : ''}`}>
      <div className="cartao-topo"><span className="icone-card"><I aria-hidden="true" /></span><StatusTarefa concluido={t.concluido} /></div>
      <h2>{t.titulo}</h2>
      {t.lancamento && <p className="cartao-lanc">{t.lancamento.nome}</p>}
      <p className="suave pequeno">{t.descricao || DESCRICOES[t.form]}</p>
      <div className="cartao-rodape">
        <span className="suave pequeno">{t.ultimoEnvio ? `Enviado às ${hora(t.ultimoEnvio)}` : 'Ainda não enviado hoje'}{t.detalhe ? ` · ${t.detalhe}` : ''}</span>
        <span className={`btn ${t.concluido ? 'sec' : ''}`}>{t.concluido ? 'Revisar' : 'Preencher agora'}</span>
      </div>
    </a>
  );
}

export default async function Inicio() {
  const u = await exigirUsuario();
  const dia = hoje();
  const prim = u.nome.split(' ')[0];
  const iniciais = u.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const tarefas = await tarefasDoDia(u, dia);
  const funcoes = [...new Set(u.lotacoes.map((l) => l.subsetorNome || l.setorNome))];
  const gestor = ehSuperadmin(u) || vePainelEmpresa(u) || gerenteDe(u, 'marketing');

  // ---------- Colaborador / prestador externo ----------
  if (!gestor) {
    const pend = tarefas.filter((t) => !t.concluido && !t.aguardando).length;
    const prob = await problemasAbertos(u);
    const acoes = prob.acoes.filter((x) => x.responsavel_id === u.id);
    return (
      <>
        <Topo avatar={iniciais} titulo={`Olá, ${prim}`} descricao={funcoes.join(' · ') || u.papel_nome}>
          {ehDoSuporte(u) && <a className="btn" href="/suporte">Meus atendimentos</a>}
          {ehDaIndicacao(u) && <a className="btn" href="/indicacoes">Indicações</a>}
          {ehDoCs(u) && <a className="btn" href="/cs">Minha carteira</a>}
          {veDashboardComercial(u) && <a className="btn sec" href="/comercial/dashboard">{cidadesVisiveis(u).length ? 'Dashboard comercial' : 'Meus resultados'}</a>}
        </Topo>
        <p className="frase-dia">
          {tarefas.length === 0 ? (ehDoCs(u) ? 'Acompanhe sua carteira de alunos pelo botão acima.' : ehDaIndicacao(u) ? 'Trabalhe suas indicações pelo botão acima.' : veDashboardComercial(u) ? 'Acompanhe os números do time pelo Dashboard comercial.' : 'Seu setor ainda não tem formulário. Ele aparece aqui assim que for publicado.')
            : pend ? `Você tem ${pend} ${pend === 1 ? 'formulário' : 'formulários'} para preencher hoje, ${fmtData(dia).slice(0, 5)}.`
            : tarefas.every((t) => t.aguardando) ? 'Nada para preencher agora.' : 'Tudo preenchido hoje. Obrigado!'}
        </p>
        <div className="grade g2">{tarefas.map((t, k) => <CartaoFormulario key={k} t={t} />)}</div>
        {acoes.length > 0 && (
          <section className="secao painel">
            <div className="painel-cab"><h2>Ações sob sua responsabilidade</h2></div>
            <table><tbody>{acoes.slice(0, 5).map((a) => (
              <tr key={a.id}><td>{a.acao}<br /><span className="suave pequeno">{a.lancamento || 'Geral'}{a.prazo ? ` · prazo ${fmtData(a.prazo)}` : ''}</span></td></tr>
            ))}</tbody></table>
          </section>
        )}
        {tarefas.some((t) => !t.aguardando) && <p style={{ marginTop: 18 }}><a href="/historico">Ver meus envios anteriores</a></p>}
      </>
    );
  }

  // ---------- Administrador / gerente / diretoria ----------
  const [ativos, equipe, pend] = await Promise.all([
    q1(`SELECT COUNT(*)::int n FROM launches WHERE status IN ('captacao','evento','vendas')`),
    q1(`SELECT COUNT(DISTINCT a.user_id)::int n FROM user_department_assignments a JOIN users x ON x.id=a.user_id AND x.ativo
          JOIN subdepartments s ON s.id=a.subdepartment_id WHERE s.formulario IS NOT NULL`),
    pendenciasEquipe(dia),
  ]);
  const feitos = pend.filter((p) => p.concluido).length;
  const passos = [
    { ok: equipe.n > 0, titulo: 'Cadastrar a equipe', texto: 'Crie o acesso de cada pessoa e marque a atividade dela.', href: '/setor/marketing/equipe', icone: UserPlus },
    { ok: ativos.n > 0, titulo: 'Abrir um lançamento', texto: 'Com status Captação, Evento ou Vendas. É o que libera os formulários.', href: '/admin/lancamentos/novo', icone: Rocket },
    { ok: pend.length > 0 && feitos > 0, titulo: 'Equipe preenchendo', texto: 'Os formulários do dia chegam aqui e vão para o dashboard.', href: '/admin/pendencias', icone: ClipboardList },
  ];
  const configurado = passos.every((p) => p.ok);
  const minhas = tarefas.filter((t) => !t.aguardando);

  return (
    <>
      <Topo avatar={iniciais} titulo={`Olá, ${prim}`} descricao={`Hoje é ${fmtData(dia)}.`} />

      {!configurado && (
        <section className="painel roteiro">
          <h2>Para começar</h2>
          <div className="passos">
            {passos.map((p, k) => (
              <a key={k} href={p.href} className={`passo ${p.ok ? 'ok' : ''}`}>
                <span className="passo-num">{p.ok ? <Check aria-hidden="true" /> : k + 1}</span>
                <div><b>{p.titulo}</b><span>{p.texto}</span></div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="grade g4 atalhos">
        <a className="painel atalho" href="/marketing/dashboard"><BarChart3 aria-hidden="true" /><b>Marketing</b><span>{feitos} de {pend.length} formulários de hoje</span></a>
        {veTodoCs(u) && <a className="painel atalho" href="/cs/dashboard"><Users aria-hidden="true" /><b>CS/CX</b><span>Saúde da base</span></a>}
        {veTodaIndicacao(u) && <a className="painel atalho" href="/indicacoes/dashboard"><Users aria-hidden="true" /><b>Indicação</b><span>Funil e benefícios</span></a>}
        {veTodoSuporte(u) && <a className="painel atalho" href="/suporte/dashboard"><Users aria-hidden="true" /><b>Suporte</b><span>Atendimentos e SLA</span></a>}
        {veDashboardComercial(u) && <a className="painel atalho" href="/comercial/dashboard"><Briefcase aria-hidden="true" /><b>Comercial</b><span>Jesuítas e Toledo</span></a>}
        <a className="painel atalho" href="/admin/lancamentos"><Rocket aria-hidden="true" /><b>Lançamentos</b><span>{ativos.n} {ativos.n === 1 ? 'ativo' : 'ativos'}</span></a>
        {ehSuperadmin(u) && <a className="painel atalho" href="/admin/usuarios"><UserPlus aria-hidden="true" /><b>Pessoas</b><span>{equipe.n} com formulário</span></a>}
        {vePainelEmpresa(u) && <a className="painel atalho" href="/admin/tv"><Tv aria-hidden="true" /><b>Painel da TV</b><span>Abrir na televisão</span></a>}
      </div>

      {minhas.length > 0 && (
        <section className="secao">
          <h2>Seus formulários</h2>
          <div className="grade g2">{minhas.map((t, k) => <CartaoFormulario key={k} t={t} />)}</div>
        </section>
      )}

      {pend.length > 0 && (
        <section className="secao painel">
          <div className="painel-cab"><h2>Quem já enviou hoje</h2><span className="suave pequeno">{feitos} de {pend.length}</span></div>
          <div className="tabela-wrap"><table><tbody>
            {pend.sort((a, b) => a.concluido - b.concluido).map((p) => (
              <tr key={`${p.usuarioId}-${p.form}-${p.lancamento.id}`}><td><b>{p.usuario}</b><br /><span className="suave pequeno">{p.titulo} · {p.lancamento.nome}</span></td><td><StatusTarefa concluido={p.concluido} /></td></tr>
            ))}
          </tbody></table></div>
        </section>
      )}
      {pend.length === 0 && configurado === false && <Vazio>Quando houver lançamento aberto e equipe cadastrada, os envios do dia aparecem aqui.</Vazio>}
    </>
  );
}
