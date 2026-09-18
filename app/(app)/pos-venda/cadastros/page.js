import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { configuraPosvenda } from '@/lib/posvenda.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarConfigPosvenda } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function CadastrosPosvenda() {
  const u = await exigirUsuario();
  if (!configuraPosvenda(u)) return <><Topo titulo="Cadastros do pós-venda" /><Aviso tipo="erro">Só o gerente de pós-venda e o administrador acessam.</Aviso></>;
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'posvenda_%'`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, c.valor]));

  return (
    <>
      <Topo titulo="Cadastros do pós-venda" descricao="Parâmetros do setor."><a className="btn sec" href="/pos-venda">Painel</a></Topo>
      <section className="secao painel"><h2>Parâmetros</h2>
        <FormEstado action={salvarConfigPosvenda} botao="Salvar parâmetros">
          <div className="linha-campos">
            <div className="campo"><label>Horário-limite do fechamento</label><input name="horario_limite" type="time" defaultValue={m.posvenda_horario_limite || '19:00'} required /></div>
            <div className="campo"><label>Meta de renovação (%)</label><input name="meta_renovacao" inputMode="decimal" pattern="[0-9.,]*" defaultValue={m.posvenda_meta_renovacao ?? 85} required /></div>
            <div className="campo"><label>Meta de NPS (pontos)</label><input name="meta_nps" inputMode="decimal" pattern="[0-9.,-]*" defaultValue={m.posvenda_meta_nps ?? 50} required /></div>
          </div>
          <p className="suave pequeno">A meta de NPS é em pontos (−100 a 100). A taxa de renovação e o churn usam os contratos que estavam vencendo no período.</p>
        </FormEstado>
      </section>
    </>
  );
}
