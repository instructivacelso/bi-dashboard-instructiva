import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { operaFinanceiro, ehGerenteFinanceiro, TIPOS_ENTRADA, FORMAS_PAGAMENTO, STATUS_PAGAMENTO, STATUS_FECHAMENTO, RISCOS } from '@/lib/financeiro.js';
import { contasAtivas, categoriasAtivas, centrosCusto, fornecedores, vendasDoDia, fechamentoDoDia, ultimoFechamento, configFinanceiro } from '@/lib/dadosFinanceiro.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import DataRegistro from '@/components/DataRegistro.js';
import { Texto, Selecao, Escolha, SIM_NAO, sn } from '@/components/Campos.js';
import { salvarFechamento } from '../actions.js';

export const dynamic = 'force-dynamic';
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const Dinheiro = ({ nome, rotulo, valor, negativo }) => (
  <div className="campo"><label htmlFor={nome}>{rotulo}</label>
    <input id={nome} name={nome} type="text" inputMode="decimal" defaultValue={valor ?? ''} placeholder="0,00" pattern={negativo ? '-?[0-9.,]*' : '[0-9.,]*'} autoComplete="off" /></div>
);

export default async function FechamentoFinanceiro(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!operaFinanceiro(u)) return <><Topo titulo="Fechamento financeiro" /><Aviso tipo="erro">Este fechamento é da equipe financeira. Peça ao administrador para incluir você em Financeiro → Operação financeira.</Aviso></>;
  const dia = hoje();
  const min = somarDias(dia, -7);
  const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(sp.data || '') && sp.data <= dia && sp.data >= min ? sp.data : dia;

  const [conts, cats, centros, forns, vendas, atual, anterior, cfg] = await Promise.all([
    contasAtivas(), categoriasAtivas(), centrosCusto(), fornecedores(), vendasDoDia(dataRef),
    fechamentoDoDia(dataRef), ultimoFechamento(somarDias(dataRef, -1)), configFinanceiro(),
  ]);
  const catsSaida = cats.filter((c) => c.natureza === 'saida');
  const produtos = await q('SELECT id, nome FROM products WHERE ativo ORDER BY nome');
  const saldoAnterior = anterior?.id ? await q('SELECT account_id, saldo_final FROM fin_closing_balances WHERE closing_id=$1', [anterior.id]) : [];
  const carregado = Object.fromEntries(saldoAnterior.map((s) => [s.account_id, Number(s.saldo_final)]));
  const c = atual || {};
  const saldoDe = (id) => atual?.saldos?.find((s) => s.account_id === id);
  const outroDia = dataRef !== dia;
  const fechado = atual?.status === 'fechado';

  return (
    <>
      <Topo titulo="Fechamento financeiro do dia" descricao={`${fmtData(dataRef)} · ${u.nome} · limite ${cfg.limite}. As vendas do dia vêm do Comercial e da Indicação.`}>
        <a className="btn sec" href="/financeiro">Painel</a>
      </Topo>
      {atual && <Aviso tipo="ok">Fechamento de {fmtData(dataRef)} — status: {STATUS_FECHAMENTO[atual.status]}. Você pode ajustar abaixo{fechado && !ehGerenteFinanceiro(u) ? ', mas o dia já foi fechado pelo gerente' : ''}.</Aviso>}

      <div className="painel form-claro">
        <FormEstado action={salvarFechamento} botao={atual ? 'Salvar fechamento' : 'Enviar fechamento'} botaoEnviando="Salvando…" protegerSaida progresso>
          <Condicionais /><Etapas />

          <Sec titulo="Identificação">
            <DataRegistro valor={dataRef} min={min} max={dia} rota="/financeiro/fechamento" />
            {outroDia && <Texto nome="justificativa_data" rotulo="Por que está fechando outra data?" valor={c.justificativa_data} obrig />}
            <Selecao nome="status" rotulo="Status do fechamento" valor={c.status || 'rascunho'} opcoes={opc(STATUS_FECHAMENTO)} dica={ehGerenteFinanceiro(u) ? 'Só você (gerente) pode marcar como “Fechado”.' : 'Deixe como “Conferido”; o gerente fecha o dia.'} />
            <Texto nome="observacao" rotulo="Observação" valor={c.observacao} obrig={false} />
          </Sec>

          <Sec titulo="Saldo bancário do dia">
            <p className="suave pequeno">O saldo inicial vem do saldo final de ontem. O saldo final de cada conta é calculado (inicial + entradas − saídas).</p>
            {conts.length === 0 ? <Aviso tipo="erro">Nenhuma conta cadastrada. Peça ao gerente para cadastrar em Financeiro → Cadastros.</Aviso> : conts.map((a) => {
              const s = saldoDe(a.id);
              return (
                <div key={a.id} className="linha-venda">
                  <input type="hidden" name="saldo_conta" value={a.id} />
                  <div className="linha-venda-topo"><b>{a.nome}</b> <span className="suave pequeno">{a.instituicao || ''}</span></div>
                  <div className="linha-campos">
                    <Dinheiro nome={`sc${a.id}_saldo_inicial`} rotulo="Saldo inicial" valor={s ? s.saldo_inicial : (carregado[a.id] ?? a.saldo_inicial)} negativo />
                    <Dinheiro nome={`sc${a.id}_entradas`} rotulo="Entradas do dia" valor={s?.entradas} />
                    <Dinheiro nome={`sc${a.id}_saidas`} rotulo="Saídas do dia" valor={s?.saidas} />
                    <Dinheiro nome={`sc${a.id}_bloqueado`} rotulo="Bloqueado/reservado" valor={s?.bloqueado} />
                  </div>
                </div>
              );
            })}
          </Sec>

          <Sec titulo="Entradas recebidas no dia">
            <p className="suave pequeno">Cada recebimento com valor bruto e taxa; o líquido é calculado. Venda não é o mesmo que recebimento.</p>
            <div className="campo"><label htmlFor="ent_qtd">Quantos recebimentos hoje?</label>
              <input id="ent_qtd" name="ent_qtd" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={atual?.entradas?.length || 0} placeholder="0" /></div>
            <ListaQtd campoQtd="ent_qtd" prefixo="ent" titulo="Entrada" inicial={(atual?.entradas || []).map((e) => ({ ...e, valor_bruto: String(e.valor_bruto).replace('.', ','), taxa: String(e.taxa).replace('.', ','), product_id: e.product_id ? String(e.product_id) : '', account_id: e.account_id ? String(e.account_id) : '' }))}
              campos={[{ nome: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: TIPOS_ENTRADA }, { nome: 'valor_bruto', rotulo: 'Valor bruto (R$)' }, { nome: 'taxa', rotulo: 'Taxa (R$)', opcional: true },
                { nome: 'cliente', rotulo: 'Cliente/origem', opcional: true }, { nome: 'product_id', rotulo: 'Produto', tipo: 'opcao', opcoes: Object.fromEntries(produtos.map((p) => [p.id, p.nome])), opcional: true },
                { nome: 'account_id', rotulo: 'Conta de destino', tipo: 'opcao', opcoes: Object.fromEntries(conts.map((a) => [a.id, a.nome])), opcional: true }]} />
          </Sec>

          <Sec titulo="Vendas do dia (automático)">
            <p className="suave pequeno">Consolidado do Comercial e da Indicação. Você confere, não redigita.</p>
            <div className="leitura">
              <div><span>Total de vendas</span><b>{vendas.qtd} · {moeda(vendas.valor, 0)}</b></div>
              <div><span>Comercial</span><b>{vendas.comercial.qtd} · {moeda(vendas.comercial.valor, 0)}</b></div>
              <div><span>Indicação</span><b>{vendas.indicacao.qtd} · {moeda(vendas.indicacao.valor, 0)}</b></div>
              <div><span>Pix / Cartão / Boleto</span><b>{moeda(vendas.pix, 0)} · {moeda(vendas.cartao, 0)} · {moeda(vendas.boleto, 0)}</b></div>
            </div>
            {vendas.porProduto.length > 0 && <table style={{ marginTop: 10 }}><tbody>{vendas.porProduto.map((p) => <tr key={p.nome}><td>{p.nome}</td><td className="num">{p.qtd}</td><td className="num">{moeda(p.valor, 0)}</td></tr>)}</tbody></table>}
          </Sec>

          <Sec titulo="Contas a receber (por faixa)">
            <p className="suave pequeno">Valores a receber que vencem em cada faixa. Vencido é o que já passou do prazo.</p>
            <div className="linha-campos"><Dinheiro nome="receber_hoje" rotulo="Hoje" valor={c.receber_hoje} /><Dinheiro nome="receber_7" rotulo="Próximos 7 dias" valor={c.receber_7} /><Dinheiro nome="receber_mes" rotulo="Até o fim do mês" valor={c.receber_mes} /></div>
            <div className="linha-campos"><Dinheiro nome="receber_30" rotulo="8 a 30 dias" valor={c.receber_30} /><Dinheiro nome="receber_60" rotulo="31 a 60 dias" valor={c.receber_60} /><Dinheiro nome="receber_90" rotulo="61 a 90 dias" valor={c.receber_90} /></div>
            <div className="linha-campos"><Dinheiro nome="receber_mais90" rotulo="Acima de 90 dias" valor={c.receber_mais90} /><Dinheiro nome="receber_vencido" rotulo="Vencido (atrasado)" valor={c.receber_vencido} /></div>
          </Sec>

          <Sec titulo="Contas pagas e a pagar">
            <div className="campo"><label htmlFor="pag_qtd">Quantas contas lançar hoje?</label>
              <input id="pag_qtd" name="pag_qtd" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={atual?.pagamentos?.length || 0} placeholder="0" /></div>
            <ListaQtd campoQtd="pag_qtd" prefixo="pag" titulo="Conta" inicial={(atual?.pagamentos || []).map((p) => ({ ...p, valor_previsto: String(p.valor_previsto).replace('.', ','), valor_pago: String(p.valor_pago).replace('.', ','), vencimento: p.vencimento ? String(p.vencimento).slice(0, 10) : '', pago_em: p.pago_em ? String(p.pago_em).slice(0, 10) : '', supplier_id: p.supplier_id ? String(p.supplier_id) : '', category_id: p.category_id ? String(p.category_id) : '' }))}
              campos={[{ nome: 'descricao', rotulo: 'Descrição' }, { nome: 'status', rotulo: 'Status', tipo: 'opcao', opcoes: STATUS_PAGAMENTO },
                { nome: 'valor_previsto', rotulo: 'Previsto (R$)', opcional: true }, { nome: 'valor_pago', rotulo: 'Pago (R$)', opcional: true },
                { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'data', opcional: true }, { nome: 'pago_em', rotulo: 'Pago em', tipo: 'data', opcional: true },
                { nome: 'category_id', rotulo: 'Categoria', tipo: 'opcao', opcoes: Object.fromEntries(catsSaida.map((x) => [x.id, x.nome])), opcional: true },
                { nome: 'supplier_id', rotulo: 'Fornecedor', tipo: 'opcao', opcoes: Object.fromEntries(forns.filter((f) => f.ativo).map((f) => [f.id, f.nome])), opcional: true },
                { nome: 'cost_center_id', rotulo: 'Centro de custo', tipo: 'opcao', opcoes: Object.fromEntries(centros.filter((x) => x.ativo).map((x) => [x.id, x.nome])), opcional: true },
                { nome: 'forma_pagamento', rotulo: 'Forma', tipo: 'opcao', opcoes: FORMAS_PAGAMENTO, opcional: true }]} />
          </Sec>

          <Sec titulo="Inadimplência">
            <div className="linha-campos">
              <div className="campo"><label htmlFor="inad_clientes">Clientes inadimplentes</label><input id="inad_clientes" name="inad_clientes" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={c.inad_clientes ?? ''} placeholder="0" /></div>
              <div className="campo"><label htmlFor="inad_acordos">Acordos realizados</label><input id="inad_acordos" name="inad_acordos" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={c.inad_acordos ?? ''} placeholder="0" /></div>
              <Dinheiro nome="inad_recuperado" rotulo="Recuperado no dia" valor={c.inad_recuperado} />
            </div>
            <div className="linha-campos"><Dinheiro nome="inad_1_7" rotulo="1 a 7 dias" valor={c.inad_1_7} /><Dinheiro nome="inad_8_30" rotulo="8 a 30 dias" valor={c.inad_8_30} /><Dinheiro nome="inad_31_60" rotulo="31 a 60 dias" valor={c.inad_31_60} /></div>
            <div className="linha-campos"><Dinheiro nome="inad_61_90" rotulo="61 a 90 dias" valor={c.inad_61_90} /><Dinheiro nome="inad_mais90" rotulo="Acima de 90 dias" valor={c.inad_mais90} /></div>
          </Sec>

          <Sec titulo="Conciliação e previsão">
            <div className="linha-campos">
              <Escolha nome="bancos_conciliados" rotulo="Bancos conciliados?" opcoes={SIM_NAO} valor={sn(c.bancos_conciliados)} obrig={false} />
              <Escolha nome="plataformas_conciliadas" rotulo="Plataformas conciliadas?" opcoes={SIM_NAO} valor={sn(c.plataformas_conciliadas)} obrig={false} />
            </div>
            <Dinheiro nome="divergencia_valor" rotulo="Valor total de divergências" valor={c.divergencia_valor} />
            <div data-se="divergencia_valor>0">
              <Texto nome="divergencia_motivo" rotulo="Motivo da divergência" valor={c.divergencia_motivo} obrig={false} />
              <Texto nome="divergencia_acao" rotulo="Ação necessária" valor={c.divergencia_acao} obrig={false} />
              <div className="linha-campos">
                <Selecao nome="divergencia_responsavel_id" rotulo="Responsável pela correção" valor={c.divergencia_responsavel_id} obrig={false} opcoes={(await q(`SELECT id, nome FROM users WHERE ativo ORDER BY nome`)).map((x) => ({ valor: x.id, rotulo: x.nome }))} />
                <div className="campo"><label htmlFor="divergencia_prazo">Prazo</label><input id="divergencia_prazo" name="divergencia_prazo" type="date" defaultValue={c.divergencia_prazo ? String(c.divergencia_prazo).slice(0, 10) : ''} /></div>
              </div>
            </div>
            <Selecao nome="risco" rotulo="Risco financeiro do dia" valor={c.risco} obrig={false} vazio="Sem risco relevante" opcoes={opc(RISCOS)} dica="Para fechar o dia é preciso conciliar os bancos e justificar divergências." />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
