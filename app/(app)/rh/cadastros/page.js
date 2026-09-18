import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { moeda } from '@/lib/formato.js';
import { configuraRh, veSalario } from '@/lib/rh.js';
import { cargos } from '@/lib/dadosRh.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarCargo, salvarConfigRh } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function CadastrosRh() {
  const u = await exigirUsuario();
  if (!configuraRh(u)) return <><Topo titulo="Cadastros do RH" /><Aviso tipo="erro">Só o gerente de RH e o administrador acessam.</Aviso></>;
  const [lista, setores, cfg] = await Promise.all([
    cargos(), q('SELECT id, nome FROM departments ORDER BY ordem'),
    q(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'rh_%'`),
  ]);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, c.valor]));
  const podeSalario = veSalario(u);
  const Campos = ({ c = {} }) => (
    <>
      <div className="linha-campos">
        <div className="campo"><label>Nome do cargo</label><input name="nome" defaultValue={c.nome} required /></div>
        <div className="campo"><label>Setor</label><select name="department_id" defaultValue={c.department_id || ''}><option value="">—</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
        <div className="campo"><label>Nível</label><input name="nivel" defaultValue={c.nivel || ''} placeholder="Júnior/Pleno/Sênior" /></div>
      </div>
      {podeSalario && (
        <div className="linha-campos">
          <div className="campo"><label>Faixa mínima</label><input name="faixa_min" type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={c.faixa_min ?? ''} placeholder="0,00" /></div>
          <div className="campo"><label>Faixa máxima</label><input name="faixa_max" type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={c.faixa_max ?? ''} placeholder="0,00" /></div>
        </div>
      )}
    </>
  );

  return (
    <>
      <Topo titulo="Cadastros do RH" descricao="Cargos e parâmetros do setor."><a className="btn sec" href="/rh">Painel</a></Topo>

      <section className="secao painel"><h2>Parâmetros</h2>
        <FormEstado action={salvarConfigRh} botao="Salvar parâmetros">
          <div className="linha-campos">
            <div className="campo"><label>Horário-limite do fechamento</label><input name="horario_limite" type="time" defaultValue={m.rh_horario_limite || '19:00'} required /></div>
            <div className="campo"><label>Meta de absenteísmo (%)</label><input name="meta_absenteismo" type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={m.rh_meta_absenteismo ?? 3} required /></div>
            <div className="campo"><label>Meta de turnover (%)</label><input name="meta_turnover" type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={m.rh_meta_turnover ?? 4} required /></div>
          </div>
        </FormEstado>
      </section>

      <section className="secao painel"><h2>Cargos</h2>
        <FormEstado action={salvarCargo} botao="Adicionar cargo"><Campos /></FormEstado>
        <div className="grade g2" style={{ marginTop: 14 }}>{lista.map((c) => (
          <div className="painel" key={c.id}><FormEstado action={salvarCargo} botao="Salvar">
            <input type="hidden" name="id" value={c.id} /><Campos c={c} />
            <label className="pequeno"><input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Ativo</label>
            {podeSalario && (c.faixa_min || c.faixa_max) ? <p className="suave pequeno">Faixa: {moeda(c.faixa_min, 0)} – {moeda(c.faixa_max, 0)}</p> : null}
          </FormEstado></div>
        ))}</div>
      </section>
    </>
  );
}
