'use client';
import { useState } from 'react';

// Seleção múltipla de cursos com busca (só produtos ativos)
export default function ProdutosSelect({ produtos, selecionados = [], nome = 'produtos' }) {
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState(new Set(selecionados.map(Number)));
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtrados = produtos.filter((p) => norm(p.nome).includes(norm(busca)));
  const alternar = (id) => { const n = new Set(marcados); n.has(id) ? n.delete(id) : n.add(id); setMarcados(n); };
  if (!produtos.length) return <div className="aviso erro">Nenhum curso cadastrado. Peça ao administrador para cadastrar os cursos em Lançamentos → Produtos.</div>;
  return (
    <div className="campo">
      <input type="search" placeholder="Pesquisar curso…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar curso" />
      <div className="lista-marcar" data-grupo-obrigatorio="Cursos trabalhados">
        {filtrados.map((p) => (
          <label key={p.id} className={marcados.has(p.id) ? 'on' : ''}>
            <input type="checkbox" name={nome} value={p.id} checked={marcados.has(p.id)} onChange={() => alternar(p.id)} /> {p.nome}
          </label>
        ))}
        {/* mantém enviados os marcados que a busca escondeu */}
        {[...marcados].filter((id) => !filtrados.some((p) => p.id === id)).map((id) => <input key={id} type="hidden" name={nome} value={id} />)}
        {!filtrados.length && <span className="suave pequeno">Nenhum curso encontrado.</span>}
      </div>
      <small>{marcados.size ? `${marcados.size} ${marcados.size === 1 ? 'curso marcado' : 'cursos marcados'}` : 'Marque os cursos que você trabalhou hoje.'}</small>
    </div>
  );
}
