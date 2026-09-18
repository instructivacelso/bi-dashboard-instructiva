# BI Dashboard Instructiva

Sistema interno de gestão da Escola Instructiva. Versão 0.1: fundação completa + módulo Marketing.

## Stack (e por quê)
- **Next.js 14** (telas e API no mesmo app): um único serviço para manter e publicar.
- **PostgreSQL**: banco relacional, com restrições que impedem fechamento duplicado.
- **GitHub + Railway**: cada push na branch `main` publica automaticamente.
- Sessão por cookie assinado (JWT), senhas com bcrypt, permissões checadas no servidor.

## Publicar no Railway (primeira vez)
1. Crie um repositório **privado** no GitHub e envie esta pasta (sem `node_modules`).
2. No Railway: **New Project → Deploy from GitHub repo** → escolha o repositório.
3. No mesmo projeto: **New → Database → PostgreSQL**.
4. No serviço do app, aba **Variables**, adicione:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao banco)
   - `SESSION_SECRET` = texto aleatório com 40+ caracteres
   - `ADMIN_EMAIL` = e-mail do superadministrador
   - `ADMIN_SENHA` = senha inicial dele (troque depois)
   - `APP_URL` = endereço público do app (ex.: `https://bi-instructiva.up.railway.app`)
5. Aba **Settings → Networking → Generate Domain**.
6. O Railway roda `npm run build` e `npm start`. O `start` aplica as migrations sozinho e cria o superadministrador.
7. (Opcional) Dados de demonstração: `railway run npm run seed`. Logins demo: `ana@`, `bruno@`, `carla@`, `diego@`, `eduarda@`, `felipe@`, `diretoria@demo.instructiva`, senha `demo12345`. **Não rode em produção com dados reais.**
8. Backups: no PostgreSQL do Railway, aba **Backups**, ative backups automáticos.

## Rodar localmente
```bash
cp .env.example .env   # ajuste DATABASE_URL
npm install
npm run migrate && npm run seed
npm run dev            # http://localhost:3000
npm test               # testes das regras
```

## Perfis
| Perfil | Vê | Faz |
|---|---|---|
| Superadministrador | tudo | cadastros, permissões, correções auditadas |
| Diretoria | todos os dashboards | só consulta |
| Gerente de setor | seu setor inteiro | fechamento gerencial, lançamentos, ações, correções auditadas |
| Colaborador | suas atividades | preenche os próprios formulários |
| Prestador externo | só lançamentos atribuídos | preenche os próprios formulários |

## Regras principais
- Um fechamento por usuário + lançamento + dia (live: um por lançamento + dia), garantido no banco.
- O autor edita até o fim do dia (horário de Brasília). Depois, só gerente/superadmin, com motivo obrigatório.
- Toda criação, edição, correção e login vai para `audit_logs`.
- Formulários só aparecem como pendentes quando se aplicam (fase do lançamento; live só no dia ou se liberada).
- Taxas são calculadas pelo sistema; divisão por zero mostra "sem dados".
- Problemas nos formulários geram ações corretivas; problemas da automação geram incidentes.
- Onboarding (compra aprovada → acesso → grupo → orientações) é da Automação; depois passa ao Suporte.

## Estrutura
```
app/(app)/            telas autenticadas (início, setor, formulários, dashboard, admin)
app/api/              exportação CSV e verificação de saúde
lib/                  banco, sessão, permissões, cálculos, consultas
db/migrations/        SQL versionado
scripts/              migrate e seed
tests/                testes das regras
```

## Próximas etapas
- Financeiro — Etapa 3 (dívidas, investidores, consórcios, patrimônio, metas de redução e alçadas).
- RH — Etapa 2 (clima/eNPS, folha completa, avaliações 360, treinamento detalhado, sucessão, integrações de ponto e folha).
- Acadêmico — Etapa 2 (integrações finas com marketing/comercial/suporte, qualidade e aprovação, pontuação opcional, automações).
- Pós-venda.
- Envio de e-mail para recuperação de senha (hoje o admin gera o link).
- O sistema funciona 100% por formulário: não há integração com plataformas de venda, WhatsApp ou automações.

## Financeiro (Etapa 1 — caixa do dia a dia)
- **Antes do primeiro fechamento**, o gerente financeiro ou o administrador abre **Financeiro → Cadastros** e cadastra: contas bancárias e caixas (com saldo inicial), categorias (plano de contas), fornecedores, centros de custo e os compromissos fixos mensais (aluguel, folha etc.). Ali também ficam os parâmetros: horário-limite do fechamento e as probabilidades de recebimento usadas na projeção.
- **Equipe:** em **Financeiro → Equipe**, cadastre quem lança o dia a dia com a atividade **Operação financeira** (ela passa a ver o *Fechamento financeiro do dia* na tela inicial) e o responsável com a atividade **Gerente financeiro**, tipo *Gerente do setor* (só ele pode marcar o dia como **Fechado** e vê o painel e os cadastros).
- **Fechamento do dia:** saldo de cada conta (o saldo inicial já vem do dia anterior e o final é calculado), entradas recebidas (com taxa; o líquido é calculado), contas a pagar e a receber por faixa, inadimplência e conciliação. **As vendas do dia vêm prontas** do Comercial e da Indicação — não se digita de novo.
- **Painel (gerente/diretoria):** saldo disponível, resultado do dia, a pagar hoje, vendas, contas a receber e a pagar por faixa, inadimplência e a **projeção de caixa** em cenários, com aviso de risco de saldo negativo, cobertura de 30 dias e capital de giro necessário.

## Financeiro (Etapa 2 — resultado do mês)
- Em **Financeiro → Resultado do mês** o gerente e a diretoria veem o **DRE gerencial** do mês escolhido: receita bruta, impostos e taxas, receita líquida, custos variáveis, marketing, margem de contribuição, custos fixos, pessoal, **EBITDA**, depreciação, juros e resultado líquido.
- A **receita** vem das vendas (Comercial + Indicação) e o **investimento de marketing** vem do módulo de Marketing (mídia + disparos). Os **custos** vêm dos pagamentos do mês, agrupados pela categoria. Nada é digitado duas vezes.
- Também traz o **ponto de equilíbrio** (faturamento para empatar), o **CAC** e a **margem por produto** (custo direto + rateio dos custos gerais pela participação na receita).
- O que não passa pelo caixa do dia (depreciação, pró-labore, provisões, ajustes de imposto ou juros) é lançado em **Ajustes de competência**, na própria tela, e entra no DRE do mês.
- Para o CAC e o custo por produto ficarem certos, marque nos pagamentos o **produto** (e, quando fizer sentido, o **lançamento**) a que o custo se refere. O que ficar sem produto é rateado pela receita.

## RH (Etapa 1)
- **Estrutura e ficha:** cadastre **cargos** (RH → Cadastros) e **colaboradores** (RH → Colaboradores), com unidade, cidade, setor, cargo, gestor, admissão, vínculo, modalidade e status. O **salário é restrito**: só o gerente de RH e a diretoria veem e editam; toda alteração fica auditada.
- **Fechamento diário do RH:** a operação registra o dia em seções que podem ser marcadas como “sem ocorrência” (movimentação, ponto, ocorrências, recrutamento, treinamentos) mais riscos e plano de ação. Nada de digitar a lista inteira de gente todo dia.
- **Indicadores automáticos:** headcount (início, fim, médio e atual), turnover, turnover voluntário, absenteísmo, atrasos, horas extras, custo total e médio de pessoal, pessoas por setor/unidade/vínculo, vagas, funil de recrutamento e presença em treinamentos.
- **Perfis:** RH operacional (cadastros, ficha e fechamento, sem salário), gerente de RH e diretoria (painel completo com custo), colaborador vê só o que preenche.
- **Começar:** cadastre cargos e colaboradores; marque as equipes de RH em Setores → RH (Operação e Gerente).

## Professores e Acadêmico (Etapa 1)
- **Registro diário do professor:** o professor marca as atividades do dia (gravação, criativos, materiais, suporte, lives, vendas, planejamento) e **só os blocos marcados aparecem** — leva poucos minutos. As métricas de mídia continuam vindo do Marketing, sem redigitar.
- **Pipeline de conteúdo (Kanban):** da ideia à publicação, em 12 etapas; o conteúdo só avança, com prazo, prioridade, responsável e histórico de cada mudança.
- **Indicadores:** horas por atividade, aulas gravadas e publicadas, taxa de regravação, criativos, páginas, suporte (resolução e 1º contato), lives (comparecimento e receita por live), vendas (conversão e ticket), tudo por professor e no total.
- **Painéis:** o professor acompanha seus números contra as metas; a coordenação e a diretoria veem a produção do time, o pipeline e o que está atrasado.
- **Começar:** cadastre os professores e vincule o login (Acadêmico → Cadastros), defina metas e marque as equipes em Setores → Professores e Acadêmico (Professores e Coordenação).

## Time de Indicação (colaborador)
- Cadastre a pessoa em **Indicações → Equipe**, atividade **Colaborador de indicação**. Ela passa a ver o **Formulário do dia** (10 campos), **Meu painel** e **Meu pipeline** (Kanban de 13 estágios) — somente com as próprias indicações.
- O vendedor (atividade **Vendas por indicação**) vê só as oportunidades encaminhadas a ele e atualiza negociação, venda ou perda.
- Encaminhar ao vendedor exige vendedor e próximo passo. Validar bloqueia telefone duplicado. A cada 5 validadas do mesmo aluno, o sistema gera o benefício e o número do sorteio; o colaborador registra a escolha (3 cursos, cashback de R$ 250 ou apostila) em **Benefícios**.
- O gerente define metas por colaborador e os prazos dos alertas em **Indicações → Metas**, e recebe os formulários da equipe consolidados no próprio fechamento.

## Comercial (Jesuítas e Toledo)
- Vendedor: cadastre a pessoa em **Comercial → Jesuítas/Toledo → Equipe**, atividade **Vendedores**. A cidade do formulário vem desse cadastro e o vendedor não consegue alterar.
- Gerente: mesma tela, atividade **Gerente comercial**, tipo de acesso **Gerente do setor** (só o administrador marca). Vê somente a própria cidade.
- Diretor comercial: **Comercial → Diretoria → Equipe**, atividade **Diretor comercial**. Vê e compara as duas cidades.
- Cursos: cadastre em **Lançamentos → Produtos**. O vendedor só escolhe cursos ativos.
- Metas e horário-limite: **Gestão → Metas comerciais**.

## Suporte
- Atendente: **Suporte → Equipe**, atividade **Atendimento**. Registra atendimentos em **Meus atendimentos** e envia o **Fechamento do dia**.
- Gerente: atividade **Gerente de Suporte**, tipo **Gerente do setor**. Vê a fila toda, reatribui, envia o fechamento gerencial e acompanha o **Dashboard Suporte**.
- SLA por prioridade e horário-limite: **Dashboard Suporte → SLA**.
- Protocolo, horários, primeira resposta, solução e linha do tempo são registrados automaticamente. Ninguém exclui atendimento.

## Indicação
- Gerente: **Indicações → Equipe**, atividade **Gerente de Indicação**, tipo **Gerente do setor**. Cadastra as **Campanhas** (quantas indicações válidas geram benefício, tipo, valor, sorteio), valida e distribui as indicações, envia o fechamento diário.
- Coleta (CS/CX ou atividade **Coleta de indicações**): registra o convite ao aluno e os contatos indicados. Telefone repetido vira "duplicada" e telefone inválido é marcado automaticamente.
- Vendedor (atividade **Vendas por indicação**): vê só as indicações dele e avança no funil até a venda. Contato bloqueado não recebe nova tentativa.
- Benefícios: gerados sozinhos ao atingir a quantidade de indicações **validadas**; aprovação e entrega em **Indicações → Benefícios** (gerente ou Financeiro).

## CS/CX (registro manual pela equipe)
- Colaborador: **CS/CX → Equipe**, atividade **Carteira de alunos**. Cuida da própria carteira: adiciona alunos, atualiza a ficha (onboarding, progresso, último acesso) e registra contatos, pesquisas (NPS/CSAT/CES), voz do cliente, cancelamentos e oportunidades.
- Gerente: atividade **Gerente de CS/CX**, tipo **Gerente do setor**. Vê todas as carteiras, ajusta a **regra do health score** (cada alteração cria uma nova versão e recalcula todos os alunos), envia o fechamento diário e acompanha o **Dashboard CS/CX**.
- O health score é recalculado a cada atualização de ficha ou novo registro, e guarda a versão da regra usada.
