'use client';
import { useState } from 'react';

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (c) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let seq = 1;
const nova = () => ({ k: seq++, produto: '', funil: '', pagamento: '', status: '', valor: '', ident: '' });

// Bloco 9: houve venda? Se sim, linhas de venda com totais em tempo real; se não, motivo.
export default function VendasDia({ produtos, funis, pagamentos, status, motivos, inicial }) {
  const [houve, setHouve] = useState(inicial?.houve ?? null);
  const [linhas, setLinhas] = useState(inicial?.vendas?.length ? inicial.vendas.map((v) => ({ k: seq++, produto: String(v.product_id), funil: v.funil, pagamento: v.forma_pagamento, status: v.status, valor: fmt(Math.round(v.valor * 100)), ident: v.identificador || '' })) : [nova()]);
  const [motivo, setMotivo] = useState(inicial?.motivo || '');
  const up = (k, campo, v) => setLinhas((ls) => ls.map((l) => (l.k === k ? { ...l, [campo]: v } : l)));
  const valorNum = (s) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  const tot = { total: 0, cartao: 0, pix: 0, boleto: 0 };
  linhas.forEach((l) => { const v = valorNum(l.valor); tot.total += v; if (tot[l.pagamento] !== undefined) tot[l.pagamento] += v; });

  return (
    <div className="campo">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>Houve venda hoje?</legend>
        <div className="escolha">
          <label><input type="radio" name="houve_venda" value="sim" checked={houve === 'sim'} onChange={() => setHouve('sim')} required /> Sim</label>
          <label><input type="radio" name="houve_venda" value="nao" checked={houve === 'nao'} onChange={() => setHouve('nao')} /> Não</label>
        </div>
      </fieldset>

      {houve === 'nao' && (
        <div className="campo">
          <label htmlFor="motivo_sem_venda">Principal motivo de não ter vendido</label>
          <select id="motivo_sem_venda" name="motivo_sem_venda" value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
            <option value="">Escolha…</option>
            {Object.entries(motivos).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <small>Vendas e faturamento do dia ficam registrados como zero.</small>
        </div>
      )}

      {houve === 'sim' && (
        <>
          {linhas.map((l, i) => (
            <div key={l.k} className="linha-venda">
              <input type="hidden" name="venda_idx" value={l.k} />
              <div className="linha-venda-topo"><b>Venda {i + 1}</b>{linhas.length > 1 && <button type="button" className="btn sec peq" onClick={() => setLinhas((ls) => ls.filter((x) => x.k !== l.k))}>Remover</button>}</div>
              <div className="linha-campos">
                <div className="campo"><label htmlFor={`v${l.k}_produto`}>Curso vendido</label>
                  <select id={`v${l.k}_produto`} name={`v${l.k}_produto`} value={l.produto} onChange={(e) => up(l.k, 'produto', e.target.value)} required>
                    <option value="">Escolha…</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select></div>
                <div className="campo"><label htmlFor={`v${l.k}_valor`}>Valor</label>
                  <div className="moeda"><span aria-hidden="true">R$</span>
                    <input id={`v${l.k}_valor`} name={`v${l.k}_valor`} type="text" inputMode="numeric" placeholder="0,00" required value={l.valor}
                      onChange={(e) => { const d = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11); up(l.k, 'valor', d ? fmt(Number(d)) : ''); }} />
                  </div></div>
              </div>
              <div className="linha-campos">
                <div className="campo"><label htmlFor={`v${l.k}_funil`}>Origem da venda</label>
                  <select id={`v${l.k}_funil`} name={`v${l.k}_funil`} value={l.funil} onChange={(e) => up(l.k, 'funil', e.target.value)} required>
                    <option value="">Escolha…</option>{Object.entries(funis).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select></div>
                <div className="campo"><label htmlFor={`v${l.k}_pagamento`}>Forma de pagamento</label>
                  <select id={`v${l.k}_pagamento`} name={`v${l.k}_pagamento`} value={l.pagamento} onChange={(e) => up(l.k, 'pagamento', e.target.value)} required>
                    <option value="">Escolha…</option>{Object.entries(pagamentos).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select></div>
                <div className="campo"><label htmlFor={`v${l.k}_status`}>Status</label>
                  <select id={`v${l.k}_status`} name={`v${l.k}_status`} value={l.status} onChange={(e) => up(l.k, 'status', e.target.value)} required>
                    <option value="">Escolha…</option>{Object.entries(status).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select></div>
              </div>
              <div className="campo"><label htmlFor={`v${l.k}_identificador`}>Identificador do pedido (opcional)</label>
                <input id={`v${l.k}_identificador`} name={`v${l.k}_identificador`} type="text" value={l.ident} onChange={(e) => up(l.k, 'ident', e.target.value)} placeholder="Ex.: código do pedido" maxLength={80} /></div>
            </div>
          ))}
          <button type="button" className="btn sec" onClick={() => setLinhas((ls) => [...ls, nova()])}>+ Adicionar outra venda</button>
          <div className="totais-venda" aria-live="polite">
            <div><span>Vendas</span><b>{linhas.length}</b></div>
            <div><span>Cartão</span><b>{brl(tot.cartao)}</b></div>
            <div><span>PIX</span><b>{brl(tot.pix)}</b></div>
            <div><span>Boleto</span><b>{brl(tot.boleto)}</b></div>
            <div className="destaque"><span>Total do dia</span><b>{brl(tot.total)}</b></div>
          </div>
        </>
      )}
    </div>
  );
}
