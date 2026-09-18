import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descricaoValida, limitesSla, situacaoSla, dentroSla, indicadoresSuporte, backlogFinal, veTodoSuporte, ehDoSuporte } from '../lib/suporte.js';
import { lerTicket, normalizarContato, lerFechamentoSuporte } from '../lib/leitoresSuporte.js';

const fd = (o) => ({ get: (k) => (Array.isArray(o[k]) ? o[k][0] : o[k] ?? null), getAll: (k) => (o[k] === undefined ? [] : Array.isArray(o[k]) ? o[k] : [o[k]]) });
const base = { aluno_nome: 'Maria', aluno_contato: '(45) 99999-1234', produto: 'geral', canal: 'whatsapp', categoria: 'acesso',
  descricao: 'Não consegue entrar na plataforma desde ontem', prioridade: 'alta', status: 'em_atendimento', acao_realizada: 'Reenviei o acesso e testei o login',
  encaminhamento: 'suporte', proxima_acao: 'Confirmar acesso', prox_responsavel: 'Ana', prox_prazo: '2026-09-19', prox_contato: '2026-09-19' };

test('descrição genérica é recusada', () => {
  assert.equal(descricaoValida('aluno com problema'), false);
  assert.equal(descricaoValida('erro'), false);
  assert.equal(descricaoValida('Vídeo da aula 3 do módulo 2 não carrega'), true);
});

test('contato do aluno é normalizado', () => {
  assert.deepEqual(normalizarContato('(45) 99999-1234'), { email: null, telefone: '+5545999991234' });
  assert.deepEqual(normalizarContato('Maria@Email.com'), { email: 'maria@email.com', telefone: null });
  assert.throws(() => normalizarContato('123'), /Telefone/);
});

test('ticket: pendente exige próxima ação; resolvido exige solução', () => {
  const ctx = { produtosAtivos: [1], statusAnterior: null };
  assert.doesNotThrow(() => lerTicket(fd(base), ctx));
  assert.throws(() => lerTicket(fd({ ...base, proxima_acao: '' }), ctx), /Próxima ação/);
  assert.throws(() => lerTicket(fd({ ...base, status: 'resolvido' }), ctx), /Solução/);
  assert.doesNotThrow(() => lerTicket(fd({ ...base, status: 'resolvido', solucao: 'Acesso liberado', aluno_confirmou: 'sim' }), ctx));
});

test('ticket: encaminhado exige destino, motivo e prazo; aguardando setor exige encaminhamento', () => {
  const ctx = { produtosAtivos: [], statusAnterior: null };
  assert.throws(() => lerTicket(fd({ ...base, encaminhamento: 'financeiro' }), ctx), /destino/);
  const r = lerTicket(fd({ ...base, encaminhamento: 'financeiro', enc_responsavel: 'Carla', enc_motivo: 'Boleto', enc_prazo: '2026-09-19T15:00' }), ctx);
  assert.equal(r.dados.enc_prazo, '2026-09-19T15:00:00-03:00');
  assert.throws(() => lerTicket(fd({ ...base, status: 'aguardando_setor' }), ctx), /setor/);
});

test('ticket: reabrir só caso finalizado e com motivo', () => {
  assert.throws(() => lerTicket(fd({ ...base, status: 'reaberto' }), { produtosAtivos: [], statusAnterior: 'em_atendimento' }), /reabrir/);
  assert.throws(() => lerTicket(fd({ ...base, status: 'reaberto' }), { produtosAtivos: [], statusAnterior: 'resolvido' }), /Motivo/);
  assert.throws(() => lerTicket(fd({ ...base, status: 'em_atendimento' }), { produtosAtivos: [], statusAnterior: 'resolvido' }), /Reaberto/);
});

test('SLA: vencido, no prazo e cumprimento', () => {
  const aberto = new Date('2026-09-18T12:00:00Z');
  const lim = limitesSla(aberto, { resposta_min: 60, solucao_horas: 24 });
  const t = { status: 'em_atendimento', aberto_em: aberto, primeira_resposta_em: aberto, sla_resposta_limite: lim.resposta, sla_solucao_limite: lim.solucao };
  assert.equal(situacaoSla(t, new Date('2026-09-18T14:00:00Z')), 'ok');
  assert.equal(situacaoSla(t, new Date('2026-09-19T13:00:00Z')), 'vencido');
  assert.equal(situacaoSla({ ...t, primeira_resposta_em: null }, new Date('2026-09-18T13:30:00Z')), 'vencido');
  assert.equal(dentroSla({ ...t, resolvido_em: new Date('2026-09-18T20:00:00Z') }), true);
  const i = indicadoresSuporte({ trabalhados: 10, resolvidos: 8, reabertos: 2, concluidos: 8, dentroPrazo: 6, encaminhados: 1, positivas: 3, negativas: 1 });
  assert.equal(i.taxaResolucao, 0.8); assert.equal(i.taxaReabertura, 0.25); assert.equal(i.cumprimentoSla, 0.75); assert.equal(i.satisfacaoPositiva, 0.75);
  assert.equal(backlogFinal(5, 3, 4), 4);
  assert.equal(indicadoresSuporte({ trabalhados: 0, resolvidos: 0 }).taxaResolucao, null);
});

test('permissões do Suporte', () => {
  assert.equal(veTodoSuporte({ papel: 'colaborador', lotacoes: [{ setor: 'suporte', gerente: false }] }), false);
  assert.equal(veTodoSuporte({ papel: 'gerente', lotacoes: [{ setor: 'suporte', gerente: true }] }), true);
  assert.equal(ehDoSuporte({ papel: 'colaborador', lotacoes: [{ setor: 'marketing' }] }), false);
});

test('fechamento do atendente: situação crítica exige casos', () => {
  const b = { turno: 'manha', confere_recebidos: 'sim', confere_trabalhados: 'sim', classificacao: 'dentro', problema_recorrente: 'Senha', curso_afetado: 'nenhum', causa: 'x', prevencao: 'y',
    encaminhamento_critico: 'nenhum', caso_critico: 'nao', reclamacao_grave: 'nao', risco_cancelamento: 'nao', aluno_sem_resposta: 'nao', aval_positivas: '2', aval_negativas: '0',
    dificuldade: 'Operação dentro do esperado', melhoria: 'z', acao_amanha: 'w', responsavel_id: '1', prazo: '2026-09-19', observacao: 'ok' };
  assert.doesNotThrow(() => lerFechamentoSuporte(fd(b)));
  assert.throws(() => lerFechamentoSuporte(fd({ ...b, risco_cancelamento: 'sim', casos_qtd: '0' })), /pelo menos um caso/);
  assert.throws(() => lerFechamentoSuporte(fd(b), { temForaSla: true }), /atraso/);
});
