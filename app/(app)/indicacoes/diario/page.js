import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { ORIGENS, PAGAMENTOS, STATUS_VENDA, OBJECOES, MOTIVOS_INVALIDA, MOTIVOS_PERDA, ehColaboradorIndicacao } from '@/lib/indicacao.js';
import { numerosIndicacao } from '@/lib/dadosIndicacao.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import DataRegistro from '@/components/DataRegistro.js';
import { Numero, Texto, Escolha, Selecao } from '@/components/Campos.js';
import { salvarDiarioIndicacao } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function DiarioIndicacao(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehColaboradorIndicacao(u)) return <><Topo titulo="Formulário do dia — Indicação" /><Aviso tipo="erro">Este formulário é do colaborador de indicação. Peça ao administrador para marcar a atividade “Colaborador de indicação”.</Aviso></>;
  const dia = hoje();
  const min = somarDias(dia, -7);
  const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(sp.data || '') && sp.data <= dia && sp.data >= min ? sp.data : dia;
  const [atual, sis, produtos, limite] = await Promise.all([
    q1('SELECT * FROM referral_daily_forms WHERE user_id=$1 AND data_ref=$2', [u.id, dataRef]),
    numerosIndicacao(dataRef, dataRef, u.id), q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'),
    configuracao('indicacao_horario_limite', '19:00'),
  ]);
  const v = atual || {};
  const outroDia = dataRef !== dia;
  const Ref = ({ n }) => <small className="suave">No pipeline nesta data: <b>{n}</b></small>;
  return (
    <>
      <Topo titulo="Formulário do dia — Indicação" descricao={`${u.nome} · leva uns 3 minutos · limite ${limite}. Os números do seu pipeline aparecem como referência.`}>
        <a className="btn sec" href="/indicacoes/painel">Meu painel</a>
      </Topo>
      {atual && <Aviso tipo="ok">Você já enviou o formulário de {fmtData(dataRef)}. Pode ajustar abaixo.</Aviso>}
      <div className="painel form-claro">
        <FormEstado action={salvarDiarioIndicacao} botao={atual ? 'Salvar alterações' : 'Enviar formulário'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais /><Etapas />
          <Sec titulo="Data, colaborador e origens">
            <span className="rot"><B n="1">Data do registro</B></span>
            <DataRegistro valor={dataRef} min={min} max={dia} rota="/indicacoes/diario" />
            {outroDia && <Texto nome="justificativa_data" rotulo="Por que está registrando em outra data?" valor={v.justificativa_data} obrig />}
            <div className="campo"><span className="rot"><B n="2">Colaborador responsável</B></span><div className="cidade-fixa">{u.nome} <small>· pelo seu login</small></div></div>
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}><B n="3">Origem das indicações trabalhadas</B></legend>
              <div className="escolha" data-grupo-obrigatorio="Origem das indicações">{Object.entries(ORIGENS).map(([k, r]) => <label key={k}><input type="checkbox" name="origens" value={k} defaultChecked={v.origens?.includes(k)} /> {r}</label>)}</div>
            </fieldset>
            <div data-se="origens:outra"><Texto nome="origem_outra" rotulo="Qual outra origem?" valor={v.origem_outra} obrig max={150} /></div>
          </Sec>
          <Sec titulo="Números do dia">
            <div className="linha-campos">
              <div className="campo"><Numero nome="recebidas" rotulo={<B n="4">Indicações novas recebidas</B>} valor={v.recebidas ?? sis.recebidas} /><Ref n={sis.recebidas} /></div>
              <div className="campo"><Numero nome="trabalhados" rotulo={<B n="5">Indicados trabalhados (pessoas únicas)</B>} valor={v.trabalhados ?? sis.trabalhados} /><Ref n={sis.trabalhados} /></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><Numero nome="responderam" rotulo={<B n="6">Indicados que responderam</B>} valor={v.responderam ?? sis.responderam} /><Ref n={sis.responderam} /></div>
              <div className="campo"><Numero nome="validadas" rotulo={<B n="7">Indicações validadas</B>} valor={v.validadas ?? sis.validadas} /><Ref n={sis.validadas} /></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><Numero nome="followups" rotulo={<B n="8">Follow-ups realizados</B>} valor={v.followups ?? sis.followups} dica="Retornos em indicações já trabalhadas. Não conta o primeiro contato." /><Ref n={sis.followups} /></div>
              <div className="campo"><Numero nome="encaminhadas" rotulo={<B n="9">Oportunidades encaminhadas ao comercial</B>} valor={v.encaminhadas ?? sis.encaminhadas} /><Ref n={sis.encaminhadas} /></div>
            </div>
            <Texto nome="justificativa_numeros" rotulo="Justificativa (só se os números não baterem)" valor={v.justificativa_numeros} obrig={false} dica="Preencha quando responderam > trabalhados, validadas > responderam ou encaminhadas > validadas (ex.: respostas de dias anteriores)." />
          </Sec>
          <Sec titulo="Vendas por indicação">
            <span className="rot"><B n="10">Resultado de vendas no dia</B></span>
            <Numero nome="vendas_qtd" rotulo="Vendas confirmadas" valor={v.vendas_qtd ?? 0} dica="O valor total é a soma das vendas abaixo. Cancelada não conta como receita." />
            <ListaQtd campoQtd="vendas_qtd" prefixo="vd" titulo="Venda" inicial={(v.vendas || []).map((x) => ({ ...x, produto: String(x.produto), valor: String(x.valor).replace('.', ',') }))}
              campos={[{ nome: 'indicador', rotulo: 'Aluno indicador' }, { nome: 'indicado', rotulo: 'Cliente indicado' }, { nome: 'vendedor', rotulo: 'Vendedor responsável' },
                { nome: 'produto', rotulo: 'Curso', tipo: 'opcao', opcoes: Object.fromEntries(produtos.map((p) => [p.id, p.nome])) }, { nome: 'valor', rotulo: 'Valor (R$)' },
                { nome: 'pagamento', rotulo: 'Forma de pagamento', tipo: 'opcao', opcoes: PAGAMENTOS }, { nome: 'status', rotulo: 'Status do pagamento', tipo: 'opcao', opcoes: STATUS_VENDA }]} />
          </Sec>
          <Sec titulo="Complementos (opcional)">
            <div className="linha-campos">
              <Selecao nome="objecao" rotulo="Principal objeção do dia" valor={v.objecao} obrig={false} vazio="Nenhuma" opcoes={opc(OBJECOES)} />
              <Selecao nome="motivo_invalidas" rotulo="Motivo das indicações inválidas" valor={v.motivo_invalidas} obrig={false} vazio="Nenhuma inválida" opcoes={opc(MOTIVOS_INVALIDA)} />
            </div>
            <div className="linha-campos">
              <Selecao nome="motivo_perda" rotulo="Motivo de perda" valor={v.motivo_perda} obrig={false} vazio="Nenhuma perda" opcoes={opc(MOTIVOS_PERDA)} />
              <Texto nome="gargalo" rotulo="Gargalo ou problema operacional" valor={v.gargalo} obrig={false} />
            </div>
            <Escolha nome="precisa_ajuda" rotulo="Precisa de ajuda do gerente?" opcoes={{ nao: 'Não', sim: 'Sim' }} valor={v.precisa_ajuda ? 'sim' : 'nao'} />
            <div data-se="precisa_ajuda:sim"><Texto nome="ajuda_descricao" rotulo="Em quê?" valor={v.ajuda_descricao} obrig /></div>
            <Texto nome="observacao" rotulo="Observação curta" valor={v.observacao} obrig={false} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
