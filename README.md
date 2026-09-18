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
- Financeiro — Etapa 2 (custo por produto, CAC, margem, DRE, ponto de equilíbrio) e Etapa 3 (dívidas, investidores, patrimônio, metas de redução).
- RH, Pós-venda e Acadêmico.
- Envio de e-mail para recuperação de senha (hoje o admin gera o link).
- O sistema funciona 100% por formulário: não há integração com plataformas de venda, WhatsApp ou automações.

## Financeiro (Etapa 1 — caixa do dia a dia)
- **Antes do primeiro fechamento**, o gerente financeiro ou o administrador abre **Financeiro → Cadastros** e cadastra: contas bancárias e caixas (com saldo inicial), categorias (plano de contas), fornecedores, centros de custo e os compromissos fixos mensais (aluguel, folha etc.). Ali também ficam os parâmetros: horário-limite do fechamento e as probabilidades de recebimento usadas na projeção.
- **Equipe:** em **Financeiro → Equipe**, cadastre quem lança o dia a dia com a atividade **Operação financeira** (ela passa a ver o *Fechamento financeiro do dia* na tela inicial) e o responsável com a atividade **Gerente financeiro**, tipo *Gerente do setor* (só ele pode marcar o dia como **Fechado** e vê o painel e os cadastros).
- **Fechamento do dia:** saldo de cada conta (o saldo inicial já vem do dia anterior e o final é calculado), entradas recebidas (com taxa; o líquido é calculado), contas a pagar e a receber por faixa, inadimplência e conciliação. **As vendas do dia vêm prontas** do Comercial e da Indicação — não se digita de novo.
- **Painel (gerente/diretoria):** saldo disponível, resultado do dia, a pagar hoje, vendas, contas a receber e a pagar por faixa, inadimplência e a **projeção de caixa** em cenários, com aviso de risco de saldo negativo, cobertura de 30 dias e capital de giro necessário.

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
