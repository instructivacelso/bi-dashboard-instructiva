import { exigirUsuario } from '@/lib/auth.js';
import { fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { veFinanceiro, configuraFinanceiro, TIPOS_DIVIDA, STATUS_DIVIDA, TIPOS_CAPITAL, STATUS_CONSORCIO, TIPOS_ATIVO } from '@/lib/financeiro.js';
import { posicaoPatrimonial } from '@/lib/dadosFinanceiro.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarDivida, salvarAtivo, salvarConsorcio, salvarAporte, excluirRegistroPatrimonio, salvarConfigPatrimonio } from '../actions.js';

export const dynamic = 'force-dynamic';
const opt = (o) => Object.entries(o).map(([v, r]) => <option key={v} value={v}>{r}</option>);
const Excluir = ({ tabela, id }) => (
  <form action={excluirRegistroPatrimonio}><input type="hidden" name="id" value={id} /><input type="hidden" name="tabela" value={tabela} /><button className="btn sec peq" style={{ color: 'var(--vermelho)' }} type="submit">Excluir</button></form>
);

export default async function Patrimonio() {
  const u = await exigirUsuario();
  if (!veFinanceiro(u)) return <><Topo titulo="Posição patrimonial" /><Aviso tipo="erro">Área do gerente financeiro e da diretoria.</Aviso></>;
  const p = await posicaoPatrimonial();
  const pode = configuraFinanceiro(u);

  return (
    <>
      <Topo titulo="Posição patrimonial" descricao="Dívidas, patrimônio, investidores e consórcios. O que é do dia fica no painel; aqui é a foto de solvência.">
        <a className="btn sec" href="/financeiro">Painel do dia</a>
        <a className="btn sec" href="/financeiro/resultado">Resultado do mês</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Patrimônio líquido" valor={moeda(p.patrimonioLiquido, 0)} cor={p.patrimonioLiquido < 0 ? 'vermelho' : ''} meta={`ativos ${moeda(p.patrimonioTotal, 0)}`} />
        <Kpi rotulo="Dívida em aberto" valor={moeda(p.saldoDivida, 0)} meta={`endividamento ${pct(p.grauEndividamento)}`} />
        <Kpi rotulo="Parcela mensal" valor={moeda(p.parcelaMensal, 0)} meta="dívidas + consórcios" />
        <Kpi rotulo="Juros do mês" valor={moeda(p.jurosMes, 0)} cor={p.jurosMes > 0 ? 'amarelo' : ''} meta="sobre o saldo devedor" />
      </section>

      {p.metaReducao > 0 && (
        <section className="secao"><Aviso tipo={p.saldoDivida <= p.metaReducao ? 'ok' : 'info'}>
          {p.saldoDivida <= p.metaReducao ? `Meta de dívida atingida: saldo ${moeda(p.saldoDivida, 0)} dentro do teto de ${moeda(p.metaReducao, 0)}.` : `Faltam ${moeda(p.faltaParaMeta, 0)} para chegar ao teto de dívida de ${moeda(p.metaReducao, 0)}.`}
        </Aviso></section>
      )}
      {p.pagamentosAcimaAlcada.length > 0 && (
        <section className="secao"><Aviso tipo="erro">{p.pagamentosAcimaAlcada.length} pagamento(s) previsto(s) acima da alçada de {moeda(p.alcada, 0)} — precisam de aprovação da diretoria: {p.pagamentosAcimaAlcada.slice(0, 3).map((x) => `${x.descricao} (${moeda(x.valor_previsto, 0)})`).join('; ')}{p.pagamentosAcimaAlcada.length > 3 ? '…' : ''}.</Aviso></section>
      )}

      {/* Dívidas */}
      <section className="secao painel"><div className="painel-cab"><h2>Dívidas e financiamentos</h2></div>
        {p.dividas.length === 0 ? <Aviso>Nenhuma dívida cadastrada.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Credor</th><th>Tipo</th><th className="num">Saldo</th><th className="num">Parcela</th><th className="num">Taxa/mês</th><th className="num">Pagas</th><th>Vencimento</th><th>Status</th>{pode && <th />}</tr></thead>
            <tbody>{p.dividas.map((d) => (
              <tr key={d.id}><td>{d.credor}</td><td>{TIPOS_DIVIDA[d.tipo]}</td><td className="num">{moeda(d.saldo_devedor, 0)}</td><td className="num">{moeda(d.parcela_valor, 0)}</td><td className="num">{pct(d.taxa_mensal)}</td><td className="num">{d.parcelas_pagas}/{d.parcelas_total}</td><td>{d.proximo_vencimento ? fmtData(d.proximo_vencimento) : '—'}</td>
                <td><Semaforo cor={d.status === 'quitada' ? 'verde' : d.status === 'atrasada' ? 'vermelho' : 'neutro'} texto={STATUS_DIVIDA[d.status]} /></td>{pode && <td className="num"><Excluir tabela="fin_debts" id={d.id} /></td>}</tr>
            ))}</tbody>
          </table></div>
        )}
        {pode && (
          <FormEstado action={salvarDivida} botao="Adicionar dívida">
            <div className="linha-campos">
              <div className="campo"><label>Credor</label><input name="credor" required /></div>
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="emprestimo">{opt(TIPOS_DIVIDA)}</select></div>
              <div className="campo"><label>Status</label><select name="status" defaultValue="ativa">{opt(STATUS_DIVIDA)}</select></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><label>Valor original</label><input name="valor_original" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Saldo devedor</label><input name="saldo_devedor" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Taxa ao mês (%)</label><input name="taxa_mensal" inputMode="decimal" pattern="[0-9.,]*" placeholder="1,99" /></div>
              <div className="campo"><label>Parcela</label><input name="parcela_valor" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><label>Parcelas pagas</label><input name="parcelas_pagas" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Parcelas totais</label><input name="parcelas_total" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Próximo vencimento</label><input name="proximo_vencimento" type="date" /></div>
              <div className="campo"><label>Garantia</label><input name="garantia" /></div>
            </div>
          </FormEstado>
        )}
      </section>

      {/* Patrimônio */}
      <section className="secao painel"><div className="painel-cab"><h2>Patrimônio (ativos)</h2></div>
        {p.ativos.length === 0 ? <Aviso>Nenhum ativo cadastrado.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Descrição</th><th>Tipo</th><th className="num">Valor atual</th><th className="num">Aquisição</th>{pode && <th />}</tr></thead>
            <tbody>{p.ativos.map((a) => (<tr key={a.id}><td>{a.descricao}</td><td>{TIPOS_ATIVO[a.tipo]}</td><td className="num">{moeda(a.valor_atual, 0)}</td><td className="num">{a.valor_aquisicao != null ? moeda(a.valor_aquisicao, 0) : '—'}</td>{pode && <td className="num"><Excluir tabela="fin_assets" id={a.id} /></td>}</tr>))}</tbody>
          </table></div>
        )}
        {pode && (
          <FormEstado action={salvarAtivo} botao="Adicionar ativo">
            <div className="linha-campos">
              <div className="campo"><label>Descrição</label><input name="descricao" required /></div>
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="equipamento">{opt(TIPOS_ATIVO)}</select></div>
              <div className="campo"><label>Valor atual</label><input name="valor_atual" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Valor de aquisição</label><input name="valor_aquisicao" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Data de aquisição</label><input name="aquisicao_data" type="date" /></div>
            </div>
          </FormEstado>
        )}
      </section>

      {/* Consórcios */}
      <section className="secao painel"><div className="painel-cab"><h2>Consórcios <span className="suave pequeno">· {p.consorciosContemplados} contemplado(s) · cartas ativas {moeda(p.valorConsorcios, 0)}</span></h2></div>
        {p.consorcios.length === 0 ? <Aviso>Nenhum consórcio cadastrado.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Administradora</th><th>Bem</th><th className="num">Carta</th><th className="num">Parcela</th><th className="num">Pagas</th><th>Contemplado</th><th>Status</th>{pode && <th />}</tr></thead>
            <tbody>{p.consorcios.map((c) => (<tr key={c.id}><td>{c.administradora}</td><td>{c.bem || '—'}</td><td className="num">{moeda(c.valor_carta, 0)}</td><td className="num">{moeda(c.parcela_valor, 0)}</td><td className="num">{c.parcelas_pagas}/{c.parcelas_total}</td><td>{c.contemplado ? 'Sim' : 'Não'}</td><td><Semaforo cor={c.status === 'contemplado' ? 'verde' : c.status === 'cancelado' ? 'vermelho' : 'neutro'} texto={STATUS_CONSORCIO[c.status]} /></td>{pode && <td className="num"><Excluir tabela="fin_consortia" id={c.id} /></td>}</tr>))}</tbody>
          </table></div>
        )}
        {pode && (
          <FormEstado action={salvarConsorcio} botao="Adicionar consórcio">
            <div className="linha-campos">
              <div className="campo"><label>Administradora</label><input name="administradora" required /></div>
              <div className="campo"><label>Bem</label><input name="bem" placeholder="imóvel, veículo…" /></div>
              <div className="campo"><label>Status</label><select name="status" defaultValue="ativo">{opt(STATUS_CONSORCIO)}</select></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><label>Valor da carta</label><input name="valor_carta" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Parcela</label><input name="parcela_valor" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
              <div className="campo"><label>Pagas</label><input name="parcelas_pagas" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Totais</label><input name="parcelas_total" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label><input type="checkbox" name="contemplado" /> Contemplado</label></div>
            </div>
          </FormEstado>
        )}
      </section>

      {/* Investidores */}
      <section className="secao painel"><div className="painel-cab"><h2>Investidores e sócios <span className="suave pequeno">· capital líquido {moeda(p.capitalLiquido, 0)}</span></h2></div>
        {p.movimentos.length === 0 ? <Aviso>Nenhum aporte ou retirada registrado.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Data</th><th>Investidor</th><th>Tipo</th><th className="num">Valor</th><th>Obs.</th>{pode && <th />}</tr></thead>
            <tbody>{p.movimentos.slice(0, 30).map((m) => (<tr key={m.id}><td>{fmtData(m.data)}</td><td>{m.investidor}</td><td>{TIPOS_CAPITAL[m.tipo]}</td><td className="num" style={{ color: m.tipo === 'aporte' ? undefined : 'var(--vermelho)' }}>{m.tipo === 'aporte' ? '' : '-'}{moeda(m.valor, 0)}</td><td className="suave pequeno">{m.observacao || '—'}</td>{pode && <td className="num"><Excluir tabela="fin_capital_movements" id={m.id} /></td>}</tr>))}</tbody>
          </table></div>
        )}
        {pode && (
          <FormEstado action={salvarAporte} botao="Registrar movimento">
            <div className="linha-campos">
              <div className="campo"><label>Investidor/sócio</label><input name="investidor" required /></div>
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="aporte">{opt(TIPOS_CAPITAL)}</select></div>
              <div className="campo"><label>Data</label><input name="data" type="date" /></div>
              <div className="campo"><label>Valor</label><input name="valor" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
            </div>
          </FormEstado>
        )}
      </section>

      {pode && (
        <section className="secao painel"><h2>Parâmetros</h2>
          <FormEstado action={salvarConfigPatrimonio} botao="Salvar parâmetros">
            <div className="linha-campos">
              <div className="campo"><label>Alçada da diretoria (pagamento acima exige aprovação)</label><input name="alcada" inputMode="decimal" pattern="[0-9.,]*" defaultValue={p.alcada || ''} placeholder="0,00" /></div>
              <div className="campo"><label>Meta de teto de dívida</label><input name="meta_reducao" inputMode="decimal" pattern="[0-9.,]*" defaultValue={p.metaReducao || ''} placeholder="0,00 (0 = sem meta)" /></div>
            </div>
          </FormEstado>
        </section>
      )}
    </>
  );
}
