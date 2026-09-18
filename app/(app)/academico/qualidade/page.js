import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { numero, pct } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { veAcademico, configuraAcademico, STATUS_QUALIDADE, CRITERIOS_QUALIDADE, ETAPAS_CONTEUDO, PESOS_ROTULOS } from '@/lib/academico.js';
import { qualidadePeriodo, conteudosParaAvaliar, pontuacaoPorProfessor, pesosPontuacao, pontuacaoAtiva } from '@/lib/dadosAcademico.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarQualidade, salvarPesos } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const COR_Q = { aprovado: 'verde', aprovado_ajuste: 'amarelo', reprovado: 'vermelho' };

export default async function Qualidade(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veAcademico(u)) return <><Topo titulo="Qualidade e pontuação" /><Aviso tipo="erro">Área da coordenação e da diretoria.</Aviso></>;
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const desde = `${mes}-01`, ate = fim(mes);
  const [qual, fila, ativa, pesos] = await Promise.all([qualidadePeriodo(desde, ate), conteudosParaAvaliar(), pontuacaoAtiva(), pesosPontuacao()]);
  const ranking = ativa ? await pontuacaoPorProfessor(desde, ate) : [];

  return (
    <>
      <Topo titulo="Qualidade e pontuação" descricao={`${rot(mes)} · produção, aprovação e retrabalho aparecem separados`}>
        <a className="btn sec peq" href={`/academico/qualidade?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/academico/qualidade?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        <a className="btn sec" href="/academico">Painel</a>
        <a className="btn sec" href="/academico/pipeline">Pipeline</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Aprovação sem retrabalho" valor={pct(qual.aprovacaoSemRetrabalho)} cor={qual.aprovacaoSemRetrabalho != null ? semaforo(qual.aprovacaoSemRetrabalho, 0.8, 'maior') : ''} meta={`${qual.aprovadosPrimeira}/${qual.conteudos} de primeira`} />
        <Kpi rotulo="Retrabalho" valor={pct(qual.retrabalho)} cor={qual.retrabalho != null ? semaforo(qual.retrabalho, 0.2, 'menor') : ''} meta={`${qual.reprovacoes} reprov. · ${qual.ajustes} ajuste(s)`} />
        <Kpi rotulo="Nota média de qualidade" valor={qual.notaMedia != null ? numero(qual.notaMedia, 1) : '—'} meta="0 a 10" />
        <Kpi rotulo="Entregas no prazo" valor={pct(qual.noPrazo)} meta={`${qual.avaliacoes} avaliação(ões)`} />
      </section>

      <section className="secao painel"><h2>Avaliar entrega</h2>
        {fila.length === 0 ? <Aviso>Nenhum conteúdo em revisão, ajustes ou aprovação no momento.</Aviso> : (
          <FormEstado action={salvarQualidade} botao="Registrar avaliação">
            <div className="linha-campos">
              <div className="campo"><label>Conteúdo</label><select name="content_id" required defaultValue=""><option value="">Escolha…</option>{fila.map((c) => <option key={c.id} value={c.id}>{c.titulo} — {ETAPAS_CONTEUDO[c.etapa]}{c.responsavel ? ` (${c.responsavel})` : ''}</option>)}</select></div>
              <div className="campo"><label>Resultado</label><select name="status" defaultValue="aprovado">{Object.entries(STATUS_QUALIDADE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo"><label>Prazo de correção</label><input name="prazo_correcao" type="date" /></div>
            </div>
            <p className="suave pequeno">Critérios (0 a 10, opcionais):</p>
            <div className="linha-campos">{Object.entries(CRITERIOS_QUALIDADE).map(([k, r]) => (
              <div className="campo" key={k}><label>{r}</label><input name={`q_${k}`} inputMode="decimal" pattern="[0-9.,]*" style={{ width: 80 }} /></div>
            ))}</div>
            <div className="campo"><label>Motivo do ajuste ou reprovação</label><input name="motivo" placeholder="obrigatório se não for aprovado" /></div>
          </FormEstado>
        )}
        <p className="suave pequeno" style={{ marginTop: 8 }}>Aprovado segue para Aprovação. Ajuste ou reprovação devolve o conteúdo para Ajustes e conta um ciclo de retrabalho.</p>
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Avaliações do mês</h2></div>
        {qual.linhas.length === 0 ? <Aviso>Sem avaliações no período.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Data</th><th>Conteúdo</th><th>Resultado</th><th className="num">Nota</th><th>Motivo</th></tr></thead>
            <tbody>{qual.linhas.map((a) => <tr key={a.id}><td>{fmtData(a.dia)}</td><td>{a.titulo}</td><td><Semaforo cor={COR_Q[a.status]} texto={STATUS_QUALIDADE[a.status]} /></td><td className="num">{a.nota != null ? numero(a.nota, 1) : '—'}</td><td className="suave pequeno">{a.motivo || '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Pontuação de produtividade {ativa ? '' : '(desativada)'}</h2></div>
        {!ativa ? <Aviso>A pontuação é opcional e está desligada. A coordenação pode ativar abaixo — ela nunca substitui os indicadores originais nem decide sozinha remuneração, promoção ou desligamento.</Aviso>
          : ranking.length === 0 ? <Aviso>Sem registros no mês.</Aviso> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Professor</th><th className="num">Bruto</th><th className="num">Desconto</th><th className="num">Fator qualidade</th><th className="num">Total</th><th>Memória do cálculo</th></tr></thead>
              <tbody>{ranking.map((r) => (
                <tr key={r.user_id}><td>{r.nome}</td><td className="num">{numero(r.bruto, 1)}</td><td className="num">{r.desconto ? `−${numero(r.desconto, 1)}` : '0'}</td><td className="num">×{numero(r.fator, 2)}</td><td className="num"><b>{numero(r.total, 1)}</b></td>
                  <td className="suave pequeno">{r.itens.filter((i) => i.qtd > 0 && i.peso > 0).map((i) => `${i.rotulo}: ${i.qtd}×${i.peso}`).join(' · ') || '—'}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        {configuraAcademico(u) && (
          <div style={{ marginTop: 14 }}>
            <FormEstado action={salvarPesos} botao="Salvar pontuação">
              <label className="pequeno"><input type="checkbox" name="ativa" defaultChecked={ativa} /> Usar pontuação de produtividade</label>
              <div className="linha-campos">{Object.entries(PESOS_ROTULOS).map(([k, r]) => (
                <div className="campo" key={k}><label>{r}</label><input name={`peso_${k}`} inputMode="decimal" pattern="[0-9.,]*" defaultValue={pesos[k] ?? ''} style={{ width: 80 }} /></div>
              ))}</div>
              <p className="suave pequeno">Só entregas válidas pontuam (regravação não conta). Cada reprovação desconta o peso de uma aula publicada, e a nota média de qualidade ajusta o total (fator entre 0,5 e 1).</p>
            </FormEstado>
          </div>
        )}
      </section>
    </>
  );
}
