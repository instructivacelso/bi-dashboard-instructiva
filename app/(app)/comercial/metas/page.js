import { exigirUsuario } from '@/lib/auth.js';
import { CIDADES, ehDiretorComercial } from '@/lib/comercial.js';
import { vendedoresDe, configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Vazio } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarMetas } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function Metas() {
  const u = await exigirUsuario();
  if (!ehDiretorComercial(u)) return <Aviso tipo="erro">Só o administrador e a diretoria comercial definem metas.</Aviso>;
  const [vend, limite] = await Promise.all([vendedoresDe(Object.keys(CIDADES)), configuracao('comercial_horario_limite', '19:00')]);
  return (
    <>
      <Topo titulo="Metas comerciais" descricao="Metas em R$ por vendedor. A meta da equipe é a soma das metas dos vendedores." />
      <div className="painel">
        <FormEstado action={salvarMetas} botao="Salvar metas" className="form" sucesso="Metas salvas.">
          <div className="campo" style={{ maxWidth: 240 }}>
            <label htmlFor="horario_limite">Horário-limite do fechamento</label>
            <input id="horario_limite" name="horario_limite" type="time" defaultValue={limite} required />
            <small>Depois desse horário o envio fica marcado como “com atraso”.</small>
          </div>
          {vend.length === 0 ? <Vazio>Nenhum vendedor cadastrado ainda.</Vazio> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Vendedor</th><th>Meta diária (R$)</th><th>Meta semanal (R$)</th><th>Meta mensal (R$)</th></tr></thead>
              <tbody>{vend.map((v) => (
                <tr key={v.id}><td><input type="hidden" name="vendedor" value={v.id} /><b>{v.nome}</b><br /><span className="suave pequeno">{CIDADES[v.cidade]}</span></td>
                  {['diaria', 'semanal', 'mensal'].map((k) => (
                    <td key={k}><input name={`${k}_${v.id}`} type="text" inputMode="decimal" defaultValue={v[`meta_${k}`] ?? ''} aria-label={`Meta ${k} de ${v.nome}`} placeholder="0,00" style={{ minWidth: 110 }} /></td>
                  ))}</tr>
              ))}</tbody>
            </table></div>
          )}
        </FormEstado>
      </div>
    </>
  );
}
