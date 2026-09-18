'use client';
import { useEffect, useState } from 'react';

export default function Relogio() {
  const [agora, setAgora] = useState(null);
  useEffect(() => { setAgora(new Date()); const t = setInterval(() => setAgora(new Date()), 1000 * 15); return () => clearInterval(t); }, []);
  if (!agora) return <div className="tv-relogio" />;
  const f = (o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(agora);
  return (
    <div className="tv-relogio">
      <b>{f({ hour: '2-digit', minute: '2-digit' })}</b>
      <span>{f({ weekday: 'long', day: '2-digit', month: 'long' })}</span>
    </div>
  );
}
