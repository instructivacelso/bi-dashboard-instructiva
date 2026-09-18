import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { fmtData, fmtDataHora } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { ETAPAS, ORDEM_ETAPAS, ETAPAS_FINAIS, VALIDACOES, AVISOS, ORIGENS, PAGAMENTOS, STATUS_VENDA, MOTIVOS_INVALIDA, MOTIVOS_PERDA, veTodaIndicacao, podeContatar, etapaValida } from '@/lib/indicacao.js';
import { vendedoresIndicacao } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Condicionais from '@/components/Condicionais.js';
import InputMoeda from '@/components/InputMoeda.js';
import { Texto, Selecao, DataCampo } from '@/components/Campos.js';
import { atualizarIndicacao } from '../actions.js';

export const dynamic = 'force-dynamic';
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const EVENTOS = { recebida: 'Indicação recebida', tentativa: 'Tentativa de contato', followup: 'Follow-up', bloqueada: 'Contato bloqueado', aviso: 'Aviso atualizado', distribuida: 'Vendedor definido', reatribuida: 'Responsável alterado', status_venda: 'Status do pagamento' };

export default async function Indicacao(props) {
  const { id } = await props.params;
  const u = await exigirUsuario();
  const r = await q1(`SELECT r.*, s.nome indicador, s.telefone indicador_tel, s.email indicador_email, c.nome campanha, v.nome vendedor, pr.nome interesse, rp.nome responsavel
                        FROM referrals r JOIN students s ON s.id=r.referrer_id JOIN referral_campaigns c ON c.id=r.campaign_id
                        LEFT JOIN users v ON v.id=r.vendedor_id LEFT JOIN products pr ON pr.id=r.interesse_product_id LEFT JOIN users rp ON rp.id=r.responsavel_id WHERE r.id=$1`, [Number(id)]);
  if (!r) notFound();
  const gestor = veTodaIndicacao(u);
  const dono = r.responsavel_id === u.id || r.created_by === u.id;
  const soVendedor = !gestor && !dono && r.vendedor_id === u.id;
  if (!gestor && !dono && !soVendedor) return <Aviso tipo="erro">Esta indicação não está com você.</Aviso>;
  const [eventos, vend, produtos, equipe] = await Promise.all([
    q('SELECT e.*, x.nome usuario FROM referral_events e LEFT JOIN users x ON x.id=e.user_id WHERE e.referral_id=$1 ORDER BY e.created_at DESC', [r.id]),
    gestor || dono ? vendedoresIndicacao() : [], q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'),
    gestor ? q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id WHERE x.ativo AND d.slug='indicacoes' ORDER BY x.nome`) : [],
  ]);
  let possiveis = Object.keys(ETAPAS).filter((e) => etapaValida(r.etapa, e));
  if (soVendedor) possiveis = possiveis.filter((e) => [r.etapa, 'negociacao', 'venda', 'perdida'].includes(e));
  const trabalhavel = podeContatar(r);
  const hojeISO = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  return (
    <>
      <Topo titulo={r.nome} descricao={`${r.telefone || r.telefone_digitado}${r.email ? ` · ${r.email}` : ''}${r.cidade ? ` · ${r.cidade}` : ''} · indicado por ${r.indicador} · ${r.campanha}`}>
        <a className="btn sec" href="/indicacoes">Voltar ao pipeline</a>
      </Topo>
      {r.aviso === 'bloqueado' && <Aviso tipo="erro">Este contato pediu para não receber mensagens. Não faça novas tentativas.</Aviso>}
      {['duplicada', 'telefone_incorreto'].includes(r.validacao) && <Aviso tipo="erro">{VALIDACOES[r.validacao]}{r.motivo_invalidacao ? `: ${r.motivo_invalidacao}` : ''}.</Aviso>}
      {r.proximo_contato && String(r.proximo_contato).slice(0, 10) < hojeISO && trabalhavel && <Aviso tipo="erro">Follow-up atrasado desde {fmtData(r.proximo_contato)}.</Aviso>}
      <div className="grade g2" style={{ alignItems: 'start', marginTop: 12 }}>
        <div className="painel form-claro">
          <FormEstado action={atualizarIndicacao} botao="Salvar" botaoEnviando="Salvando…" protegerSaida>
            <input type="hidden" name="id" value={r.id} />
            <Condicionais />
            <div className="secao-form"><h3>Andamento</h3>
              {trabalhavel && r.etapa !== 'venda' && !soVendedor && (
                <label className="escolha"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="contato" value="sim" /> {r.tentativas > 0 ? 'Registrar um follow-up agora' : 'Registrar a primeira tentativa de contato agora'}</span></label>
              )}
              <Selecao nome="etapa" rotulo="Estágio" valor={r.etapa} opcoes={possiveis.map((e) => ({ valor: e, rotulo: ETAPAS[e] }))} dica={`${r.tentativas} contato(s) registrado(s). O estágio só avança; pular etapas registra as intermediárias.`} />
              <div data-se="etapa:invalida"><Selecao nome="motivo_invalida" rotulo="Motivo da invalidação" opcoes={opc(MOTIVOS_INVALIDA)} /></div>
              <div data-se="etapa:perdida|sem_interesse"><Selecao nome="motivo_perda" rotulo="Motivo" opcoes={opc(MOTIVOS_PERDA)} /></div>
              <div data-se="etapa:venda">
                <Selecao nome="venda_product_id" rotulo="Curso vendido" valor={r.venda_product_id || r.interesse_product_id} opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
                <div className="campo"><label htmlFor="venda_valor">Valor da venda</label><InputMoeda id="venda_valor" name="venda_valor" valorInicial={r.venda_valor} /></div>
                <div className="linha-campos"><Selecao nome="venda_pagamento" rotulo="Forma de pagamento" valor={r.venda_pagamento} opcoes={opc(PAGAMENTOS)} /><Selecao nome="venda_status" rotulo="Status do pagamento" valor={r.venda_status} opcoes={opc(STATUS_VENDA)} /></div>
              </div>
              <div className="linha-campos">
                <DataCampo nome="proximo_contato" rotulo="Próximo contato" valor={r.proximo_contato} obrig={false} />
                {(gestor || dono) && <Selecao nome="vendedor_id" rotulo="Vendedor responsável" valor={r.vendedor_id} obrig={false} vazio="Ainda não encaminhada" opcoes={vend.map((x) => ({ valor: x.id, rotulo: x.nome }))} dica="Obrigatório para encaminhar." />}
              </div>
              <Texto nome="proximo_passo" rotulo="Próximo passo / informações para o vendedor" valor={r.proximo_passo} obrig={false} max={300} />
            </div>
            {(gestor || dono) && (
              <div className="secao-form"><h3>Contato e responsável</h3>
                <Selecao nome="aviso" rotulo="Aviso ao indicado" valor={r.aviso} opcoes={opc(AVISOS)} dica="Marque “Bloqueado” se o contato recusou comunicação." />
                {gestor && <Selecao nome="responsavel_id" rotulo="Colaborador responsável" valor={r.responsavel_id} opcoes={equipe.map((x) => ({ valor: x.id, rotulo: x.nome }))} />}
              </div>
            )}
          </FormEstado>
        </div>
        <aside className="painel">
          <div className="painel-cab"><h2>Resumo</h2><Semaforo cor={ETAPAS_FINAIS.includes(r.etapa) ? 'vermelho' : r.etapa === 'venda' ? 'verde' : 'amarelo'} texto={ETAPAS[r.etapa]} /></div>
          <div className="leitura">
            <div><span>Origem</span><b>{ORIGENS[r.origem_indicacao] || '—'}</b></div><div><span>Responsável</span><b>{r.responsavel || '—'}</b></div>
            <div><span>Vendedor</span><b>{r.vendedor || '—'}</b></div><div><span>Interesse</span><b>{r.interesse || '—'}</b></div>
            <div><span>Indicador</span><b>{r.indicador}</b></div><div><span>Recebida em</span><b>{fmtData(r.created_at)}</b></div>
            {r.venda_valor && <div><span>Venda</span><b>{moeda(Number(r.venda_valor))}</b></div>}
            {r.motivo_perda && <div><span>Motivo</span><b>{r.motivo_perda}</b></div>}
          </div>
          <div className="pequeno suave" style={{ marginTop: 10 }}>Progresso: {ORDEM_ETAPAS.indexOf(r.etapa) >= 0 ? `${ORDEM_ETAPAS.indexOf(r.etapa) + 1} de ${ORDEM_ETAPAS.length}` : 'encerrada'}</div>
          <h3 style={{ margin: '18px 0 10px' }}>Histórico</h3>
          <ol className="linha-tempo">{eventos.map((e) => <li key={e.id}><b>{ETAPAS[e.evento] || EVENTOS[e.evento] || e.evento}</b>{e.de && ETAPAS[e.de] && e.evento !== e.de ? ` (de ${ETAPAS[e.de]})` : ''}{e.detalhe && <><br /><span className="pequeno">{e.detalhe}</span></>}<br /><span className="suave pequeno">{fmtDataHora(e.created_at)} · {e.usuario}</span></li>)}</ol>
        </aside>
      </div>
    </>
  );
}
