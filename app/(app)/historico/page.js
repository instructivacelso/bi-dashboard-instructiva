import { exigirUsuario } from '@/lib/auth.js';
import { historico, lancamentosVisiveis } from '@/lib/dados.js';
import { hoje, fmtData, fmtDataHora } from '@/lib/datas.js';
import { FORMULARIOS } from '@/lib/formularios.js';
import { vePainelEmpresa, gerenteDe, podeEditar } from '@/lib/perm.js';
import { Topo, Vazio } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

export default async function Historico({ searchParams }) {
  const u = await exigirUsuario();
  const dia = hoje();
  const equipe = vePainelEmpresa(u) || gerenteDe(u, 'marketing');
  const form = FORMULARIOS[searchParams.form] ? searchParams.form : null;
  const verEquipe = equipe && searchParams.meus !== '1';
  const linhas = await historico({
    autorId: verEquipe ? null : u.id,
    launchIds: verEquipe && !vePainelEmpresa(u) ? (await lancamentosVisiveis(u)).map((l) => l.id) : null,
    form,
  });
  const link = (extra) => `/historico?${new URLSearchParams({ ...(form && { form }), ...(!verEquipe && equipe && { meus: '1' }), ...extra })}`;

  return (
    <>
      <Topo titulo={verEquipe ? 'Histórico da equipe' : 'Meu histórico'} descricao="Registros enviados, do mais recente para o mais antigo. Registros alterados mostram quem alterou por último.">
        {equipe && <a className="btn sec" href={verEquipe ? '/historico?meus=1' : '/historico'}>{verEquipe ? 'Ver só os meus' : 'Ver da equipe'}</a>}
        {vePainelEmpresa(u) && <a className="btn sec" href={`/api/exportar/historico${form ? `?form=${form}` : ''}`}>Exportar CSV</a>}
      </Topo>
      <nav className="acoes-linha" style={{ marginBottom: 16 }} aria-label="Filtrar por formulário">
        <a className={`btn peq ${!form ? '' : 'sec'}`} href={`/historico${!verEquipe && equipe ? '?meus=1' : ''}`}>Todos</a>
        {Object.entries(FORMULARIOS).map(([k, f]) => (
          <a key={k} className={`btn peq ${form === k ? '' : 'sec'}`} href={`/historico?${new URLSearchParams({ form: k, ...(!verEquipe && equipe && { meus: '1' }) })}`}>{f.titulo}</a>
        ))}
      </nav>
      {linhas.length === 0 ? <Vazio>Nenhum registro ainda.</Vazio> : (
        <div className="painel tabela-wrap">
          <table>
            <thead><tr><th>Data</th><th>Formulário</th><th>Lançamento</th><th>Resumo</th>{verEquipe && <th>Autor</th>}<th>Última alteração</th><th /></tr></thead>
            <tbody>
              {linhas.map((r) => {
                const perm = podeEditar(u, r, dia);
                return (
                  <tr key={`${r.form}-${r.id}`}>
                    <td>{fmtData(r.data_ref)}</td>
                    <td>{FORMULARIOS[r.form].titulo}</td>
                    <td>{r.lancamento}</td>
                    <td>{r.resumo}</td>
                    {verEquipe && <td>{r.autor}</td>}
                    <td className="pequeno suave">{fmtDataHora(r.updated_at)}{r.updated_by && r.updated_by !== r.created_by ? ' · corrigido' : ''}</td>
                    <td>{perm.pode && <a className="btn sec peq" href={`/marketing/${r.form}?registro=${r.id}`}>{perm.correcao ? 'Corrigir' : 'Editar'}</a>}</td>
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
