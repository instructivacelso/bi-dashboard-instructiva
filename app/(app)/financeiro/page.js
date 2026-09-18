import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { veFinanceiro, operaFinanceiro, configuraFinanceiro, situacaoDia, STATUS_FECHAMENTO } from '@/lib/financeiro.js';
import { numerosFinanceiro } from '@/lib/dadosFinanceiro.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const JAN = { sete: '7 dias', trinta: '30 dias', sessenta: '60 dias', noventa: '90 dias' };

export default async function PainelFinanceiro() {
  const u = await exigirUsuario();
  if (!veFinanceiro(u)) {
    return (
      <>
        <Topo titulo="Financeiro" descricao="Área do gerente financeiro e da diretoria." />
        {operaFinanceiro(u)
          ? <Aviso>O painel é do gerente. Você faz o <a href="/financeiro/fechamento">fechamento do dia</a>.</Aviso>
          : <Aviso tipo="erro">Sem acesso ao Financeiro.</Aviso>}
      </>
    );
  }
  const dia = hoje();
  const n = await numerosFinanceiro(dia);
  const cor = situacaoDia({ disponivel: n.disponivel, aPagarHoje: n.aPagarHoje, resultadoDia: n.resultadoDia, divergencia: 0 });
  return (
    <>
      <Topo titulo="Financeiro — painel do dia" descricao={`${fmtData(dia)} · ${n.temFechamento ? `fechamento ${STATUS_FECHAMENTO[n.statusFechamento]}` : `sem fechamento hoje (saldo de ${n.dataBase ? fmtData(n.dataBase) : '—'})`}`}>
        <Semaforo cor={cor} texto={cor === 'verde' ? 'Caixa saudável' : cor === 'amarelo' ? 'Atenção' : 'Risco de caixa'} />
        <a className="btn sec" href="/financeiro/resultado">Resultado do mês</a>
        {operaFinanceiro(u) && <a className="btn sec" href="/financeiro/fechamento">Fechamento do dia</a>}
        {configuraFinanceiro(u) && <a className="btn sec" href="/financeiro/cadastros">Cadastros</a>}
      </Topo>
      {!n.temFechamento && <Aviso>O fechamento de hoje ainda não foi enviado. Os saldos abaixo são do último fechamento.</Aviso>}

      <section className="grade g4">
        <Kpi rotulo="Saldo disponível" valor={moeda(n.disponivel, 0)} meta={`${n.contasComSaldo} conta(s) · bloqueado ${moeda(n.saldo.bloqueado, 0)}`} />
        <Kpi rotulo="Resultado do dia" valor={moeda(n.resultadoDia, 0)} cor={n.resultadoDia < 0 ? 'amarelo' : ''} meta={`entradas ${moeda(n.entradas, 0)} · saídas ${moeda(n.saidas, 0)}`} />
        <Kpi rotulo="A pagar hoje" valor={moeda(n.aPagarHoje, 0)} cor={n.aPagarHoje > n.disponivel ? 'vermelho' : ''} meta={`${n.aPagarHojeQtd} conta(s)`} />
        <Kpi rotulo="Vendas do dia" valor={moeda(n.vendas.valor, 0)} meta={`${n.vendas.qtd} venda(s) · Comercial ${moeda(n.vendas.comercial.valor, 0)} · Indicação ${moeda(n.vendas.indicacao.valor, 0)}`} />
      </section>

      <section className="secao painel">
        <div className="painel-cab"><h2>Projeção de caixa</h2>
          {n.proj.janelaRisco ? <Semaforo cor="vermelho" texto={`Risco de saldo negativo em ${JAN[n.proj.janelaRisco]}`} /> : <Semaforo cor="verde" texto="Sem saldo negativo previsto" />}
        </div>
        <p className="suave pequeno">Cenário provável (aplica probabilidade de recuperação de inadimplência). O detalhamento por boleto e recorrência evolui na Etapa 2.</p>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Horizonte</th><th className="num">A receber</th><th className="num">A pagar</th><th className="num">Saldo projetado</th></tr></thead>
          <tbody>
            <tr><td>Hoje (disponível)</td><td className="num">—</td><td className="num">{moeda(n.aPagarHoje, 0)}</td><td className="num"><b>{moeda(n.disponivel, 0)}</b></td></tr>
            {n.proj.provavel.map((p) => (
              <tr key={p.janela}><td>{JAN[p.janela]}</td><td className="num">{moeda(n.receber[p.janela === 'sete' ? 'sete' : p.janela === 'trinta' ? 'trinta' : p.janela === 'sessenta' ? 'sessenta' : 'noventa'], 0)}</td>
                <td className="num">{moeda(n.obrig[p.janela], 0)}</td><td className="num" style={{ color: p.saldo < 0 ? 'var(--vermelho)' : undefined }}><b>{moeda(p.saldo, 0)}</b></td></tr>
            ))}
          </tbody>
        </table></div>
        <div className="grade g3" style={{ marginTop: 12 }}>
          <Kpi rotulo="Menor saldo previsto (90d)" valor={moeda(n.proj.menorSaldo, 0)} cor={n.proj.menorSaldo < 0 ? 'vermelho' : ''} />
          <Kpi rotulo="Cobertura de 30 dias" valor={n.cobertura30 === null ? '—' : `${numero(n.cobertura30, 2)}x`} cor={n.cobertura30 !== null && n.cobertura30 < 1 ? 'vermelho' : ''} meta="disponível + a receber ÷ a pagar" />
          <Kpi rotulo="Capital de giro necessário" valor={moeda(n.capitalGiro, 0)} cor={n.capitalGiro > 0 ? 'amarelo' : ''} meta="próximos 30 dias" />
        </div>
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Contas a receber</h2></div>
          <div className="leitura">
            <div><span>Hoje</span><b>{moeda(n.receber.hoje, 0)}</b></div><div><span>7 dias</span><b>{moeda(n.receber.sete, 0)}</b></div>
            <div><span>8–30 dias</span><b>{moeda(n.receber.trinta, 0)}</b></div><div><span>31–60 dias</span><b>{moeda(n.receber.sessenta, 0)}</b></div>
            <div><span>61–90 dias</span><b>{moeda(n.receber.noventa, 0)}</b></div><div><span>+90 dias</span><b>{moeda(n.receber.mais90, 0)}</b></div>
            <div><span>Futuro total</span><b>{moeda(n.receber.futuroTotal, 0)}</b></div><div><span>Vencido</span><b style={{ color: n.receber.vencido ? 'var(--vermelho)' : undefined }}>{moeda(n.receber.vencido, 0)}</b></div>
          </div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Inadimplência</h2>{n.inad.taxa !== null && <Semaforo cor={semaforo(n.inad.taxa, 0.05, 'menor')} texto={pct(n.inad.taxa)} />}</div>
          <div className="leitura">
            <div><span>Total vencido</span><b>{moeda(n.inad.vencido, 0)}</b></div><div><span>Clientes</span><b>{numero(n.inad.clientes)}</b></div>
            {n.inad.faixas.map(([r, v]) => <div key={r}><span>{r}</span><b>{moeda(v, 0)}</b></div>)}
            <div><span>Recuperado (dia)</span><b>{moeda(n.inad.recuperado, 0)}</b></div><div><span>Acordos</span><b>{numero(n.inad.acordos)}</b></div>
          </div>
        </div>
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Obrigações futuras (a pagar)</h2></div>
        <div className="grade g4">
          <Kpi rotulo="Vencidas" valor={moeda(n.obrig.vencido, 0)} cor={n.obrig.vencido ? 'vermelho' : ''} meta={`${n.obrig.vencidoQtd} conta(s)`} />
          <Kpi rotulo="Próximos 7 dias" valor={moeda(n.obrig.sete, 0)} />
          <Kpi rotulo="8–30 dias" valor={moeda(n.obrig.trinta, 0)} />
          <Kpi rotulo="31–90 dias" valor={moeda(n.obrig.sessenta + n.obrig.noventa, 0)} />
        </div>
      </section>
    </>
  );
}
