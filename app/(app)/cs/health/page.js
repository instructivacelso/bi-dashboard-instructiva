import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtDataHora } from '@/lib/datas.js';
import { veTodoCs } from '@/lib/cscx.js';
import { regraAtiva } from '@/lib/dadosCs.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { Numero } from '@/components/Campos.js';
import { salvarRegraHealth } from '../actions.js';

export const dynamic = 'force-dynamic';
export default async function Health() {
  const u = await exigirUsuario();
  if (!veTodoCs(u)) return <Aviso tipo="erro">Área do gerente de CS/CX.</Aviso>;
  const [r, versoes] = await Promise.all([regraAtiva(), q('SELECT versao, created_at, ativa FROM cs_health_rules ORDER BY versao DESC LIMIT 10')]);
  const P = r.pesos, L = r.limites;
  return (
    <>
      <Topo titulo="Regra do health score" descricao={`Versão ativa: v${r.versao}. Ao salvar, nasce uma nova versão e todos os alunos são recalculados; as anteriores ficam guardadas.`}><a className="btn sec" href="/cs">Voltar</a></Topo>
      <div className="painel form-claro">
        <FormEstado action={salvarRegraHealth} botao="Salvar nova versão">
          <div className="secao-form"><h3>Pesos (quanto cada item conta)</h3>
            <div className="linha-campos">
              <Numero nome="acesso" rotulo="Acesso recente" valor={P.acesso} /><Numero nome="progresso" rotulo="Progresso no curso" valor={P.progresso} /><Numero nome="satisfacao" rotulo="Satisfação (última pesquisa)" valor={P.satisfacao} />
            </div>
            <div className="linha-campos">
              <Numero nome="reclamacoes" rotulo="Reclamações abertas" valor={P.reclamacoes} /><Numero nome="cancelamento" rotulo="Pedido de cancelamento aberto" valor={P.cancelamento} /><Numero nome="resposta" rotulo="Responde aos contatos" valor={P.resposta} />
            </div>
          </div>
          <div className="secao-form"><h3>Dias sem acesso</h3>
            <div className="linha-campos"><Numero nome="dias_ok" rotulo="Até (ok)" valor={L.dias_ok} /><Numero nome="dias_atencao" rotulo="Até (atenção)" valor={L.dias_atencao} /><Numero nome="dias_risco" rotulo="Até (risco)" valor={L.dias_risco} /></div>
          </div>
          <div className="secao-form"><h3>Faixas (nota de 0 a 100)</h3>
            <div className="linha-campos"><Numero nome="saudavel" rotulo="Saudável a partir de" valor={L.saudavel} /><Numero nome="atencao_faixa" rotulo="Atenção a partir de" valor={L.atencao} /><Numero nome="risco_faixa" rotulo="Risco alto a partir de" valor={L.risco} /></div>
            <small className="suave">Abaixo de “risco alto” o aluno fica como Crítico.</small>
          </div>
        </FormEstado>
      </div>
      <p className="suave pequeno" style={{ marginTop: 12 }}>Versões: {versoes.map((x) => `v${x.versao} (${fmtDataHora(x.created_at)}${x.ativa ? ', ativa' : ''})`).join(' · ')}</p>
    </>
  );
}
