# egredi

App Next.js: **login com LinkedIn (OpenID Connect)** + **import do export "Baixar
seus dados" do LinkedIn** (`.zip`), com o último import + o perfil do login
persistidos em Postgres.

A API do LinkedIn, para um app comum, só devolve `sub`, nome, e-mail e foto.
Cargo, formação, competências e afins vêm do arquivo que o próprio usuário baixa
em <https://www.linkedin.com/mypreferences/d/download-my-data> e sobe aqui — lido
em memória, sem gravar o `.zip` em disco.

## Stack

- Next.js 15 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4
- Postgres via `pg` (Neon em dev, Vercel Postgres em prod)
- Sem biblioteca de auth: OAuth, sessão (cookie HMAC), unzip e CSV são código
  próprio em `src/lib/`

## Variáveis de ambiente

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `LINKEDIN_CLIENT_ID` | sim | Client ID do app no LinkedIn Developer Portal |
| `LINKEDIN_CLIENT_SECRET` | sim | Client Secret |
| `LINKEDIN_REDIRECT_URI` | sim | `.../api/auth/callback` — igual ao registrado no LinkedIn |
| `SESSION_SECRET` | sim | chave do cookie de sessão — `openssl rand -hex 32` |
| `DATABASE_URL` | não | Postgres. Vazio = app funciona, sem persistir. |

## Rodar local

1. `npm install`
2. Criar `.env.local` (veja `.env.example`). Para `DATABASE_URL`, um projeto free
   no [Neon](https://neon.tech) serve — use a connection string com `?sslmode=require`.
3. No [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) → app
   → aba **Auth** → **Authorized redirect URLs**, adicionar:
   `http://localhost:3000/api/auth/callback`
4. `npm run dev` → <http://localhost:3000>

A tabela `profiles` é criada sozinha no primeiro acesso ao banco (`schema.sql` é
o mesmo DDL, para rodar à mão se preferir).

## Deploy na Vercel

1. `git push` para o repositório.
2. Vercel → **New Project** → importar o repo. Next é detectado, sem config.
3. Adicionar um **Vercel Postgres** ao projeto (injeta `DATABASE_URL`).
4. Definir as env vars: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
   `SESSION_SECRET`, e `LINKEDIN_REDIRECT_URI=https://<dominio>/api/auth/callback`.
5. No LinkedIn, adicionar `https://<dominio>/api/auth/callback` aos redirect URLs.
6. Deploy. Testar login no **domínio de produção** (URLs de preview são
   aleatórias e não batem com o `redirect_uri` registrado).

## Notas

- Import limitado a **4 MB** (limite de corpo de função serverless da Vercel). O
  export "rápido" do LinkedIn (Profile/Positions/Education/Skills) cabe folgado.
- Persistência: um registro por usuário (`sub` do LinkedIn) com `import_json`
  (jsonb). Um novo import substitui o anterior.
- **Apagar meus dados** (no dashboard) remove o registro e desloga.
- `legacy/` — o demo Node original de um arquivo, sem dependências. Ponto de
  partida deste app; mantido como referência.

## Rotas

| Rota | O que faz |
|------|-----------|
| `GET /` | Landing; se logado → `/dashboard` |
| `GET /dashboard` | Perfil + import; lê o último import salvo |
| `GET /api/auth/login` | Gera `state`, redireciona ao LinkedIn |
| `GET /api/auth/callback` | Valida `state`, troca código por token, cria sessão, faz upsert do perfil |
| `GET /api/auth/logout` | Limpa a sessão |
| `POST /api/import` | (logado) Recebe o `.zip`, parseia, persiste |
| `POST /api/account/delete` | (logado) Apaga o registro e desloga |
