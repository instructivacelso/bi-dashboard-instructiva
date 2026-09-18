import { exigirUsuario } from '@/lib/auth.js';
import { moeda } from '@/lib/formato.js';
import { configuraFinanceiro, TIPOS_CONTA, NATUREZAS, GRUPOS_CATEGORIA } from '@/lib/financeiro.js';
import { contas, categorias, centrosCusto, fornecedores, recorrentes, categoriasAtivas, configFinanceiro } from '@/lib/dadosFinanceiro.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarConta, salvarCategoria, salvarFornecedor, salvarCentro, salvarRecorrente, salvarConfig } from '../actions.js';

export const dynamic = 'force-dynamic';
const Dinheiro = ({ nome, valor }) => <input name={nome} type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={valor ?? ''} placeholder="0,00" />;
const Ativo = ({ v }) => <label className="pequeno"><input type="checkbox" name="ativo" defaultChecked={v} /> Ativo</label>;

export default async function CadastrosFinanceiro() {
  const u = await exigirUsuario();
  if (!configuraFinanceiro(u)) return <><Topo titulo="Cadastros do Financeiro" /><Aviso tipo="erro">Só o gerente financeiro e o administrador acessam os cadastros.</Aviso></>;
  const [conts, cats, catsAtivas, centros, forns, recs, cfg] = await Promise.all([contas(), categorias(), categoriasAtivas(), centrosCusto(), fornecedores(), recorrentes(), configFinanceiro()]);
  const optCat = (natureza) => catsAtivas.filter((c) => !natureza || c.natureza === natureza);

  return (
    <>
      <Topo titulo="Cadastros do Financeiro" descricao="Contas, categorias, fornecedores, centros de custo e compromissos fixos. Configure aqui antes do primeiro fechamento."><a className="btn sec" href="/financeiro">Painel</a></Topo>

      <section className="secao painel">
        <h2>Parâmetros</h2>
        <FormEstado action={salvarConfig} botao="Salvar parâmetros">
          <div className="linha-campos">
            <div className="campo"><label>Horário-limite do fechamento</label><input name="horario_limite" type="time" defaultValue={cfg.limite} required /></div>
            <div className="campo"><label>Probabilidade de receber boleto (%)</label><input name="prob_boleto" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={Math.round(cfg.probBoleto * 100)} required /></div>
            <div className="campo"><label>Probabilidade de recuperar inadimplência (%)</label><input name="prob_inadimplencia" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={Math.round(cfg.probInad * 100)} required /></div>
          </div>
        </FormEstado>
      </section>

      <section className="secao painel">
        <h2>Contas bancárias e caixas</h2>
        <FormEstado action={salvarConta} botao="Adicionar conta">
          <div className="linha-campos">
            <div className="campo"><label>Nome</label><input name="nome" required /></div>
            <div className="campo"><label>Instituição</label><input name="instituicao" /></div>
            <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="corrente">{Object.entries(TIPOS_CONTA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Saldo inicial</label><Dinheiro nome="saldo_inicial" /></div>
          </div>
        </FormEstado>
        <div className="grade g2" style={{ marginTop: 14 }}>{conts.map((a) => (
          <div className="painel" key={a.id}><FormEstado action={salvarConta} botao="Salvar">
            <input type="hidden" name="id" value={a.id} />
            <div className="linha-campos">
              <div className="campo"><label>Nome</label><input name="nome" defaultValue={a.nome} required /></div>
              <div className="campo"><label>Instituição</label><input name="instituicao" defaultValue={a.instituicao || ''} /></div>
              <div className="campo"><label>Tipo</label><select name="tipo" defaultValue={a.tipo}>{Object.entries(TIPOS_CONTA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo"><label>Saldo inicial</label><Dinheiro nome="saldo_inicial" valor={a.saldo_inicial} /></div>
            </div><Ativo v={a.ativo} />
          </FormEstado></div>
        ))}</div>
      </section>

      <section className="secao painel">
        <h2>Categorias (plano de contas)</h2>
        <FormEstado action={salvarCategoria} botao="Adicionar categoria">
          <div className="linha-campos">
            <div className="campo"><label>Nome</label><input name="nome" required /></div>
            <div className="campo"><label>Natureza</label><select name="natureza" defaultValue="saida">{Object.entries(NATUREZAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Grupo</label><select name="grupo" defaultValue="outra">{Object.entries(GRUPOS_CATEGORIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
          </div>
        </FormEstado>
        <div className="grade g3" style={{ marginTop: 14 }}>{cats.map((c) => (
          <div className="painel" key={c.id}><FormEstado action={salvarCategoria} botao="Salvar">
            <input type="hidden" name="id" value={c.id} />
            <div className="campo"><label>Nome</label><input name="nome" defaultValue={c.nome} required /></div>
            <div className="linha-campos">
              <div className="campo"><label>Natureza</label><select name="natureza" defaultValue={c.natureza}>{Object.entries(NATUREZAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo"><label>Grupo</label><select name="grupo" defaultValue={c.grupo}>{Object.entries(GRUPOS_CATEGORIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            </div><Ativo v={c.ativo} />
          </FormEstado></div>
        ))}</div>
      </section>

      <section className="secao grade g2">
        <div className="painel"><h2>Fornecedores</h2>
          <FormEstado action={salvarFornecedor} botao="Adicionar">
            <div className="linha-campos"><div className="campo"><label>Nome</label><input name="nome" required /></div><div className="campo"><label>CNPJ/CPF</label><input name="documento" /></div></div>
          </FormEstado>
          <ul className="lista-simples" style={{ marginTop: 12 }}>{forns.map((f) => (
            <li key={f.id}><FormEstado action={salvarFornecedor} botao="Salvar"><input type="hidden" name="id" value={f.id} />
              <div className="linha-campos"><div className="campo"><input name="nome" defaultValue={f.nome} required /></div><div className="campo"><input name="documento" defaultValue={f.documento || ''} /></div></div><Ativo v={f.ativo} />
            </FormEstado></li>
          ))}</ul>
        </div>
        <div className="painel"><h2>Centros de custo</h2>
          <FormEstado action={salvarCentro} botao="Adicionar"><div className="campo"><label>Nome</label><input name="nome" required /></div></FormEstado>
          <ul className="lista-simples" style={{ marginTop: 12 }}>{centros.map((c) => (
            <li key={c.id}><FormEstado action={salvarCentro} botao="Salvar"><input type="hidden" name="id" value={c.id} /><div className="campo"><input name="nome" defaultValue={c.nome} required /></div><Ativo v={c.ativo} /></FormEstado></li>
          ))}</ul>
        </div>
      </section>

      <section className="secao painel">
        <h2>Compromissos fixos mensais</h2>
        <p className="suave pequeno">Aluguel, salários, softwares e outras contas que se repetem. Entram na projeção de caixa.</p>
        <FormEstado action={salvarRecorrente} botao="Adicionar compromisso">
          <div className="linha-campos">
            <div className="campo"><label>Descrição</label><input name="descricao" required /></div>
            <div className="campo"><label>Categoria</label><select name="category_id" defaultValue=""><option value="">—</option>{optCat('saida').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div className="campo"><label>Valor mensal</label><Dinheiro nome="valor" /></div>
            <div className="campo"><label>Dia do vencimento</label><input name="dia_vencimento" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="10" required /></div>
          </div>
        </FormEstado>
        <div className="grade g2" style={{ marginTop: 14 }}>{recs.map((r) => (
          <div className="painel" key={r.id}><FormEstado action={salvarRecorrente} botao="Salvar"><input type="hidden" name="id" value={r.id} />
            <div className="linha-campos">
              <div className="campo"><label>Descrição</label><input name="descricao" defaultValue={r.descricao} required /></div>
              <div className="campo"><label>Categoria</label><select name="category_id" defaultValue={r.category_id || ''}><option value="">—</option>{optCat('saida').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div className="campo"><label>Valor mensal ({moeda(r.valor, 0)})</label><Dinheiro nome="valor" valor={r.valor} /></div>
              <div className="campo"><label>Dia</label><input name="dia_vencimento" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={r.dia_vencimento} required /></div>
            </div><Ativo v={r.ativo} />
          </FormEstado></div>
        ))}</div>
      </section>
    </>
  );
}
