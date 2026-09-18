import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { RESPOSTAS_CONVITE, registraIndicacao } from '@/lib/indicacao.js';
import { campanhasAtivas } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Vazio } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import { Numero, Texto, Escolha, Selecao } from '@/components/Campos.js';
import { registrarIndicacoes } from '../actions.js';

export const dynamic = 'force-dynamic';
export default async function Registrar() {
  const u = await exigirUsuario();
  if (!registraIndicacao(u)) return <Aviso tipo="erro">Seu perfil não registra indicações.</Aviso>;
  const [camps, produtos] = await Promise.all([campanhasAtivas(), q('SELECT id, nome FROM products WHERE ativo ORDER BY nome')]);
  if (!camps.length) return <><Topo titulo="Registrar convite e indicações" /><Vazio>Nenhuma campanha ativa. O gerente cadastra em Indicações → Campanhas.</Vazio></>;
  return (
    <>
      <Topo titulo="Registrar convite e indicações" descricao="Registre o convite feito ao aluno e, se ele aceitou, os contatos que indicou. Telefones repetidos são marcados como duplicados automaticamente.">
        <a className="btn sec" href="/indicacoes">Voltar</a>
      </Topo>
      <div className="painel form-claro">
        <FormEstado action={registrarIndicacoes} botao="Registrar" botaoEnviando="Registrando…" protegerSaida progresso>
          <Condicionais />
          <div className="secao-form"><h3>Aluno convidado</h3>
            <Selecao nome="campaign_id" rotulo="Campanha" opcoes={camps.map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${c.qtd_por_beneficio} válidas = ${c.beneficio_descricao}` }))} valor={camps.length === 1 ? camps[0].id : undefined} />
            <div className="linha-campos">
              <Texto nome="aluno_nome" rotulo="Nome do aluno" obrig />
              <Texto nome="aluno_contato" rotulo="E-mail ou telefone do aluno" obrig />
            </div>
            <Escolha nome="resposta" rotulo="Resposta ao convite" opcoes={RESPOSTAS_CONVITE} />
          </div>
          <div className="secao-form" data-se="resposta:aceitou"><h3>Contatos indicados</h3>
            <Numero nome="qtd" rotulo="Quantos contatos o aluno indicou?" dica="Oriente o aluno a avisar cada contato antes da abordagem." />
            <ListaQtd campoQtd="qtd" prefixo="ind" titulo="Contato"
              campos={[{ nome: 'nome', rotulo: 'Nome' }, { nome: 'telefone', rotulo: 'Telefone com DDD', tipo: 'telefone' },
                { nome: 'aviso', rotulo: 'O contato foi avisado?', tipo: 'opcao', opcoes: { avisado: 'Aluno avisou', nao_confirmado: 'Não confirmado', autorizado: 'Contato autorizou' } },
                { nome: 'interesse', rotulo: 'Curso de interesse', tipo: 'opcao', opcional: true, opcoes: Object.fromEntries(produtos.map((p) => [p.id, p.nome])) }]} />
          </div>
        </FormEstado>
      </div>
    </>
  );
}
