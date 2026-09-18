// Campos de formulário reutilizáveis (server components, sem JavaScript no navegador)

export function Numero({ nome, rotulo, valor, obrig = true, moeda = false, dica }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}{!obrig && <span className="suave"> (opcional)</span>}</label>
      <input
        id={nome} name={nome} type="text" inputMode={moeda ? 'decimal' : 'numeric'}
        defaultValue={valor ?? ''} required={obrig} autoComplete="off"
        placeholder={moeda ? '0,00' : '0'} pattern={moeda ? '[0-9.,]*' : '[0-9]*'}
      />
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function Texto({ nome, rotulo, valor, obrig = false, longo = false, max = 300, dica }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}{!obrig && <span className="suave"> (opcional)</span>}</label>
      {longo
        ? <textarea id={nome} name={nome} defaultValue={valor ?? ''} maxLength={max} />
        : <input id={nome} name={nome} type="text" defaultValue={valor ?? ''} maxLength={max} />}
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function Escolha({ nome, rotulo, opcoes, valor, classe = '', obrig = true, dica }) {
  return (
    <fieldset className={`campo ${classe}`} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="rot" style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{rotulo}</legend>
      <div className="escolha">
        {Object.entries(opcoes).map(([v, r]) => (
          <label key={v}>
            <input type="radio" name={nome} value={v} defaultChecked={valor === v} required={obrig} /> {r}
          </label>
        ))}
      </div>
      {dica && <small className="suave">{dica}</small>}
    </fieldset>
  );
}

export const SIM_NAO = { sim: 'Sim', nao: 'Não' };
export const sn = (b) => (b === true ? 'sim' : b === false ? 'nao' : undefined);

export function Selecao({ nome, rotulo, opcoes, valor, obrig = true, vazio = 'Escolha…', dica }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <select id={nome} name={nome} defaultValue={valor ?? ''} required={obrig}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function DataCampo({ nome, rotulo, valor, obrig = false, dica }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}{!obrig && <span className="suave"> (opcional)</span>}</label>
      <input id={nome} name={nome} type="date" defaultValue={valor ?? ''} required={obrig} />
      {dica && <small>{dica}</small>}
    </div>
  );
}
