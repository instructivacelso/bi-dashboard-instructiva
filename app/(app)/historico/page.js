import { exigirUsuario } from '@/lib/auth.js';
import { historico, lancamentosVisiveis, responsaveisMarketing } from '@/lib/dados.js';
import { hoje, fmtData, fmtDataHora } from '@/lib/datas.js';
import { FORMULARIOS } from '@/lib/formularios.js';
import { vePainelEmpresa, gerenteDe, podeEditar } from '@/lib/perm.js';
import { Topo, Vazio } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const dataOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

export default async function Historico(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  const dia = hoje();
  const equipe = vePainelEmpresa(u) || gerenteDe(u, 'marketing');
  const form = FORMULARIOS[sp.form] ? sp.form : null;
  const lancs = await lancamentosVisiveis(u);
  const fLanc = Number(sp.lancamento) || null;
  const autorId = equipe ? (Number(sp.colaborador) || null) : u.id;
  const linhas = await historico({
    autorId,
    launchIds: fLanc ? [fLanc].filter((id) => lancs.some((l) => l.id === id)) : (equipe && !vePainelEmpresa(u) ? lancs.map((l) => l.id) : null),
    form, desde: dataOk(sp.desde), ate: dataOk(sp.ate), status: ['enviado', 'editado'].includes(sp.status) ? sp.status : null,
  });
  const pessoas = equipe ? await responsaveisMarketing() : [];

  return (
    <>
      <Topo titulo={equipe ? 'Histórico da equipe' : 'Meus envios'} descricao="Registros enviados, do mais recente para o mais antigo.">
        {vePainelEmpresa(u) && <a className="btn sec" href={`/api/exportar/historico${form ? `?form=${form}` : ''}`}>Exportar CSV</a>}
      </Topo>
      <form className="filtros" method="get">
        {equipe && (
          <div className="campo"><label htmlFor="f-c">Colaborador</label>
            <select id="f-c" name="colaborador" defaultValue={sp.colaborador || ''}><option value="">Todos</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          </div>
        )}
        <div className="campo"><label htmlFor="f-f">Formulário</label>
          <select id="f-f" name="form" defaultValue={form || ''}><option value="">Todos</option>{Object.entries(FORMULARIOS).map(([k, f]) => <option key={k} value={k}>{f.titulo}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="f-l">Lançamento</label>
          <select id="f-l" name="lancamento" defaultValue={fLanc || ''}><option value="">Todos</option>{lancs.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="f-d">De</label><input id="f-d" name="desde" type="date" defaultValue={sp.desde || ''} /></div>
        <div className="campo"><label htmlFor="f-a">Até</label><input id="f-a" name="ate" type="date" defaultValue={sp.ate || ''} /></div>
        <div className="campo"><label htmlFor="f-s">Status</label>
          <select id="f-s" name="status" defaultValue={sp.status || ''}><option value="">Todos</option><option value="enviado">Enviado</option><option value="editado">Editado</option></select>
        </div>
        <button className="btn peq" type="submit">Filtrar</button>
      </form>
      {linhas.length === 0 ? <Vazio>Nenhum registro encontrado.</Vazio> : (
        <div className="painel tabela-wrap">
          <table>
            <thead><tr><th>Data</th><th>Lançamento</th><th>Formulário</th>{equipe && <th>Colaborador</th>}<th>Resumo</th><th>Status</th><th>Enviado em</th><th /></tr></thead>
            <tbody>
              {linhas.map((r) => {
                const perm = podeEditar(u, r, dia);
                return (
                  <tr key={`${r.form}-${r.id}`}>
                    <td>{fmtData(r.data_ref)}</td>
                    <td>{r.lancamento}</td>
                    <td>{FORMULARIOS[r.form].titulo}</td>
                    {equipe && <td>{r.autor}</td>}
                    <td className="pequeno">{r.resumo}</td>
                    <td>{r.updated_by ? <span className="selo amarelo">Editado</span> : <span className="selo verde">Enviado</span>}</td>
                    <td className="pequeno suave">{fmtDataHora(r.created_at)}</td>
                    <td><div className="acoes-linha" style={{ flexWrap: 'nowrap' }}>
                      <a className="btn sec peq" href={`/historico/${r.form}/${r.id}`}>Visualizar</a>
                      {perm.pode && <a className="btn sec peq" href={`/marketing/${r.form}?registro=${r.id}`}>{perm.correcao ? 'Corrigir' : 'Editar'}</a>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
