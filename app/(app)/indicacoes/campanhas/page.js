import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { TIPOS_BENEFICIO, STATUS_CAMPANHA, veTodaIndicacao } from '@/lib/indicacao.js';
import { todasCampanhas } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import InputMoeda from '@/components/InputMoeda.js';
import { Numero, Texto, Selecao } from '@/components/Campos.js';
import { salvarCampanha } from '../actions.js';

export const dynamic = 'force-dynamic';
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
function Campos({ c = {}, produtos, k }) {
  return (
    <>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="linha-campos"><Texto nome="nome" rotulo="Nome da campanha" valor={c.nome} obrig /><Selecao nome="status" rotulo="Situação" valor={c.status || 'ativa'} opcoes={opc(STATUS_CAMPANHA)} /></div>
      <Selecao nome="product_id" rotulo="Curso principal" valor={c.product_id} obrig={false} vazio="Todos os cursos" opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
      <div className="linha-campos">
        <Numero nome="qtd_por_beneficio" rotulo="Indicações válidas por benefício" valor={c.qtd_por_beneficio ?? 5} />
        <Selecao nome="beneficio_tipo" rotulo="Tipo de benefício" valor={c.beneficio_tipo} opcoes={opc(TIPOS_BENEFICIO)} />
      </div>
      <Texto nome="beneficio_descricao" rotulo="Descrição do benefício" valor={c.beneficio_descricao} obrig dica="Ex.: bônus do curso de NR-10, cashback de R$ 50, apostila impressa." />
      <div className="linha-campos">
        <div className="campo"><label htmlFor={`bv${k}`}>Valor/custo de cada benefício</label><InputMoeda id={`bv${k}`} name="beneficio_valor" valorInicial={c.beneficio_valor ?? 0} /></div>
        <label className="escolha" style={{ alignSelf: 'end' }}><span style={{ display: 'inline-flex', gap: 8 }}><input type="checkbox" name="gera_sorteio" defaultChecked={c.gera_sorteio} /> Gera número para sorteio</span></label>
      </div>
      <div className="linha-campos">
        <Numero nome="meta_diaria_indicacoes" rotulo="Meta diária de indicações" valor={c.meta_diaria_indicacoes} obrig={false} />
        <Numero nome="meta_diaria_vendas" rotulo="Meta diária de vendas" valor={c.meta_diaria_vendas} obrig={false} />
      </div>
    </>
  );
}
export default async function Campanhas() {
  const u = await exigirUsuario();
  if (!veTodaIndicacao(u)) return <Aviso tipo="erro">Área do gerente de Indicação.</Aviso>;
  const [camps, produtos] = await Promise.all([todasCampanhas(), q('SELECT id, nome FROM products WHERE ativo ORDER BY nome')]);
  return (
    <>
      <Topo titulo="Campanhas de indicação" descricao="As regras ficam aqui, não no sistema: quantidade por benefício, tipo, valor e sorteio."><a className="btn sec" href="/indicacoes">Voltar</a></Topo>
      <details className="painel bloco" open={!camps.length}><summary>Nova campanha</summary>
        <div style={{ marginTop: 12 }}><FormEstado action={salvarCampanha} botao="Criar campanha"><Campos produtos={produtos} k="novo" /></FormEstado></div>
      </details>
      {camps.map((c) => (
        <details className="painel bloco" key={c.id} style={{ marginTop: 12 }}><summary>{c.nome} · {STATUS_CAMPANHA[c.status]} · {c.qtd_por_beneficio} válidas = {c.beneficio_descricao}</summary>
          <div style={{ marginTop: 12 }}><FormEstado action={salvarCampanha} botao="Salvar campanha"><Campos c={c} produtos={produtos} k={c.id} /></FormEstado></div>
        </details>
      ))}
    </>
  );
}
