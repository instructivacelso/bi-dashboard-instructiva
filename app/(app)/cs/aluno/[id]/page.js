import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtData, fmtDataHora, hoje } from '@/lib/datas.js';
import { moeda } from '@/lib/formato.js';
import { FAIXAS, COR_FAIXA, MATRICULA, TIPOS_REGISTRO, SUBTIPOS, STATUS_POR_TIPO, CANAIS, ETAPAS_JORNADA, SETORES, GRAVIDADE, veTodoCs, ehDoCs } from '@/lib/cscx.js';
import { alunoCompleto, equipeCs } from '@/lib/dadosCs.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Condicionais from '@/components/Condicionais.js';
import InputMoeda from '@/components/InputMoeda.js';
import { Numero, Texto, Selecao, DataCampo } from '@/components/Campos.js';
import { salvarAlunoCs, registrarCs, atualizarRegistroCs } from '../../actions.js';

export const dynamic = 'force-dynamic';
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const Check = ({ nome, rotulo, v }) => <label><input type="checkbox" name={nome} defaultChecked={!!v} /> {rotulo}</label>;

export default async function AlunoCs(props) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDoCs(u)) return <Aviso tipo="erro">Área da equipe de CS/CX.</Aviso>;
  const novo = id === 'novo';
  const a = novo ? null : await alunoCompleto(Number(id));
  if (!novo && !a) notFound();
  if (a && !veTodoCs(u) && a.responsavel_id !== u.id) return <Aviso tipo="erro">Este aluno é da carteira de outro colaborador.</Aviso>;
  const [produtos, equipe] = await Promise.all([q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'), veTodoCs(u) ? equipeCs() : []]);
  const v = a || { compra_em: hoje(), progresso: 0, matricula: 'ativa' };
  return (
    <>
      <Topo titulo={novo ? 'Adicionar aluno à carteira' : a.nome} descricao={novo ? 'Se o aluno já existir (mesmo e-mail ou telefone), a ficha é ligada ao cadastro dele.' : `${a.email || a.telefone} · ${a.produto || 'sem curso'} · responsável ${a.responsavel || '—'}`}>
        <a className="btn sec" href="/cs">Voltar</a>
      </Topo>
      {sp.criado && <Aviso tipo="ok">Aluno adicionado. Agora registre os contatos e acompanhamentos abaixo.</Aviso>}
      {a && (
        <section className="grade g4" style={{ marginBottom: 16 }}>
          <div className="painel kpi"><div className="rot">Health score</div><div className="val">{a.health_score ?? '—'}</div><div className="meta">{a.faixa && <Semaforo cor={COR_FAIXA[a.faixa]} texto={FAIXAS[a.faixa]} />} regra v{a.regra_versao}</div></div>
          <div className="painel kpi"><div className="rot">Progresso</div><div className="val">{a.progresso}%</div><div className="barrinha"><i style={{ width: `${a.progresso}%` }} /></div></div>
          <div className="painel kpi"><div className="rot">Último acesso</div><div className="val" style={{ fontSize: '1.3rem' }}>{a.ultimo_acesso ? fmtData(a.ultimo_acesso) : 'nunca'}</div></div>
          <div className="painel kpi"><div className="rot">Contrato</div><div className="val" style={{ fontSize: '1.3rem' }}>{moeda(Number(a.valor_contrato), 0)}</div><div className="meta">{MATRICULA[a.matricula]} · compra {fmtData(a.compra_em)}</div></div>
        </section>
      )}
      <div className={a ? 'grade g2' : ''} style={{ alignItems: 'start' }}>
        <div className="painel form-claro">
          <h2 style={{ marginBottom: 12 }}>Ficha do aluno</h2>
          <FormEstado action={salvarAlunoCs} botao={novo ? 'Adicionar à carteira' : 'Salvar ficha'} botaoEnviando="Salvando…">
            {a && <input type="hidden" name="id" value={a.id} />}
            {novo && <div className="linha-campos"><Texto nome="aluno_nome" rotulo="Nome" obrig /><Texto nome="aluno_contato" rotulo="E-mail ou telefone" obrig /></div>}
            <div className="linha-campos"><Selecao nome="product_id" rotulo="Curso" valor={v.product_id} opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))} /><Texto nome="turma" rotulo="Turma" valor={v.turma} max={80} /></div>
            <div className="linha-campos"><DataCampo nome="compra_em" rotulo="Data da compra" valor={v.compra_em} obrig /><div className="campo"><label htmlFor="valor_contrato">Valor do contrato</label><InputMoeda id="valor_contrato" name="valor_contrato" valorInicial={v.valor_contrato ?? 0} /></div></div>
            <Selecao nome="matricula" rotulo="Matrícula" valor={v.matricula} opcoes={opc(MATRICULA)} />
            {equipe.length > 0 && <Selecao nome="responsavel_id" rotulo="Responsável (carteira)" valor={v.responsavel_id || u.id} opcoes={equipe.map((x) => ({ valor: x.id, rotulo: x.nome }))} />}
            <div className="campo"><span className="rot">Onboarding</span>
              <div className="escolha"><Check nome="boas_vindas" rotulo="Recebeu boas-vindas" v={v.boas_vindas} /><Check nome="entrou_grupo" rotulo="Entrou no grupo" v={v.entrou_grupo} /><Check nome="orientado" rotulo="Recebeu orientação" v={v.orientado} /><Check nome="iniciou_curso" rotulo="Iniciou o curso" v={v.iniciou_curso} /></div></div>
            <div className="linha-campos"><DataCampo nome="acesso_liberado_em" rotulo="Acesso liberado em" valor={v.acesso_liberado_em} /><DataCampo nome="primeiro_acesso_em" rotulo="Primeiro acesso" valor={v.primeiro_acesso_em} /></div>
            <div className="linha-campos"><DataCampo nome="ultimo_acesso" rotulo="Último acesso" valor={v.ultimo_acesso} /><Numero nome="progresso" rotulo="Progresso no curso (%)" valor={v.progresso} /></div>
          </FormEstado>
        </div>
        {a && (
          <div>
            <div className="painel form-claro">
              <h2 style={{ marginBottom: 12 }}>Novo registro</h2>
              <FormEstado action={registrarCs} botao="Salvar registro" botaoEnviando="Salvando…" protegerSaida>
                <input type="hidden" name="cs_aluno_id" value={a.id} />
                <Condicionais />
                <Selecao nome="tipo" rotulo="O que aconteceu?" opcoes={opc(TIPOS_REGISTRO)} />
                {Object.keys(SUBTIPOS).map((t) => (
                  <div key={t} data-se={`tipo:${t}`}>
                    <div className="linha-campos"><Selecao nome={`subtipo_${t}`} rotulo="Qual" opcoes={opc(SUBTIPOS[t])} /><Selecao nome={`status_${t}`} rotulo="Situação" opcoes={opc(STATUS_POR_TIPO[t])} valor={t === 'pesquisa' ? 'respondida' : undefined} /></div>
                    {t === 'contato' && <Selecao nome="canal" rotulo="Canal" opcoes={opc(CANAIS)} />}
                    {t === 'pesquisa' && <div className="linha-campos"><Numero nome="nota" rotulo="Nota" dica="NPS de 0 a 10; CSAT e CES de 1 a 5." /><Selecao nome="etapa_pesquisa" rotulo="Etapa avaliada" opcoes={opc(ETAPAS_JORNADA)} /></div>}
                    {t === 'voz' && <>
                      <div className="linha-campos"><Selecao nome="etapa_voz" rotulo="Etapa da jornada" opcoes={opc(ETAPAS_JORNADA)} /><Selecao nome="gravidade" rotulo="Gravidade" opcoes={opc(GRAVIDADE)} valor="normal" /></div>
                      <Selecao nome="setor_voz" rotulo="Setor para encaminhar" opcoes={opc(SETORES)} />
                      <label className="escolha"><span style={{ display: 'inline-flex', gap: 8 }}><input type="checkbox" name="voz_cliente" /> Marcar como Voz do Cliente (relato importante)</span></label>
                    </>}
                    {t === 'cancelamento' && <>
                      <Texto nome="motivo_cancelamento" rotulo="Motivo informado pelo aluno" obrig max={200} />
                      <div className="campo"><label htmlFor="valor_cancelamento">Valor do contrato em jogo</label><InputMoeda id="valor_cancelamento" name="valor_cancelamento" valorInicial={a.valor_contrato} /></div>
                      <div data-se="status_cancelamento:em_retencao|recuperado"><Texto nome="estrategia" rotulo="Estratégia de retenção" obrig /></div>
                    </>}
                    {t === 'oportunidade' && <>
                      <Selecao nome="setor_oport" rotulo="Encaminhar para" opcoes={[{ valor: 'indicacoes', rotulo: 'Indicações' }, { valor: 'comercial', rotulo: 'Comercial' }]} />
                      <div data-se="status_oportunidade:convertida"><div className="campo"><label htmlFor="valor_oport">Valor da venda</label><InputMoeda id="valor_oport" name="valor_oport" /></div></div>
                    </>}
                  </div>
                ))}
                <Texto nome="descricao" rotulo="Descrição" obrig longo max={1000} dica="O que foi conversado, o que o aluno disse ou o que foi combinado." />
              </FormEstado>
            </div>
            <div className="painel" style={{ marginTop: 16 }}>
              <div className="painel-cab"><h2>Linha do tempo</h2></div>
              {a.registros.length === 0 ? <p className="suave">Nenhum registro ainda.</p> : (
                <ol className="linha-tempo">{a.registros.map((r) => (
                  <li key={r.id}><b>{SUBTIPOS[r.tipo][r.subtipo]}</b>{r.nota !== null ? ` · nota ${r.nota}` : ''}{r.gravidade === 'grave' ? ' · grave' : ''}{r.voz_cliente ? ' · Voz do Cliente' : ''}
                    <br /><span className="pequeno">{r.descricao}</span><br />
                    <span className="suave pequeno">{fmtDataHora(r.created_at)} · {r.autor}</span>
                    {['voz', 'cancelamento', 'oportunidade'].includes(r.tipo) && (
                      <form action={atualizarRegistroCs} className="acoes-linha" style={{ marginTop: 6 }}><input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} aria-label="Situação" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>{Object.entries(STATUS_POR_TIPO[r.tipo]).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
                        <button className="btn sec peq">Atualizar</button></form>
                    )}</li>
                ))}</ol>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
