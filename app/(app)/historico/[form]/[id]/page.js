import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q1 } from '@/lib/db.js';
import { hoje, fmtData, fmtDataHora } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { FORMULARIOS, ETAPAS_MONITORADAS, TIPOS_ENTREGA, SITUACAO_EDITOR, PRIORIDADE_EDITOR, PLATAFORMAS_LIVE, GARGALOS } from '@/lib/formularios.js';
import { vePainelEmpresa, gerenteDe, podeEditar } from '@/lib/perm.js';
import { lancamentosDoUsuario } from '@/lib/dados.js';
import { Topo, Aviso } from '@/components/Ui.js';

const ROTULOS = {
  plataforma: 'Plataforma', orcamento_dia: 'Orçamento previsto', valor_gasto: 'Valor gasto', impressoes: 'Impressões', cliques: 'Cliques no link',
  visitas: 'Visitas', cadastros: 'Cadastros', tempo_carregamento: 'Tempo de carregamento (s)', houve_problema: 'Houve problema',
  problema_descricao: 'Problema', problema_acao: 'Ação', grupos_ativos: 'Grupos ativos', convites_api: 'Convites enviados',
  convites_entregues: 'Convites entregues', entradas_api: 'Entradas por API', entradas_pagina: 'Entradas pela página',
  entradas_organico: 'Entradas orgânicas', saidas: 'Saídas', total_grupos: 'Total nos grupos', custo_disparos: 'Custo dos disparos',
  tipo_entrega: 'Tipo de entrega', titulo: 'Título', solicitante: 'Solicitante', prioridade: 'Prioridade', quantidade_planejada: 'Quantidade planejada',
  quantidade: 'Quantidade concluída', situacao: 'Status/situação', prazo: 'Prazo', entrega: 'Link', motivo_atraso: 'Motivo do atraso',
  horario_previsto: 'Horário previsto', horario_real: 'Horário real', participantes_unicos: 'Participantes únicos', pessoas_pitch: 'Pessoas no pitch',
  cliques_oferta: 'Cliques na oferta', lista_reserva: 'Lista de reserva', checkouts_iniciados: 'Checkouts iniciados', problema_tecnico: 'Problema técnico',
  observacao: 'Observação', sit_trafego: 'Tráfego', sit_pagina: 'Página e captação', sit_grupos: 'Grupos e WhatsApp', sit_automacao: 'Automações',
  gargalo: 'Principal gargalo', acao: 'Ação', responsavel: 'Responsável',
  ...Object.fromEntries(ETAPAS_MONITORADAS.map((e) => [e.campo, e.rotulo])),
};
const MOEDA = ['orcamento_dia', 'valor_gasto', 'custo_disparos'];
const OCULTAR = ['id', 'launch_id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'data_ref', 'status', 'origem', 'captacao_ok', 'onboarding_ok', 'responsavel_id', 'lancamento', 'autor'];

function valor(k, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return k.endsWith('_ok') ? (v ? 'Funcionando' : 'Com falha') : v ? 'Sim' : 'Não';
  if (MOEDA.includes(k)) return moeda(v);
  if (k === 'prazo') return fmtData(v);
  if (k === 'tipo_entrega') return TIPOS_ENTREGA[v] || v;
  if (k === 'situacao') return SITUACAO_EDITOR[v] || v;
  if (k === 'prioridade') return PRIORIDADE_EDITOR[v] || v;
  if (k === 'gargalo') return GARGALOS[v] || v;
  if (k === 'plataforma') return PLATAFORMAS_LIVE[v] || v;
  return String(v);
}

export default async function VerRegistro(props) {
  const params = await props.params;
  const cfg = FORMULARIOS[params.form];
  if (!cfg) notFound();
  const u = await exigirUsuario();
  const r = await q1(
    `SELECT t.*, l.nome lancamento, c.nome autor ${params.form === 'gerente' ? ', rr.nome responsavel' : ''} FROM ${cfg.tabela} t
       JOIN launches l ON l.id=t.launch_id JOIN users c ON c.id=t.created_by ${params.form === 'gerente' ? 'LEFT JOIN users rr ON rr.id=t.responsavel_id' : ''} WHERE t.id=$1`,
    [Number(params.id)]
  );
  if (!r) notFound();
  const equipe = vePainelEmpresa(u) || gerenteDe(u, 'marketing');
  if (!equipe && r.created_by !== u.id) {
    const meus = await lancamentosDoUsuario(u);
    if (params.form !== 'live' || !meus.some((l) => l.id === r.launch_id)) return <Aviso tipo="erro">Você não pode ver este registro.</Aviso>;
  }
  const perm = podeEditar(u, r, hoje());
  return (
    <>
      <Topo titulo={cfg.titulo} descricao={`${r.lancamento} · ${fmtData(r.data_ref)} · enviado por ${r.autor} em ${fmtDataHora(r.created_at)}${r.updated_by ? ` · alterado em ${fmtDataHora(r.updated_at)}` : ''}`}>
        <a className="btn sec" href="/historico">Voltar</a>
        {perm.pode && <a className="btn" href={`/marketing/${params.form}?registro=${r.id}`}>{perm.correcao ? 'Corrigir' : 'Editar'}</a>}
      </Topo>
      <div className="painel tabela-wrap" style={{ maxWidth: 720 }}>
        <table><tbody>
          {Object.entries(r).filter(([k]) => !OCULTAR.includes(k)).map(([k, v]) => (
            <tr key={k}><td className="suave">{ROTULOS[k] || k}</td><td><b>{valor(k, v)}</b></td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}
