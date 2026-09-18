// Mini gráfico de linha em SVG (renderizado no servidor, sem biblioteca)
import { fmtData } from '@/lib/datas.js';

export default function Serie({ titulo, pontos, formato, cor = 'var(--grafite)', barras = false }) {
  const W = 320, H = 120, P = { t: 10, r: 8, b: 22, l: 8 };
  const vals = pontos.map((p) => p.v).filter((v) => v !== null && Number.isFinite(v));
  const max = vals.length ? Math.max(...vals) : 0;
  const n = pontos.length;
  const x = (i) => P.l + (n <= 1 ? 0 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v) => H - P.b - (max ? (v / max) * (H - P.t - P.b) : 0);
  let d = '';
  let caneta = false;
  pontos.forEach((p, i) => {
    if (p.v === null || !Number.isFinite(p.v)) { caneta = false; return; }
    d += `${caneta ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)} `;
    caneta = true;
  });
  const bw = Math.max(2, (W - P.l - P.r) / Math.max(n, 1) - 2);
  const ult = [...pontos].reverse().find((p) => p.v !== null && Number.isFinite(p.v));
  return (
    <figure className="painel grafico" style={{ margin: 0 }}>
      <div className="painel-cab" style={{ marginBottom: 4 }}>
        <h3>{titulo}</h3>
        <span className="pequeno suave">máx. {vals.length ? formato(max) : 'sem dados'}</span>
      </div>
      {vals.length === 0 ? <p className="suave pequeno">Sem dados no período.</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: último valor ${ult ? formato(ult.v) : 'sem dados'}`}>
          <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="#dfe1e5" />
          {barras
            ? pontos.map((p, i) => (p.v ? <rect key={i} x={x(i) - bw / 2} y={y(p.v)} width={bw} height={H - P.b - y(p.v)} fill={cor} rx="1.5" /> : null))
            : <path d={d} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
          {!barras && pontos.map((p, i) => (p.v !== null && Number.isFinite(p.v) && n <= 31 ? <circle key={i} cx={x(i)} cy={y(p.v)} r="2.4" fill={cor} /> : null))}
          <text x={P.l} y={H - 6} fontSize="10" fill="#62656c">{fmtData(pontos[0]?.data).slice(0, 5)}</text>
          <text x={W - P.r} y={H - 6} fontSize="10" fill="#62656c" textAnchor="end">{fmtData(pontos[n - 1]?.data).slice(0, 5)}</text>
        </svg>
      )}
    </figure>
  );
}
