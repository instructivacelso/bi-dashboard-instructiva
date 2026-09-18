import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { fmtDataHora } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { ETAPAS, VALIDACOES, AVISOS, PAGAMENTOS, STATUS_VENDA, ORDEM_ETAPAS, veTodaIndicacao, registraIndicacao, podeContatar } from '@/lib/indicacao.js';
import { vendedoresIndicacao } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Condicionais from '@/components/Condicionais.js';
import InputMoeda from '@/components/InputMoeda.js';
import { Texto, Selecao } from '@/components/Campos.js';
import { atualizarIndicacao } from '../actions.js';

export const dynamic = 'force-dynamic';
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function Indicacao(props) {
  const { id } = await props.params;
  const u = await exigirUsuario();
  const r = await q1(`SELECT r.*, s.nome indicador, s.telefone indicador_tel, s.email indicador_email, c.nome campanha, v.nome vendedor, pr.nome interesse
                        FROM referrals r JOIN students s ON s.id=r.referrer_id JOIN referral_campaigns c ON c.id=r.campaign_id
                        LEFT JOIN users v ON v.id=r.vendedor_id LEFT JOIN products pr ON pr.id=r.interesse_product_id WHERE r.id=$1`, [Number(id)]);
  if (!r) notFound();
  const gestor = veTodaIndicacao(u) || registraIndicacao(u);
  if (!gestor && r.vendedor_id !== u.id) return <Aviso tipo="erro">Esta indicação não está com você.</Aviso>;
  const [eventos, vend, produtos] = await Promise.all([
    q('SELECT e.*, x.nome usuario FROM referral_events e LEFT JOIN users x ON x.id=e.user_id WHERE e.referral_id=$1 ORDER BY e.created_at DESC', [r.id]),
    gestor ? vendedoresIndicacao() : [], q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'),
  ]);
  const idx = ORDEM_ETAPAS.indexOf(r.etapa);
  const etapasPossiveis = r.etapa === 'venda' ? { venda: ETAPAS.venda } : ['perdida', 'sem_interesse'].includes(r.etapa) ? { [r.etapa]: ETAPAS[r.etapa] }
    : Object.fromEntries(Object.entries(ETAPAS).filter(([k]) => k === r.etapa || ORDEM_ETAPAS.indexOf(k) > idx || ['perdida', 'sem_interesse'].includes(k)));
  const trabalhavel = podeContatar(r);
  return (
    <>
      <Topo titulo={r.nome} descricao={`${r.telefone || r.telefone_digitado} · indicado por ${r.indicador} · ${r.campanha}`}>
        <a className="btn sec" href="/indicacoes">Voltar</a>
      </Topo>
      {r.aviso === 'bloqueado' && <Aviso tipo="erro">Este contato pediu para não receber mensagens. Não faça novas tentativas.</Aviso>}
      {r.validacao !== 'valida' && r.aviso !== 'bloqueado' && <Aviso>{r.validacao === 'pendente' ? 'Aguardando validação antes de ser trabalhada.' : `Indicação ${VALIDACOES[r.validacao].toLowerCase()}${r.motivo_invalidacao ? `: ${r.motivo_invalidacao}` : ''}.`}</Aviso>}
      <div className="grade g2" style={{ alignItems: 'start', marginTop: 12 }}>
        <div className="painel form-claro">
          <FormEstado action={atualizarIndicacao} botao="Salvar" botaoEnviando="Salvando…" protegerSaida>
            <input type="hidden" name="id" value={r.id} />
            <Condicionais />
            {gestor && (
              <div className="secao-form"><h3>Validação e distribuição</h3>
                <Selecao nome="validacao" rotulo="Validação" valor={r.validacao} opcoes={opc(VALIDACOES)} />
                <div data-se="validacao:invalida|duplicada|telefone_incorreto|fora_perfil"><Texto nome="motivo_invalidacao" rotulo="Motivo" valor={r.motivo_invalidacao} obrig /></div>
                <Selecao nome="aviso" rotulo="Aviso ao indicado" valor={r.aviso} opcoes={opc(AVISOS)} dica="Marque “Bloqueado” se o contato recusou comunicação." />
                <Selecao nome="vendedor_id" rotulo="Vendedor responsável" valor={r.vendedor_id} obrig={false} vazio="Sem vendedor" opcoes={vend.map((x) => ({ valor: x.id, rotulo: x.nome }))} dica="Só indicações válidas podem ser distribuídas." />
              </div>
            )}
            <div className="secao-form"><h3>Atendimento</h3>
              {!trabalhavel && <p className="suave pequeno">{r.aviso === 'bloqueado' ? 'Contato bloqueado.' : 'Disponível depois da validação.'}</p>}
              {trabalhavel && r.etapa !== 'venda' && <label className="escolha"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="tentativa" value="sim" /> Registrar uma tentativa de contato agora</span></label>}
              <Selecao nome="etapa" rotulo="Etapa atual" valor={r.etapa} opcoes={opc(etapasPossiveis)} dica={`${r.tentativas} tentativa(s) até agora.`} />
              <div data-se="etapa:venda">
                <Selecao nome="venda_product_id" rotulo="Curso vendido" valor={r.venda_product_id || r.interesse_product_id} opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
                <div className="campo"><label htmlFor="venda_valor">Valor da venda</label><InputMoeda id="venda_valor" name="venda_valor" valorInicial={r.venda_valor} /></div>
                <Selecao nome="venda_pagamento" rotulo="Forma de pagamento" valor={r.venda_pagamento} opcoes={opc(PAGAMENTOS)} />
                <Selecao nome="venda_status" rotulo="Status" valor={r.venda_status} opcoes={opc(STATUS_VENDA)} />
              </div>
            </div>
          </FormEstado>
        </div>
        <aside className="painel">
          <div className="painel-cab"><h2>Resumo</h2><Semaforo cor={r.validacao === 'valida' ? 'verde' : 'amarelo'} texto={VALIDACOES[r.validacao]} /></div>
          <div className="leitura">
            <div><span>Etapa</span><b>{ETAPAS[r.etapa]}</b></div><div><span>Vendedor</span><b>{r.vendedor || '—'}</b></div>
            <div><span>Interesse</span><b>{r.interesse || '—'}</b></div><div><span>Aviso</span><b>{AVISOS[r.aviso]}</b></div>
            {r.venda_valor && <div><span>Venda</span><b>{moeda(Number(r.venda_valor))}</b></div>}
          </div>
          <h3 style={{ margin: '18px 0 10px' }}>Linha do tempo</h3>
          <ol className="linha-tempo">{eventos.map((e) => <li key={e.id}><b>{e.evento}</b>{e.para ? ` → ${ETAPAS[e.para] || VALIDACOES[e.para] || AVISOS[e.para] || e.para}` : ''}{e.detalhe && <><br /><span className="pequeno">{e.detalhe}</span></>}<br /><span className="suave pequeno">{fmtDataHora(e.created_at)} · {e.usuario}</span></li>)}</ol>
        </aside>
      </div>
    </>
  );
}
