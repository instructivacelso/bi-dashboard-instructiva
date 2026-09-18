import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtData } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { operaRh, veSalario, VINCULOS, MODALIDADES, STATUS_COLAB, STATUS_FECHAMENTO_RH } from '@/lib/rh.js';
import { listaColaboradores, cargosAtivos } from '@/lib/dadosRh.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarColaborador } from '../actions.js';

export const dynamic = 'force-dynamic';

export async function CamposColaborador({ e = {}, cargos, setores, gestores, podeSalario }) {
  const opt = (o) => Object.entries(o).map(([v, r]) => <option key={v} value={v}>{r}</option>);
  return (
    <>
      <div className="linha-campos">
        <div className="campo"><label>Nome</label><input name="nome" defaultValue={e.nome} required /></div>
        <div className="campo"><label>Matrícula</label><input name="matricula" defaultValue={e.matricula || ''} /></div>
        <div className="campo"><label>Unidade</label><input name="unidade" defaultValue={e.unidade || ''} /></div>
        <div className="campo"><label>Cidade</label><input name="cidade" defaultValue={e.cidade || ''} /></div>
      </div>
      <div className="linha-campos">
        <div className="campo"><label>Setor</label><select name="department_id" defaultValue={e.department_id || ''}><option value="">—</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
        <div className="campo"><label>Cargo</label><select name="position_id" defaultValue={e.position_id || ''}><option value="">—</option>{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div className="campo"><label>Gestor</label><select name="gestor_id" defaultValue={e.gestor_id || ''}><option value="">—</option>{gestores.filter((g) => g.id !== e.id).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></div>
      </div>
      <div className="linha-campos">
        <div className="campo"><label>Admissão</label><input name="admissao" type="date" defaultValue={e.admissao ? String(e.admissao).slice(0, 10) : ''} /></div>
        <div className="campo"><label>Vínculo</label><select name="vinculo" defaultValue={e.vinculo || 'clt'}>{opt(VINCULOS)}</select></div>
        <div className="campo"><label>Modalidade</label><select name="modalidade" defaultValue={e.modalidade || 'presencial'}>{opt(MODALIDADES)}</select></div>
        <div className="campo"><label>Jornada</label><input name="jornada" defaultValue={e.jornada || ''} placeholder="44h/semana" /></div>
      </div>
      <div className="linha-campos">
        <div className="campo"><label>Centro de custo</label><input name="centro_custo" defaultValue={e.centro_custo || ''} /></div>
        <div className="campo"><label>Fim da experiência</label><input name="experiencia_fim" type="date" defaultValue={e.experiencia_fim ? String(e.experiencia_fim).slice(0, 10) : ''} /></div>
        <div className="campo"><label>Fim do contrato</label><input name="contrato_fim" type="date" defaultValue={e.contrato_fim ? String(e.contrato_fim).slice(0, 10) : ''} /></div>
        {podeSalario && <div className="campo"><label>Salário</label><input name="salario" type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={e.salario ?? ''} placeholder="0,00" /></div>}
      </div>
      <div className="linha-campos">
        <div className="campo"><label>Status</label><select name="status" defaultValue={e.status || 'ativo'}>{opt(STATUS_COLAB)}</select></div>
        <div className="campo"><label>Observação</label><input name="observacao" defaultValue={e.observacao || ''} /></div>
      </div>
    </>
  );
}

export default async function Colaboradores(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!operaRh(u)) return <><Topo titulo="Colaboradores" /><Aviso tipo="erro">Área da equipe de RH.</Aviso></>;
  const status = STATUS_COLAB[sp.status] ? sp.status : null;
  const [lista, cargos, setores, gestores] = await Promise.all([
    listaColaboradores({ status }), cargosAtivos(),
    q('SELECT id, nome FROM departments WHERE modulo_ativo OR slug=$1 ORDER BY ordem', ['rh']),
    q("SELECT id, nome FROM hr_employees WHERE status<>'desligado' ORDER BY nome"),
  ]);
  const podeSalario = veSalario(u);

  return (
    <>
      <Topo titulo="Colaboradores" descricao={`${lista.length} pessoa(s)${status ? ` · ${STATUS_COLAB[status]}` : ''}`}>
        <a className={`btn sec peq ${!status ? 'ativo' : ''}`} href="/rh/colaboradores">Todos</a>
        <a className="btn sec peq" href="/rh/colaboradores?status=ativo">Ativos</a>
        <a className="btn sec peq" href="/rh/colaboradores?status=desligado">Desligados</a>
        <a className="btn sec" href="/rh">Painel</a>
      </Topo>

      <div className="painel"><h2>Novo colaborador</h2>
        <FormEstado action={salvarColaborador} botao="Cadastrar colaborador">
          <CamposColaborador cargos={cargos} setores={setores} gestores={gestores} podeSalario={podeSalario} />
        </FormEstado>
        {!podeSalario && <p className="suave pequeno">O salário é restrito ao gerente de RH e à diretoria.</p>}
      </div>

      <div className="painel" style={{ marginTop: 18 }}>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>Cargo</th><th>Setor</th><th>Gestor</th><th>Admissão</th><th>Status</th>{podeSalario && <th className="num">Salário</th>}<th /></tr></thead>
          <tbody>
            {lista.length === 0 ? <tr><td colSpan={8}><Aviso>Nenhum colaborador ainda. Cadastre acima.</Aviso></td></tr> : lista.map((e) => (
              <tr key={e.id}>
                <td>{e.nome}</td><td>{e.cargo || '—'}</td><td>{e.setor || '—'}</td><td>{e.gestor || '—'}</td><td>{e.admissao ? fmtData(e.admissao) : '—'}</td>
                <td><Semaforo cor={e.status === 'ativo' ? 'verde' : e.status === 'desligado' ? 'vermelho' : 'amarelo'} texto={STATUS_COLAB[e.status]} /></td>
                {podeSalario && <td className="num">{e.salario != null ? moeda(e.salario, 0) : '—'}</td>}
                <td><a className="btn sec peq" href={`/rh/colaboradores/${e.id}`}>Abrir</a></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
