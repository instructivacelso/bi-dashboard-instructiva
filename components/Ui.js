import { fmtData } from '@/lib/datas.js';

export function Topo({ titulo, descricao, children }) {
  return (
    <header className="topo">
      <div>
        <h1>{titulo}</h1>
        {descricao && <p>{descricao}</p>}
      </div>
      {children && <div className="acoes-linha">{children}</div>}
    </header>
  );
}

const ROTULOS = { verde: 'Normal', amarelo: 'Atenção', vermelho: 'Crítico', neutro: 'Sem meta' };
export function Semaforo({ cor, texto }) {
  return <span className={`selo ${cor}`}>{texto || ROTULOS[cor]}</span>;
}

export function StatusTarefa({ concluido }) {
  return concluido ? <span className="selo verde">Concluído</span> : <span className="selo laranja">Pendente</span>;
}

export function Kpi({ rotulo, valor, meta, cor = '', children }) {
  return (
    <div className={`painel kpi ${cor}`}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor}</div>
      {(meta || children) && <div className="meta">{meta}{children}</div>}
    </div>
  );
}

export function Vazio({ children }) {
  return <div className="vazio">{children}</div>;
}

export function Aviso({ tipo = 'info', children }) {
  return <div className={`aviso ${tipo}`}>{children}</div>;
}

export { fmtData };
