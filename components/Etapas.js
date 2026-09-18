'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Mostra uma seção (.secao-form) por vez, com Voltar / Próximo.
// Confere os campos da etapa antes de avançar. O botão de enviar aparece só na última etapa.
export default function Etapas() {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const [titulos, setTitulos] = useState([]);
  const [alvo, setAlvo] = useState(null);

  const secoes = () => [...(ref.current?.closest('form')?.querySelectorAll('.secao-form') || [])];

  useEffect(() => {
    const f = ref.current.closest('form');
    setTitulos(secoes().map((s) => s.querySelector('h3')?.textContent || ''));
    setAlvo(f.querySelector('.rodape-fixo .acoes-linha'));
    // Enter não envia antes da hora: vai para a próxima etapa
    const tecla = (e) => {
      if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit') return;
      if (f.dataset.ultima !== 'sim') { e.preventDefault(); document.getElementById('etapa-proxima')?.click(); }
    };
    f.addEventListener('keydown', tecla);
    return () => f.removeEventListener('keydown', tecla);
  }, []);

  useEffect(() => {
    const f = ref.current.closest('form');
    const ss = secoes();
    ss.forEach((s, k) => s.classList.toggle('etapa-oculta', k !== i));
    f.dataset.ultima = i === ss.length - 1 ? 'sim' : 'nao';
  }, [i, titulos.length]);

  function valida() {
    const sec = secoes()[i];
    if (!sec) return true;
    for (const el of sec.querySelectorAll('input, select, textarea')) {
      if (el.disabled || el.type === 'hidden') continue;
      const cond = el.closest('.condicional');
      const visivelCond = cond && getComputedStyle(cond).display !== 'none';
      el.setCustomValidity('');
      if (visivelCond && !el.required && el.type !== 'radio' && String(el.value).trim() === '') el.setCustomValidity('Preencha este campo.');
      if (visivelCond && el.type === 'radio' && !sec.querySelector(`input[name="${CSS.escape(el.name)}"]:checked`)) el.setCustomValidity('Escolha uma opção.');
      if (!el.checkValidity()) {
        el.reportValidity();
        el.addEventListener('input', () => el.setCustomValidity(''), { once: true });
        el.addEventListener('change', () => el.setCustomValidity(''), { once: true });
        return false;
      }
    }
    return true;
  }
  const irPara = (n) => { setI(n); ref.current?.closest('.painel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const total = titulos.length;
  if (total <= 1) return <div ref={ref} />;

  return (
    <div ref={ref} className="etapas">
      <div className="etapas-trilha" aria-label={`Etapa ${i + 1} de ${total}`}>
        {titulos.map((t, k) => (
          <button key={k} type="button" className={`etapa-ponto ${k === i ? 'atual' : k < i ? 'feita' : ''}`}
            onClick={() => (k < i || valida()) && irPara(k)} aria-current={k === i ? 'step' : undefined} title={t}>
            <span>{k + 1}</span>
          </button>
        ))}
      </div>
      <p className="etapas-legenda">Etapa {i + 1} de {total}</p>
      {alvo && createPortal(
        <>
          {i > 0 && <button type="button" className="btn sec" onClick={() => irPara(i - 1)}>Voltar</button>}
          {i < total - 1 && <button id="etapa-proxima" type="button" className="btn" onClick={() => valida() && irPara(i + 1)}>Próximo</button>}
        </>,
        alvo
      )}
    </div>
  );
}
