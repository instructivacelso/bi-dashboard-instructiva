import { usuarioAtual } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { historico, lancamentosVisiveis } from '@/lib/dados.js';
import { FORMULARIOS } from '@/lib/formularios.js';
import { hoje, somarDias } from '@/lib/datas.js';
import { vePainelEmpresa, veDashboardSetor, ehSuperadmin } from '@/lib/perm.js';

export const dynamic = 'force-dynamic';

// CSV com ";" e BOM: abre corretamente no Excel em português
function csv(linhas) {
  if (!linhas.length) return '\ufeffsem dados\n';
  const cols = Object.keys(linhas[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    if (v instanceof Date) return v.toISOString();
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\ufeff' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\n');
}

const ok = (nome, conteudo) => new Response(conteudo, {
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}-${hoje()}.csv"` },
});
const negado = () => new Response('Acesso negado', { status: 403 });
const dataOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

export async function GET(req, { params }) {
  const u = await usuarioAtual();
  if (!u) return new Response('Faça login', { status: 401 });
  const sp = new URL(req.url).searchParams;

  if (params.tipo === 'marketing') {
    if (!veDashboardSetor(u, 'marketing')) return negado();
    const ate = dataOk(sp.get('ate')) || hoje();
    const desde = dataOk(sp.get('desde')) || somarDias(ate, -29);
    let ids = (await lancamentosVisiveis(u)).map((l) => l.id);
    if (sp.get('lancamento')) ids = ids.filter((i) => i === Number(sp.get('lancamento')));
    const linhas = await q(
      `SELECT l.nome lancamento, t.data_ref, u.nome responsavel, t.valor_gasto, t.visitas, t.cadastros,
              CASE WHEN t.cadastros > 0 THEN ROUND(t.valor_gasto / t.cadastros, 2) END cpl,
              w.entradas_api, w.entradas_organico, w.total_grupos, t.houve_problema, t.problema_descricao
         FROM traffic_daily_entries t JOIN launches l ON l.id=t.launch_id JOIN users u ON u.id=t.created_by
         LEFT JOIN LATERAL (SELECT SUM(entradas_api) entradas_api, SUM(entradas_organico) entradas_organico, MAX(total_grupos) total_grupos
                              FROM whatsapp_daily_entries WHERE launch_id=t.launch_id AND data_ref=t.data_ref) w ON true
        WHERE t.data_ref BETWEEN $1 AND $2 AND t.launch_id = ANY($3) ORDER BY t.data_ref, l.nome`,
      [desde, ate, ids]
    );
    return ok('marketing', csv(linhas));
  }
  if (params.tipo === 'historico') {
    if (!vePainelEmpresa(u)) return negado();
    const form = FORMULARIOS[sp.get('form')] ? sp.get('form') : null;
    return ok('historico', csv(await historico({ form, limite: 5000 })));
  }
  if (params.tipo === 'usuarios') {
    if (!ehSuperadmin(u)) return negado();
    return ok('usuarios', csv(await q(`SELECT u.nome, u.email, u.cargo, r.nome perfil, u.ativo, u.ultimo_login FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.nome`)));
  }
  if (params.tipo === 'auditoria') {
    if (!vePainelEmpresa(u)) return negado();
    return ok('auditoria', csv(await q(`SELECT a.created_at quando, u.nome quem, a.acao, a.entidade, a.entidade_id, a.antes, a.depois FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 20000`)));
  }
  return new Response('Tipo desconhecido', { status: 404 });
}
