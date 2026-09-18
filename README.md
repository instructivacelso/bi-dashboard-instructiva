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

## Próximas etapas (aguardando aprovação)
- Formulários de Comercial, Financeiro, RH, Suporte, CS/CX, Indicações e Acadêmico.
- Webhooks Hotmart/TMB/Greenn e n8n alimentando `commercial_launch_results` e `onboarding_events`.
- Envio de e-mail para recuperação de senha (hoje o admin gera o link).

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

## CS/CX (registro manual até a integração com Hotmart, Panda e Academy)
- Colaborador: **CS/CX → Equipe**, atividade **Carteira de alunos**. Cuida da própria carteira: adiciona alunos, atualiza a ficha (onboarding, progresso, último acesso) e registra contatos, pesquisas (NPS/CSAT/CES), voz do cliente, cancelamentos e oportunidades.
- Gerente: atividade **Gerente de CS/CX**, tipo **Gerente do setor**. Vê todas as carteiras, ajusta a **regra do health score** (cada alteração cria uma nova versão e recalcula todos os alunos), envia o fechamento diário e acompanha o **Dashboard CS/CX**.
- O health score é recalculado a cada atualização de ficha ou novo registro, e guarda a versão da regra usada.
