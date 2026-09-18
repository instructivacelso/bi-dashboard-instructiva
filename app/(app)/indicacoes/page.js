import { exigirUsuario } from '@/lib/auth.js';
import { fmtDataHora } from '@/lib/datas.js';
import { ETAPAS, VALIDACOES, AVISOS, veTodaIndicacao, registraIndicacao, ehDaIndicacao, gereBeneficios } from '@/lib/indicacao.js';
import { listaIndicacoes, vendedoresIndicacao } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Vazio, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const COR_VAL = { valida: 'verde', pendente: 'amarelo', invalida: 'vermelho', duplicada: 'vermelho', telefone_incorreto: 'vermelho', fora_perfil: 'neutro' };

export default async function Indicacoes(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDaIndicacao(u)) return <><Topo titulo="Indicações" /><Aviso tipo="erro">Área do time de Indicação.</Aviso></>;
  const tudo = veTodaIndicacao(u) || registraIndicacao(u);
  const f = { etapa: ETAPAS[sp.etapa] ? sp.etapa : null, validacao: VALIDACOES[sp.validacao] ? sp.validacao : null, vendedor: tudo ? Number(sp.vendedor) || null : null, busca: String(sp.busca || '').trim().slice(0, 80) || null };
  const [lista, vend] = await Promise.all([listaIndicacoes(u, tudo, f), tudo ? vendedoresIndicacao() : []]);
  const pend = lista.filter((r) => r.validacao === 'pendente').length;
  return (
    <>
      <Topo titulo={tudo ? 'Indicações' : 'Minhas indicações'} descricao={`${lista.length} no filtro${pend ? ` · ${pend} aguardando validação` : ''}`}>
        {veTodaIndicacao(u) && <a className="btn sec" href="/indicacoes/dashboard">Dashboard</a>}
        {veTodaIndicacao(u) && <a className="btn sec" href="/indicacoes/campanhas">Campanhas</a>}
        {gereBeneficios(u) && <a className="btn sec" href="/indicacoes/beneficios">Benefícios</a>}
        {registraIndicacao(u) && <a className="btn" href="/indicacoes/registrar">Registrar convite e indicações</a>}
      </Topo>
      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="f-b">Buscar</label><input id="f-b" name="busca" type="search" defaultValue={sp.busca || ''} placeholder="Nome, telefone ou aluno indicador" /></div>
        <div className="campo"><label htmlFor="f-v">Validação</label><select id="f-v" name="validacao" defaultValue={f.validacao || ''}><option value="">Todas</option>{Object.entries(VALIDACOES).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-e">Etapa</label><select id="f-e" name="etapa" defaultValue={f.etapa || ''}><option value="">Todas</option>{Object.entries(ETAPAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        {tudo && <div className="campo"><label htmlFor="f-vd">Vendedor</label><select id="f-vd" name="vendedor" defaultValue={f.vendedor || ''}><option value="">Todos</option>{vend.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>}
        <button className="btn peq" type="submit">Filtrar</button>
      </form>
      {lista.length === 0 ? <Vazio>Nenhuma indicação encontrada.</Vazio> : (
        <div className="painel tabela-wrap"><table>
          <thead><tr><th>Indicado</th><th>Indicador</th><th>Validação</th><th>Aviso</th><th>Etapa</th><th>Vendedor</th><th>Recebida em</th></tr></thead>
          <tbody>{lista.map((r) => (
            <tr key={r.id}>
              <td><a href={`/indicacoes/${r.id}`}><b>{r.nome}</b></a><br /><span className="suave pequeno">{r.telefone || r.telefone_digitado}{r.interesse ? ` · ${r.interesse}` : ''}</span></td>
              <td className="pequeno">{r.indicador}<br /><span className="suave">{r.campanha}</span></td>
              <td><Semaforo cor={COR_VAL[r.validacao]} texto={VALIDACOES[r.validacao]} /></td>
              <td className="pequeno">{r.aviso === 'bloqueado' ? <Semaforo cor="vermelho" texto="Bloqueado" /> : AVISOS[r.aviso]}</td>
              <td className="pequeno">{ETAPAS[r.etapa]}{r.tentativas ? ` · ${r.tentativas} tent.` : ''}</td>
              <td className="pequeno">{r.vendedor || '—'}</td>
              <td className="pequeno suave">{fmtDataHora(r.created_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
