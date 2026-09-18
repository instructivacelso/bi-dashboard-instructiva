import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { ehSuperadmin } from '@/lib/perm.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarSetor, criarSubsetor } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function Setores() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u)) return <Aviso tipo="erro">Área restrita ao superadministrador.</Aviso>;
  const [setores, subs] = await Promise.all([q('SELECT * FROM departments ORDER BY ordem'), q('SELECT * FROM subdepartments ORDER BY ordem')]);
  return (
    <>
      <Topo titulo="Setores e formulários" descricao="Ative o módulo do setor quando as métricas estiverem aprovadas. Desative um formulário para que ele deixe de aparecer como pendente." />
      <div className="grade g2">
        {setores.map((s) => {
          const ss = subs.filter((x) => x.department_id === s.id);
          return (
            <div className="painel" key={s.id}>
              <FormEstado action={salvarSetor} botao="Salvar setor">
                <input type="hidden" name="id" value={s.id} />
                <div className="campo"><label htmlFor={`n${s.id}`}>Nome</label><input id={`n${s.id}`} name="nome" type="text" defaultValue={s.nome} /></div>
                <div className="campo"><label htmlFor={`d${s.id}`}>Descrição</label><textarea id={`d${s.id}`} name="descricao" defaultValue={s.descricao || ''} /></div>
                <div className="escolha">
                  <label><input type="checkbox" name="modulo_ativo" defaultChecked={s.modulo_ativo} /> Módulo liberado</label>
                  <label><input type="checkbox" name="ativo" defaultChecked={s.ativo} /> Setor ativo</label>
                </div>
                {ss.length > 0 && (
                  <div className="campo"><span className="rot">Formulários ativos</span>
                    <div className="escolha">{ss.map((x) => <label key={x.id}><input type="checkbox" name={`form_${x.id}`} defaultChecked={x.formulario_ativo} disabled={!x.formulario} /> {x.nome}</label>)}</div>
                  </div>
                )}
              </FormEstado>
              <details className="bloco pequeno" style={{ marginTop: 10 }}>
                <summary>Adicionar subsetor</summary>
                <FormEstado action={criarSubsetor} botao="Criar subsetor">
                  <input type="hidden" name="department_id" value={s.id} />
                  <div className="campo"><label htmlFor={`sn${s.id}`}>Nome</label><input id={`sn${s.id}`} name="nome" type="text" required /></div>
                  <div className="campo"><label htmlFor={`sd${s.id}`}>O que essa atividade faz</label><textarea id={`sd${s.id}`} name="descricao" /></div>
                </FormEstado>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}
