import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtDataHora } from '@/lib/datas.js';
import { CANAIS, CATEGORIAS, PRIORIDADES, STATUS, FINALIZADOS, SETORES_ENCAMINHAMENTO, situacaoSla, veTodoSuporte, ehDoSuporte, fmtDuracao, minutos } from '@/lib/suporte.js';
import { ticketCompleto, atendentes, regrasSla } from '@/lib/dadosSuporte.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import { Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { salvarTicket } from '../../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const EVENTOS = { aberto: 'Atendimento aberto', atualizado: 'Atualizado', status: 'Status alterado', primeira_resposta: 'Primeira resposta', encaminhado: 'Encaminhado', retorno: 'Retorno do setor', resolvido: 'Resolvido', encerrado: 'Encerrado', reaberto: 'Reaberto', reatribuido: 'Responsável alterado' };
const localDT = (v) => (v ? new Date(new Date(v).getTime() - 3 * 3600000).toISOString().slice(0, 16) : '');

export default async function Ticket(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDoSuporte(u)) return <Aviso tipo="erro">Área da equipe de Suporte.</Aviso>;
  const novo = id === 'novo';
  const t = novo ? null : await ticketCompleto(Number(id));
  if (!novo && !t) notFound();
  if (t && t.responsavel_id !== u.id && t.created_by !== u.id && !veTodoSuporte(u)) return <Aviso tipo="erro">Este atendimento é de outro colaborador.</Aviso>;
  const [produtos, equipe, sla] = await Promise.all([q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'), veTodoSuporte(u) ? atendentes() : [], regrasSla()]);
  const v = t || {};
  const contato = v.aluno_email || v.aluno_telefone || '';
  const situacao = t ? situacaoSla(t) : null;
  const statusOpc = t && FINALIZADOS.includes(t.status) ? { resolvido: STATUS.resolvido, encerrado: STATUS.encerrado, reaberto: STATUS.reaberto }
    : Object.fromEntries(Object.entries(STATUS).filter(([k]) => k !== 'reaberto' || t?.status === 'reaberto'));

  return (
    <>
      <Topo titulo={novo ? 'Novo atendimento' : t.protocolo} descricao={novo ? 'O protocolo, a data, o horário e o atendente são gerados sozinhos.' : `${v.aluno} · aberto em ${fmtDataHora(v.aberto_em)} · responsável ${v.responsavel}`}>
        <a className="btn sec" href="/suporte">Voltar para a fila</a>
      </Topo>
      {sp.criado && <Aviso tipo="ok">Atendimento registrado com o protocolo {t.protocolo}.</Aviso>}
      {t && (
        <section className="grade g4" style={{ marginBottom: 16 }}>
          <div className="painel kpi"><div className="rot">SLA</div><div className="val" style={{ fontSize: '1.2rem' }}><Semaforo cor={situacao === 'vencido' ? 'vermelho' : situacao === 'atencao' ? 'amarelo' : 'verde'} texto={situacao === 'vencido' ? 'Vencido' : situacao === 'atencao' ? 'Perto do limite' : 'No prazo'} /></div>
            <div className="meta">solução até {fmtDataHora(v.sla_solucao_limite)}</div></div>
          <div className="painel kpi"><div className="rot">1ª resposta</div><div className="val" style={{ fontSize: '1.2rem' }}>{v.primeira_resposta_em ? fmtDuracao(minutos(v.aberto_em, v.primeira_resposta_em)) : 'aguardando'}</div></div>
          <div className="painel kpi"><div className="rot">Solução</div><div className="val" style={{ fontSize: '1.2rem' }}>{v.resolvido_em ? fmtDuracao(minutos(v.aberto_em, v.resolvido_em)) : 'em aberto'}</div></div>
          <div className="painel kpi"><div className="rot">Reaberturas</div><div className="val" style={{ fontSize: '1.2rem' }}>{v.reaberturas}</div></div>
        </section>
      )}
      <div className={t ? 'grade g2' : ''} style={{ alignItems: 'start' }}>
        <div className="painel form-claro">
          <FormEstado action={salvarTicket} botao={novo ? 'Registrar atendimento' : 'Salvar atualização'} botaoEnviando="Salvando…" protegerSaida progresso>
            {t && <input type="hidden" name="id" value={t.id} />}
            <Condicionais />
            <Etapas />
            <Sec titulo="Aluno e curso">
              <div className="campo"><span className="rot"><B n="1">Aluno ou solicitante</B></span>
                <div className="linha-campos">
                  <Texto nome="aluno_nome" rotulo="Nome" valor={v.aluno} obrig max={150} />
                  <Texto nome="aluno_contato" rotulo="E-mail ou telefone" valor={contato} obrig max={150} dica="Usado para achar o aluno certo e evitar duplicidade." />
                </div></div>
              <Selecao nome="produto" rotulo={<B n="2">Curso ou produto</B>} valor={t ? (v.product_id ? String(v.product_id) : 'geral') : ''} opcoes={[{ valor: 'geral', rotulo: 'Atendimento geral' }, ...produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))]} />
              <Selecao nome="canal" rotulo={<B n="3">Canal</B>} valor={v.canal} opcoes={opc(CANAIS)} />
            </Sec>
            <Sec titulo="O problema">
              <Selecao nome="categoria" rotulo={<B n="4">Categoria do problema</B>} valor={v.categoria} opcoes={opc(CATEGORIAS)} />
              <Texto nome="descricao" rotulo={<B n="5">Descrição da solicitação</B>} valor={v.descricao} obrig longo max={2000} dica="O que o aluno relatou, de forma objetiva. Evite frases genéricas." />
              <Escolha nome="prioridade" rotulo={<B n="6">Prioridade</B>} opcoes={PRIORIDADES} valor={v.prioridade} dica={`SLA: ${sla.map((r) => `${PRIORIDADES[r.prioridade]} ${fmtDuracao(r.resposta_min)} p/ responder`).join(' · ')}`} />
            </Sec>
            <Sec titulo="Atendimento">
              <Selecao nome="status" rotulo={<B n="7">Status</B>} valor={v.status || 'em_atendimento'} opcoes={opc(statusOpc)} />
              <div data-se="status:reaberto"><Texto nome="motivo_reabertura" rotulo="Motivo da reabertura" obrig /></div>
              <Texto nome="acao_realizada" rotulo={<B n="8">Ação realizada pelo Suporte</B>} valor={v.acao_realizada} obrig longo max={2000} dica="Diagnóstico e procedimento feito. Se nada foi possível, explique por quê." />
              <Selecao nome="encaminhamento" rotulo={<B n="9">Encaminhamento</B>} valor={v.encaminhamento || 'suporte'} opcoes={opc(SETORES_ENCAMINHAMENTO)} />
              <div data-se="encaminhamento:automacao|financeiro|pos_venda|cscx|comercial|academico|gestao|outro">
                <Texto nome="enc_responsavel" rotulo="Responsável ou setor de destino" valor={v.enc_responsavel} obrig />
                <Texto nome="enc_motivo" rotulo="Motivo do encaminhamento" valor={v.enc_motivo} obrig />
                <div className="campo"><label htmlFor="enc_prazo">Prazo esperado de retorno</label><input id="enc_prazo" name="enc_prazo" type="datetime-local" defaultValue={localDT(v.enc_prazo)} required /></div>
              </div>
              {veTodoSuporte(u) && equipe.length > 0 && <Selecao nome="responsavel_id" rotulo="Atendente responsável" valor={v.responsavel_id || u.id} opcoes={equipe.map((x) => ({ valor: x.id, rotulo: x.nome }))} />}
            </Sec>
            <Sec titulo="Solução ou próxima ação">
              <span className="rot"><B n="10">Solução ou próxima ação</B></span>
              <div data-se="status:resolvido|encerrado">
                <Texto nome="solucao" rotulo="Solução aplicada" valor={v.solucao} obrig longo />
                <Escolha nome="aluno_confirmou" rotulo="O aluno confirmou que resolveu?" opcoes={SIM_NAO} valor={sn(v.aluno_confirmou)} />
                <Escolha nome="satisfacao" rotulo="Avaliação do aluno (se ele deu)" opcoes={{ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }} valor={v.satisfacao ? String(v.satisfacao) : undefined} obrig={false} />
              </div>
              <div data-se="status:novo|em_atendimento|aguardando_aluno|aguardando_setor|reaberto">
                <Texto nome="proxima_acao" rotulo="Próxima ação" valor={v.proxima_acao} obrig />
                <div className="linha-campos">
                  <Texto nome="prox_responsavel" rotulo="Responsável" valor={v.prox_responsavel} obrig />
                  <DataCampo nome="prox_prazo" rotulo="Prazo" valor={v.prox_prazo} obrig />
                </div>
                <DataCampo nome="prox_contato" rotulo="Data do próximo contato com o aluno" valor={v.prox_contato} obrig />
              </div>
            </Sec>
          </FormEstado>
        </div>
        {t && (
          <aside className="painel">
            <div className="painel-cab"><h2>Linha do tempo</h2></div>
            <ol className="linha-tempo">{[...t.eventos].reverse().map((e) => (
              <li key={e.id}><b>{EVENTOS[e.evento] || e.evento}</b>{e.para && e.evento !== 'aberto' ? ` → ${STATUS[e.para] || SETORES_ENCAMINHAMENTO[e.para] || e.para}` : ''}
                {e.detalhe && <><br /><span className="pequeno">{e.detalhe}</span></>}<br /><span className="suave pequeno">{fmtDataHora(e.created_at)} · {e.usuario}</span></li>
            ))}</ol>
          </aside>
        )}
      </div>
    </>
  );
}
