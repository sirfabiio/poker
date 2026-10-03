# Guia passo a passo: publicar o Poker Ledger

Este guia é para quem **nunca publicou uma app**. Segue os passos por ordem. No fim de cada passo há uma secção **"Como sei que correu bem"**: só avances quando isso se confirmar.

Notas antes de começar:

- Sempre que vires algo entre `< >`, como `<A_TUA_URL_POOLED>`, troca pelo teu valor **sem** os sinais `< >`.
- **Nunca** coloques URLs da base de dados nem o PIN no GitHub, no WhatsApp ou em capturas de ecrã. Esses valores vão só para o ficheiro `.env` (no teu computador) e para a Vercel.
- Os comandos escrevem-se no **Terminal** (macOS: app "Terminal"; Windows: "PowerShell"; Linux: "Terminal") e confirmam-se com Enter.

---

## 1. O que vais precisar

1. **Conta GitHub**: cria em https://github.com/signup (grátis).
2. **Conta Vercel**: em https://vercel.com/signup escolhe **"Continue with GitHub"** (entras com a conta do GitHub, não precisas de outra palavra-passe).
3. **Conta Neon** (base de dados Postgres grátis): em https://console.neon.tech/signup (podes entrar também com o GitHub).
4. **Node.js LTS**: descarrega em https://nodejs.org e escolhe a versão **LTS**. Instala com as opções por omissão.
5. **Git**: descarrega em https://git-scm.com/downloads e instala com as opções por omissão.

Depois de instalar, **fecha e volta a abrir o Terminal** e escreve:

```bash
node -v
git --version
```

**Como sei que correu bem:** `node -v` mostra algo como `v22.x.x` (20 ou mais) e `git --version` mostra `git version 2.x`. Se aparecer "command not found" / "não é reconhecido", reinicia o computador e tenta de novo.

---

## 2. Correr localmente

### 2.1 Abrir o projeto e instalar as dependências

Se já tens a pasta `poker-ledger` no computador, entra nela. Se o código já estiver num repositório GitHub teu, podes cloná-lo com `git clone <URL_DO_TEU_REPOSITORIO>`.

```bash
cd poker-ledger
npm install
```

**Como sei que correu bem:** o comando termina sem `ERR!` e aparece uma pasta `node_modules`. Avisos (`WARN`) e a linha `npm audit` podem ser ignorados.

### 2.2 Criar o projeto no Neon

1. Em https://console.neon.tech clica em **New Project**.
2. **Project name:** `poker-ledger`. **Region:** **AWS Europe Central 1 (Frankfurt)** (a mais próxima de Portugal e da função da Vercel, que está em Frankfurt). Deixa a versão do Postgres por omissão.
3. Clica em **Create project**.

**Como sei que correu bem:** abre o painel do projeto e, no menu **Branches**, aparece uma branch chamada `main` (a de produção).

### 2.3 Criar a branch `dev` (base de dados de desenvolvimento)

1. No menu da esquerda clica em **Branches** → **Create branch** (ou **New branch**).
2. **Name:** `dev`. **Parent:** `main`. Clica em **Create**.

**Como sei que correu bem:** a lista de branches mostra `main` e `dev`.

### 2.4 Copiar as duas URLs da branch `dev`

**Diferença numa frase:** a ligação **pooled** passa por um "porteiro" (PgBouncer) que partilha poucas ligações entre muitos pedidos e é a que a app usa; a ligação **direta** liga sem intermediários e é a que o Prisma precisa para criar/alterar tabelas (migrações).

1. No painel do projeto clica em **Connect** (botão no topo do Dashboard).
2. Em **Branch** escolhe **`dev`**.
3. Liga a opção **Connection pooling** e copia a connection string (o endereço tem `-pooler` no nome do servidor). Esta é a `DATABASE_URL`.
4. Desliga **Connection pooling** e copia outra vez (agora **sem** `-pooler`). Esta é a `DIRECT_URL`.

### 2.5 Criar o ficheiro `.env`

Copia o modelo:

```bash
cp .env.example .env
```

(No PowerShell do Windows: `Copy-Item .env.example .env`.)

Abre o `.env` num editor de texto (por exemplo o VS Code ou o Bloco de Notas) e preenche:

```
DATABASE_URL="<A_TUA_URL_POOLED_DEV>&pgbouncer=true&connect_timeout=15"
DIRECT_URL="<A_TUA_URL_DIRETA_DEV>"
ADMIN_PIN="<UM_PIN_COM_PELO_MENOS_6_DIGITOS>"
```

- No fim da `DATABASE_URL` acrescenta `&pgbouncer=true&connect_timeout=15` (se a URL ainda não tiver nenhum `?`, usa `?pgbouncer=true&connect_timeout=15`). Isto avisa o Prisma de que está atrás do pooler e dá tempo ao Neon para "acordar".
- O `ADMIN_PIN` tem de ter **só algarismos, pelo menos 6** (ex.: inventa um tu; não uses datas de nascimento).

**Como sei que correu bem:** o ficheiro `.env` existe na pasta `poker-ledger` com as três linhas preenchidas, sem `< >`.

### 2.6 Criar as tabelas, pôr dados de exemplo e arrancar

```bash
npx prisma migrate dev
npm run seed
npm run dev
```

- `npx prisma migrate dev` cria as tabelas na branch `dev`.
- `npm run seed` coloca 5 jogadores e 3 sessões de exemplo (só para desenvolvimento; recusa correr se a base de dados já tiver jogadores).
- `npm run dev` arranca a app. Deixa este Terminal aberto enquanto usas a app (para parar: `Ctrl + C`).

Abre **http://localhost:3000** no browser.

**Como sei que correu bem:**
- `migrate dev` termina com "Your database is now in sync with your schema".
- `seed` mostra "Seed concluído: 5 jogadores e 3 sessões."
- `npm run dev` mostra "Ready" e, no browser, aparece **"Quem és tu?"** com Ana, Miguel, Rui, Sofia e Tiago. Escolhe um e vês o painel com o saldo.
- Extra: http://localhost:3000/dev/ui mostra o catálogo de componentes (só existe em desenvolvimento).

---

## 3. Correr os testes

```bash
npm test
```

**Como sei que correu bem:** no fim aparece algo como:

```
 Test Files  7 passed (7)
      Tests  37 passed (37)
```

Os testes não precisam da base de dados. Cobrem o cálculo do fecho (`lib/settle.ts`), os ajustes de diferenças de contagem (`lib/reconcile.ts`), os nomes duplicados ("rui" vs "Rui"), a validação de sessões, os valores em cêntimos e o PIN de admin.

---

## 4. Enviar o código para o GitHub

1. Em https://github.com/new cria um repositório: **Repository name** `poker-ledger`, marca **Private**, **não** adiciones README, .gitignore nem licença. Clica **Create repository**.
2. No Terminal, dentro da pasta `poker-ledger`:

```bash
git init
git add .
git commit -m "Primeira versão do Poker Ledger"
git branch -M main
git remote add origin https://github.com/<O_TEU_UTILIZADOR>/poker-ledger.git
git push -u origin main
```

Se o Git pedir nome/email, corre uma vez (com os teus dados) `git config --global user.name "<O_TEU_NOME>"` e `git config --global user.email "<O_TEU_EMAIL>"` e repete o `git commit`. Se pedir login no `git push`, segue a janela do GitHub que abre no browser.

**Atenção: confirma que o `.env` NÃO foi enviado.** Antes do commit podes correr `git status`: o `.env` **não** pode aparecer na lista (está no `.gitignore`).

**Como sei que correu bem:** na página do repositório no GitHub vês os ficheiros (`app`, `lib`, `prisma`, `package.json`, `GUIA.md`…) e **não existe** nenhum ficheiro `.env` (só `.env.example`). Se por engano o `.env` aparecer: apaga-o do GitHub, e no Neon gera novas palavras-passe (**Roles** → o teu utilizador → **Reset password**) e escolhe um PIN novo.

---

## 5. Base de dados de produção no Neon

A produção usa a branch **`main`** do mesmo projeto (começa vazia; **não** corras o seed nela).

1. No Neon clica em **Connect**.
2. Em **Branch** escolhe **`main`**.
3. Com **Connection pooling** ligado, copia a URL → esta é a `DATABASE_URL` de produção (acrescenta-lhe `&pgbouncer=true&connect_timeout=15`, como no passo 2.5).
4. Com **Connection pooling** desligado, copia a URL → esta é a `DIRECT_URL` de produção.

Guarda as duas num sítio seguro (por exemplo, um gestor de palavras-passe). **Não** as coloques no `.env` local: o `.env` continua a apontar para a `dev`.

**Como sei que correu bem:** tens duas URLs onde aparece o nome da branch `main` (ou o endpoint principal), uma com `-pooler` e outra sem.

---

## 6. Publicar na Vercel

1. Em https://vercel.com/new (ou **Add New… → Project**) clica em **Import** ao lado do repositório `poker-ledger`. Se não aparecer, clica em **Adjust GitHub App Permissions** e dá acesso ao repositório.
2. **Framework Preset:** deve aparecer **Next.js** sozinho. Não mudes os comandos de build: o projeto já usa `npm run build`, que faz `prisma generate && prisma migrate deploy && next build`.
3. Abre **Environment Variables** e adiciona três (Name / Value):
   - `DATABASE_URL` = a URL **pooled** de produção (passo 5)
   - `DIRECT_URL` = a URL **direta** de produção (passo 5)
   - `ADMIN_PIN` = o PIN de produção (só algarismos, mínimo 6)
4. **Região:** o ficheiro `vercel.json` já fixa as funções em **Frankfurt (fra1)**, perto do Neon. Depois do deploy podes confirmar em **Settings → Functions → Function Region** (deve dizer Frankfurt, `fra1`). Se mudares a região do Neon, muda também esta.
5. Clica em **Deploy** e espera (2–4 minutos).

**Onde ver os logs se o build falhar:** no projeto da Vercel → separador **Deployments** → clica no deployment com estado **Error** → **Building** (ou **Build Logs**). A mensagem de erro está normalmente nas últimas linhas a vermelho. Vê também a secção 11.

**Como sei que correu bem:** aparece "Congratulations!" e uma pré-visualização da app. Nos logs do build vês "All migrations have been successfully applied" (ou "No pending migrations") e a tabela de rotas do Next.js.

---

## 7. Primeiro uso em produção

1. No projeto da Vercel clica em **Visit** (ou abre o endereço `https://<NOME_DO_PROJETO>.vercel.app`).
2. **Confirma que a base de dados está vazia:** deve aparecer "Quem és tu?" com a frase "Ainda não há ninguém à mesa. Sê o primeiro!" (sem a Ana, o Rui, etc. do seed).
3. Clica **Sou novo aqui**, escreve o teu nome e **Criar perfil e entrar**.
4. Faz uma sessão de teste: **Sessões → + Nova sessão** → em "+ Adicionar pessoa nova" cria uma pessoa "Teste", seleciona-te também → **Começar sessão**. Faz um **Rebuy** e preenche os **cash-outs**. Se a soma não der o total das entradas, a app mostra "Sobram/Faltam X €": recontem e, se for mesmo assim, usa **Ajustar diferença** (explicado no README, secção "Diferenças de contagem").
5. Testa o fecho: **Contas → Fechar contas (precisa do PIN de admin)** → escreve o `ADMIN_PIN` de produção → **Ir para Contas e fechar o ciclo** → **Fechar contas** → **Confirmar e fechar contas**. Na página do fecho, carrega em **Marcar como paga**.

**Como sei que correu bem:** depois do fecho vês os talões, o progresso (ex.: "1/1 pagas") e o carimbo **PAGO**.

### Apagar os dados de teste (sem apagar a base de dados)

1. No Neon abre **SQL Editor**, escolhe a branch **`main`** (confirma duas vezes que é a de produção que queres limpar).
2. Cola e executa (**Run**):

```sql
TRUNCATE "ActivityLog", "Transfer", "Settlement", "BuyIn", "SessionPlayer", "Session", "Player" CASCADE;
```

Isto apaga **todos** os jogadores, sessões e fechos, mas mantém as tabelas e as migrações. Depois, no telemóvel/computador onde testaste, escolhe outra vez o perfil (o antigo deixou de existir, por isso a app volta a "Quem és tu?").

**Como sei que correu bem:** ao abrir a app volta a aparecer "Ainda não há ninguém à mesa".

---

## 8. Instalar no telemóvel

**Android (Chrome):**
1. Abre o endereço `https://<NOME_DO_PROJETO>.vercel.app` no **Chrome**.
2. Toca no banner **"Instalar app"** em baixo, ou no menu **⋮ → Instalar app** (ou "Adicionar ao ecrã principal").

**iPhone (Safari):**
1. Abre o endereço no **Safari** (tem de ser o Safari).
2. Toca em **Partilhar** (quadrado com seta para cima) → **Adicionar ao ecrã principal** → **Adicionar**.

**Partilhar com o grupo (WhatsApp):** envia o endereço `https://<NOME_DO_PROJETO>.vercel.app` no grupo com uma mensagem como: "Abram este link, escolham o vosso nome (ou 'Sou novo aqui') e instalem a app no ecrã principal." **Nunca** envies o PIN de admin no grupo.

**Como sei que correu bem:** aparece o ícone da ficha dourada no ecrã principal e, ao abrir, a app ocupa o ecrã inteiro sem a barra do browser.

---

## 9. Atualizar a app

1. Faz as alterações no código e testa localmente (`npm run dev` e `npm test`).
2. Envia:

```bash
git add .
git commit -m "<descreve a alteração>"
git push
```

A Vercel deteta o `push` e publica sozinha uma nova versão em 2–4 minutos. **As migrações da base de dados correm no build** (`prisma migrate deploy` faz parte do `npm run build`): se alteraste o `schema.prisma`, cria primeiro a migração localmente com `npx prisma migrate dev --name <nome_da_alteracao>` (na branch `dev`) e inclui a pasta `prisma/migrations` no commit.

**Como sei que correu bem:** em **Deployments** o deployment mais recente fica **Ready** com a mensagem do teu commit. No telemóvel, fecha e reabre a app (ver secção 11 se a alteração não aparecer).

---

## 10. Domínio próprio (opcional)

O endereço por omissão é `https://<NOME_DO_PROJETO>.vercel.app`. Para um endereço mais bonito sem pagar nada:

1. No projeto da Vercel: **Settings → General → Project Name** → muda para, por exemplo, `poker-da-malta` → **Save**.
2. Em **Settings → Domains** confirma (ou adiciona) `poker-da-malta.vercel.app`. Se o nome já estiver ocupado, a Vercel avisa e escolhes outro.

(Se tiveres um domínio teu, em **Settings → Domains → Add** escreve-o e segue as instruções de DNS que a Vercel mostra.)

**Como sei que correu bem:** `https://poker-da-malta.vercel.app` abre a app. Envia o novo link ao grupo; quem já instalou deve reinstalar a partir do novo endereço.

---

## 11. Resolução de problemas

| Problema | Causa | Solução |
| --- | --- | --- |
| **Build falha na Vercel com "Environment variable not found: DATABASE_URL" (ou `DIRECT_URL`)** | Falta uma variável na Vercel. | **Settings → Environment Variables**: confirma `DATABASE_URL`, `DIRECT_URL` e `ADMIN_PIN` (sem aspas a mais nem espaços), com **Production** assinalado. Depois **Deployments → ⋯ → Redeploy**. |
| **Erro de ligação à base de dados** (`P1001 Can't reach database server`, `P1000 Authentication failed`, ou o build fica parado em `migrate deploy`) | URL errada/incompleta, ou pooled e direta trocadas. | Volta a copiar as URLs no Neon (**Connect**). A `DATABASE_URL` é a que tem `-pooler`; a `DIRECT_URL` é a **sem** `-pooler`. Confirma que estás a usar a branch certa (`main` na Vercel, `dev` no `.env`). Se aparecer um erro sobre `channel_binding`, apaga `&channel_binding=require` da URL. |
| **O primeiro carregamento é lento depois de algum tempo sem uso** | No plano grátis, o Neon suspende a base de dados após inatividade e demora uns segundos a "acordar". | É normal: espera e recarrega. O `connect_timeout=15` na `DATABASE_URL` dá tempo ao arranque. Os pedidos seguintes são rápidos. |
| **"PIN inválido."** | O PIN escrito não é igual ao `ADMIN_PIN` configurado. | Confirma o valor em **Settings → Environment Variables** da Vercel. Se o mudares, faz **Redeploy** (as variáveis só se aplicam a novos deployments). Se aparecer "O ADMIN_PIN não está configurado no servidor", falta a variável ou tem menos de 6 algarismos. |
| **A app não aparece como instalável** | A instalação exige HTTPS, o manifest e o service worker. | Usa o endereço `https://…vercel.app` (o `localhost` com `npm run dev` não tem service worker). No Chrome do computador: **F12 → Application → Manifest** mostra os erros. No iPhone só funciona pelo **Safari** (Partilhar → Adicionar ao ecrã principal). |
| **Uma alteração publicada não aparece** | O service worker serve primeiro a versão em cache e só depois atualiza. | Fecha a app por completo e volta a abrir (às vezes 2 vezes). No browser do computador: **Ctrl + Shift + R**. Para forçar: Chrome → **F12 → Application → Service workers → Unregister** e depois **Storage → Clear site data**; no Android: Definições → Apps → Chrome → Armazenamento → gerir dados do site; no iPhone: Definições → Safari → Avançadas → Dados de sites → apagar o do teu endereço. |

---

## 12. Manutenção e custos

- **Planos grátis mudam.** Os limites (horas de computação, armazenamento, pedidos, tempo até suspender) da Vercel e do Neon podem mudar a qualquer momento. Confirma os valores atuais em https://vercel.com/pricing e https://neon.tech/pricing (e no painel de **Usage** de cada serviço). Para um grupo de amigos, o uso costuma ficar muito abaixo dos limites grátis.
- **O Neon pode ter uma pequena pausa de arranque** depois de algum tempo sem uso (ver secção 11).
- **Backup uma vez por mês** (escolhe uma das opções):
  1. **Pelo Neon:** cria uma branch de cópia: **Branches → Create branch**, **Parent:** `main`, nome `backup-<ANO>-<MES>`. Fica uma cópia congelada dos dados desse momento (confirma nos limites do teu plano quantas branches podes ter e apaga as antigas).
  2. **Com `pg_dump`** (precisa das ferramentas do PostgreSQL instaladas no computador, em https://www.postgresql.org/download/):

     ```bash
     pg_dump "<A_TUA_DIRECT_URL_DE_PRODUCAO>" -Fc -f poker-backup-<ANO>-<MES>.dump
     ```

     Guarda o ficheiro `.dump` num sítio seguro (não no GitHub).

**Como sei que correu bem:** no Neon aparece a branch `backup-…`, ou no computador existe o ficheiro `poker-backup-….dump` com mais de 0 KB.
