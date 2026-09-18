'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Alterna modo claro/escuro e guarda a escolha neste navegador
export default function BotaoTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => { setEscuro(document.documentElement.dataset.tema === 'escuro'); }, []);
  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    if (novo) document.documentElement.dataset.tema = 'escuro';
    else delete document.documentElement.dataset.tema;
    try { localStorage.setItem('tema', novo ? 'escuro' : 'claro'); } catch {}
  }
  return (
    <button type="button" className="botao-tema" onClick={alternar} aria-label={escuro ? 'Usar modo claro' : 'Usar modo escuro'} title={escuro ? 'Modo claro' : 'Modo escuro'}>
      {escuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
