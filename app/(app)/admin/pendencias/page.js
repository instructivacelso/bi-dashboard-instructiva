import { exigirUsuario } from '@/lib/auth.js';
import { pendenciasEquipe } from '@/lib/dados.js';
import { vePainelEmpresa, gerenteDe } from '@/lib/perm.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { Topo, Aviso, Vazio, StatusTarefa } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

export default async function Pendencias() {
  const u = await exigirUsuario();
  if (!vePainelEmpresa(u) && !gerenteDe(u, 'marketing')) return <Aviso tipo="erro">Área restrita.</Aviso>;
  const dia = hoje();
  const lista = await pendenciasEquipe(dia);
  const porPessoa = {};
  for (const p of lista) (porPessoa[p.usuario] ||= []).push(p);
  const pendentes = lista.filter((p) => !p.concluido).length;
  return (
    <>
      <Topo titulo="Pendências da equipe" descricao={`${fmtData(dia)} · ${pendentes} ${pendentes === 1 ? 'formulário pendente' : 'formulários pendentes'} de ${lista.length}. Formulários que não se aplicam hoje não aparecem.`} />
      {lista.length === 0 ? <Vazio>Nenhum formulário previsto para hoje.</Vazio> : (
        <div className="grade g3">
          {Object.entries(porPessoa).sort(([, a], [, b]) => b.filter((x) => !x.concluido).length - a.filter((x) => !x.concluido).length).map(([nome, itens]) => (
            <div className="painel" key={nome}>
              <h3>{nome}</h3>
              <table><tbody>{itens.map((t) => (
                <tr key={`${t.form}-${t.lancamento.id}`}><td>{t.titulo}<br /><span className="suave pequeno">{t.lancamento.nome}</span></td><td><StatusTarefa concluido={t.concluido} /></td></tr>
              ))}</tbody></table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
