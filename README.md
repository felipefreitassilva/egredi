# egredi

Demo Node (sem dependências): login **LinkedIn / OpenID Connect** e, depois de
logado, import do export **"Baixar seus dados"** do LinkedIn (`.zip`) para ler
cargo, formação e competências — os campos que a API não entrega.

> Ponto de partida. O app Next.js/Vercel é construído em cima disto.

## Pré-requisitos

- Node.js 18 ou superior.
- App no [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) com o produto
  **"Sign In with LinkedIn using OpenID Connect"** habilitado.

## Configuração

1. No app do LinkedIn → aba **Auth** → **Authorized redirect URLs for your app** →
   adicione exatamente:

   ```
   http://localhost:3000/callback
   ```

2. Copie o **Client Secret** e preencha o arquivo `.env`:

   ```
   LINKEDIN_CLIENT_ID=77fm6zmedp0f91
   LINKEDIN_CLIENT_SECRET=<seu client secret>
   REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

## Rodar

```
node server.js
```

Abra <http://localhost:3000> e clique em **Entrar com LinkedIn**.
Após autorizar, a home mostra o perfil e um campo para enviar o `.zip`.

## Importar o export do LinkedIn

1. Baixe em
   <https://www.linkedin.com/mypreferences/d/download-my-data> — a opção rápida
   ("Want something in particular?" → marcar os itens de perfil) já traz
   `Profile.csv`, `Positions.csv`, `Education.csv`, `Skills.csv`.
2. Estando logado, escolha o `.zip` no campo da home e clique **Enviar e processar**.
3. O arquivo é descompactado **em memória** (leitor de ZIP próprio + `zlib`),
   os CSVs são parseados e mostrados em tabelas. Nada é gravado em disco.

## Rotas

| Rota            | O que faz                                                   |
|-----------------|------------------------------------------------------------|
| `GET /`         | Home: botão de login ou, se logado, perfil + upload do zip. |
| `GET /login`    | Gera `state`, grava cookie e redireciona ao LinkedIn.       |
| `GET /callback` | Valida `state`, troca `code` por token, cria a sessão.      |
| `POST /upload`  | (logado) Recebe o `.zip` cru, descompacta e parseia os CSVs.|
| `GET /logout`   | Apaga os cookies e volta para `/`.                          |

Sessão = cookie `li_session` assinado com HMAC (chave = Client Secret), TTL 1 h.
Nada é persistido no servidor.
