import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, pct, numero } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { veFinanceiro, configuraFinanceiro, TIPOS_AJUSTE, GRUPOS_AJUSTE } from '@/lib/financeiro.js';
import { resultadoMes, ajustesDoMes } from '@/lib/dadosFinanceiro.js';
import { q } from '@/lib/db.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import BotaoExcluir from '@/components/BotaoExcluir.js';
import { salvarAjuste, excluirAjuste } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fimDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export default async function ResultadoMes(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veFinanceiro(u)) return <><Topo titulo="Resultado do mês" /><Aviso tipo="erro">Área do gerente financeiro e da diretoria.</Aviso></>;
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const desde = `${mes}-01`, ate = fimDoMes(mes);
  const [r, ajustes, produtos] = await Promise.all([resultadoMes(desde, ate), ajustesDoMes(desde, ate), q('SELECT id, nome FROM products WHERE ativo ORDER BY nome')]);
  const d = r.dre;
  const podeMais = mes < mesAtual;

  const Linha = ({ rot, val, forte, neg, ind }) => (
    <tr className={forte ? 'linha-forte' : ''}>
      <td style={{ paddingLeft: ind ? 22 : undefined }}>{rot}</td>
      <td className="num" style={{ color: neg && val > 0 ? 'var(--vermelho)' : undefined }}>{neg && val > 0 ? `(${moeda(val, 0)})` : moeda(val, 0)}</td>
    </tr>
  );

  return (
    <>
      <Topo titulo="Resultado do mês" descricao={`${rotuloMes(mes)} · DRE gerencial. Receita das vendas e investimento de marketing vêm prontos; ajuste só o que falta.`}>
        <a className="btn sec peq" href={`/financeiro/resultado?mes=${somaMes(mes, -1)}`}>← {rotuloMes(somaMes(mes, -1))}</a>
        {podeMais ? <a className="btn sec peq" href={`/financeiro/resultado?mes=${somaMes(mes, 1)}`}>{rotuloMes(somaMes(mes, 1))} →</a> : <span />}
        <a className="btn sec" href="/financeiro">Painel do dia</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Receita bruta" valor={moeda(d.receitaBruta, 0)} meta={`${r.receita.qtd} venda(s)`} />
        <Kpi rotulo="Margem de contribuição" valor={pct(d.margemPct)} cor={d.margemPct !== null ? semaforo(d.margemPct, d.metaMargem, 'maior') : ''} meta={`meta ${pct(d.metaMargem)} · ${moeda(d.margemContribuicao, 0)}`} />
        <Kpi rotulo="EBITDA" valor={moeda(d.ebitda, 0)} cor={d.ebitda < 0 ? 'vermelho' : ''} meta={d.ebitdaPct !== null ? `${pct(d.ebitdaPct)} da receita` : ''} />
        <Kpi rotulo="Resultado líquido" valor={moeda(d.resultado, 0)} cor={d.resultado < 0 ? 'vermelho' : d.resultado > 0 ? '' : 'amarelo'} meta={d.margemLiquida !== null ? `${pct(d.margemLiquida)} da receita` : ''} />
      </section>

      <section className="secao grade g2">
        <div className="painel">
          <div className="painel-cab"><h2>DRE gerencial</h2></div>
          <div className="tabela-wrap"><table className="dre">
            <tbody>
              <Linha rot="Receita bruta de vendas" val={d.receitaBruta} forte />
              <Linha rot="(−) Impostos sobre vendas" val={d.impostos} neg ind />
              <Linha rot="(−) Taxas de meios de pagamento" val={d.taxas} neg ind />
              <Linha rot="(=) Receita líquida" val={d.receitaLiquida} forte />
              <Linha rot="(−) Custos variáveis" val={d.custosVariaveis} neg ind />
              <Linha rot="(−) Marketing (mídia + ferramentas)" val={d.marketing} neg ind />
              <Linha rot="(=) Margem de contribuição" val={d.margemContribuicao} forte />
              <Linha rot="(−) Custos fixos" val={d.custosFixos} neg ind />
              <Linha rot="(−) Pessoal / folha" val={d.pessoal} neg ind />
              <Linha rot="(=) EBITDA" val={d.ebitda} forte />
              <Linha rot="(−) Depreciação e amortização" val={d.depreciacao} neg ind />
              <Linha rot="(−) Juros e financiamentos" val={d.juros} neg ind />
              <Linha rot="(=) Resultado líquido" val={d.resultado} forte />
            </tbody>
          </table></div>
        </div>
        <div className="painel">
          <div className="painel-cab"><h2>Indicadores</h2></div>
          <div className="grade g2">
            <Kpi rotulo="Ponto de equilíbrio" valor={d.equilibrio === null ? '—' : moeda(d.equilibrio, 0)} meta="faturamento para empatar" />
            <Kpi rotulo="CAC médio" valor={d.cac === null ? '—' : moeda(d.cac, 0)} meta="marketing ÷ vendas" />
            <Kpi rotulo="Receita líquida" valor={moeda(d.receitaLiquida, 0)} />
            <Kpi rotulo="Margem líquida" valor={pct(d.margemLiquida)} cor={d.margemLiquida !== null && d.margemLiquida < 0 ? 'vermelho' : ''} />
          </div>
          {d.equilibrio !== null && (
            <Aviso tipo={d.receitaBruta >= d.equilibrio ? 'ok' : 'info'}>
              {d.receitaBruta >= d.equilibrio
                ? `A receita do mês passou o ponto de equilíbrio em ${moeda(d.receitaBruta - d.equilibrio, 0)}.`
                : `Faltam ${moeda(d.equilibrio - d.receitaBruta, 0)} de receita para o mês empatar.`}
            </Aviso>
          )}
        </div>
      </section>

      <section className="secao painel">
        <div className="painel-cab"><h2>Margem e CAC por produto</h2></div>
        {r.produtos.length === 0 ? <Aviso>Sem vendas neste mês.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Produto</th><th className="num">Vendas</th><th className="num">Receita</th><th className="num">Ticket</th><th className="num">Custo</th><th className="num">Margem</th><th className="num">Margem %</th><th className="num">CAC</th></tr></thead>
            <tbody>
              {r.produtos.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td><td className="num">{p.qtd}</td><td className="num">{moeda(p.receita, 0)}</td><td className="num">{moeda(p.ticket, 0)}</td>
                  <td className="num">{moeda(p.custo, 0)}</td>
                  <td className="num" style={{ color: p.margem < 0 ? 'var(--vermelho)' : undefined }}>{moeda(p.margem, 0)}</td>
                  <td className="num"><Semaforo cor={p.margemPct !== null ? semaforo(p.margemPct, d.metaMargem, 'maior') : 'neutro'} texto={pct(p.margemPct)} /></td>
                  <td className="num">{p.cac === null ? '—' : moeda(p.cac, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p className="suave pequeno" style={{ marginTop: 8 }}>O custo por produto soma o que é diretamente atribuído (pagamentos e mídia marcados com o produto) e a parte rateada dos custos gerais, na proporção da receita.</p>
      </section>

      <section className="secao painel">
        <div className="painel-cab"><h2>Ajustes de competência ({rotuloMes(mes)})</h2></div>
        <p className="suave pequeno">Lançamentos que não passam pelo caixa do dia: depreciação, pró-labore, provisões e ajustes de imposto ou juros. Entram no DRE do mês.</p>
        {configuraFinanceiro(u) && (
          <FormEstado action={salvarAjuste} botao="Lançar ajuste">
            <input type="hidden" name="competencia" value={mes} />
            <div className="linha-campos">
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="depreciacao">{Object.entries(TIPOS_AJUSTE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo"><label>Grupo no resultado</label><select name="grupo" defaultValue="depreciacao">{Object.entries(GRUPOS_AJUSTE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo"><label>Descrição</label><input name="descricao" required /></div>
              <div className="campo"><label>Valor</label><input name="valor" type="text" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Produto (opcional)</label><select name="product_id" defaultValue=""><option value="">Geral</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            </div>
          </FormEstado>
        )}
        {ajustes.length > 0 && (
          <div className="tabela-wrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Tipo</th><th>Descrição</th><th>Grupo</th><th>Produto</th><th className="num">Valor</th>{configuraFinanceiro(u) && <th />}</tr></thead>
            <tbody>
              {ajustes.map((a) => (
                <tr key={a.id}>
                  <td>{TIPOS_AJUSTE[a.tipo]}</td><td>{a.descricao}</td><td>{GRUPOS_AJUSTE[a.grupo]}</td><td>{a.produto || '—'}</td><td className="num">{moeda(a.valor, 0)}</td>
                  {configuraFinanceiro(u) && <td className="num"><BotaoExcluir action={excluirAjuste} id={a.id} nome={a.descricao} /></td>}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
