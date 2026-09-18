import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtData, fmtDataHora } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { operaRh, veSalario, TIPOS_MOVIMENTO, TIPOS_DESLIGAMENTO, STATUS_COLAB } from '@/lib/rh.js';
import { colaborador, movimentacoesDe, cargosAtivos } from '@/lib/dadosRh.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarColaborador, salvarMovimento } from '../../actions.js';
import { CamposColaborador } from '../page.js';

export const dynamic = 'force-dynamic';

export default async function FichaColaborador(props) {
  const { id } = await props.params;
  const u = await exigirUsuario();
  if (!operaRh(u)) return <><Topo titulo="Colaborador" /><Aviso tipo="erro">Área da equipe de RH.</Aviso></>;
  const e = await colaborador(id);
  if (!e) return <><Topo titulo="Colaborador" /><Aviso tipo="erro">Colaborador não encontrado.</Aviso></>;
  const [movs, cargos, setores, gestores] = await Promise.all([
    movimentacoesDe(id), cargosAtivos(),
    q('SELECT id, nome FROM departments WHERE modulo_ativo OR slug=$1 ORDER BY ordem', ['rh']),
    q("SELECT id, nome FROM hr_employees WHERE status<>'desligado' ORDER BY nome"),
  ]);
  const podeSalario = veSalario(u);

  return (
    <>
      <Topo titulo={e.nome} descricao={`${e.cargo || 'Sem cargo'} · ${e.setor || 'Sem setor'} · admissão ${e.admissao ? fmtData(e.admissao) : '—'}`}>
        <Semaforo cor={e.status === 'ativo' ? 'verde' : e.status === 'desligado' ? 'vermelho' : 'amarelo'} texto={STATUS_COLAB[e.status]} />
        <a className="btn sec" href="/rh/colaboradores">Voltar</a>
      </Topo>

      <div className="painel"><h2>Dados profissionais</h2>
        <FormEstado action={salvarColaborador} botao="Salvar alterações">
          <input type="hidden" name="id" value={e.id} />
          <CamposColaborador e={e} cargos={cargos} setores={setores} gestores={gestores} podeSalario={podeSalario} />
          {e.status !== 'desligado' && (
            <div className="condicional-inline" style={{ marginTop: 6 }}>
              <p className="suave pequeno">Para desligar, mude o status para “Desligado” e informe:</p>
              <div className="linha-campos">
                <div className="campo"><label>Data do desligamento</label><input name="desligado_em" type="date" defaultValue="" /></div>
                <div className="campo"><label>Tipo</label><select name="desligado_tipo" defaultValue="">{[['', '—'], ...Object.entries(TIPOS_DESLIGAMENTO)].map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              </div>
            </div>
          )}
        </FormEstado>
      </div>

      <div className="painel" style={{ marginTop: 18 }}><h2>Registrar movimentação</h2>
        <FormEstado action={salvarMovimento} botao="Registrar">
          <input type="hidden" name="employee_id" value={e.id} />
          <div className="linha-campos">
            <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="promocao">{Object.entries(TIPOS_MOVIMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Data</label><input name="data" type="date" /></div>
            <div className="campo"><label>Detalhe</label><input name="detalhe" placeholder="ex.: promovido a Sênior" /></div>
            {podeSalario && <div className="campo"><label>Novo valor (salário)</label><input name="valor" type="text" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>}
          </div>
        </FormEstado>
      </div>

      <div className="painel" style={{ marginTop: 18 }}><h2>Histórico</h2>
        {movs.length === 0 ? <Aviso>Sem movimentações registradas.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Detalhe</th>{podeSalario && <th className="num">Valor</th>}<th>Registrado</th></tr></thead>
            <tbody>{movs.map((m) => <tr key={m.id}><td>{fmtData(m.data)}</td><td>{TIPOS_MOVIMENTO[m.tipo]}</td><td>{m.detalhe || '—'}</td>{podeSalario && <td className="num">{m.valor != null ? moeda(m.valor, 0) : '—'}</td>}<td className="suave pequeno">{fmtDataHora(m.created_at)}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
