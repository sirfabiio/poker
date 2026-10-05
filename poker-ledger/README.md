# Poker Ledger

PWA para gerir as contas do poker (cash game) de um grupo de amigos, ao estilo Splitwise. Cada noite regista-se buy-ins, rebuys e cash-outs; os resultados acumulam-se e, quando o admin decide, fecha-se o ciclo e a app calcula quem paga a quem.

**Para publicar a app passo a passo, lê o [GUIA.md](./GUIA.md).**

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL (Neon) · Serwist (service worker) · Vitest. Deploy na Vercel.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:3000 |
| `npm run build` | `prisma generate && prisma migrate deploy && next build` |
| `npm start` | Serve o build de produção |
| `npm test` | Testes (Vitest): fecho de contas, ajustes de contagem, nomes duplicados, sessões, dinheiro, admin |
| `npm run seed` | Dados de exemplo (5 jogadores, 3 sessões). **Só desenvolvimento**, só numa BD vazia |

Outros: `npx prisma migrate dev` (aplica migrações em dev), `node scripts/make-icons.mjs` (regenera os ícones PNG).

Variáveis de ambiente (ver `.env.example`): `DATABASE_URL` (Neon, ligação pooled), `DIRECT_URL` (Neon, ligação direta, para migrações), `ADMIN_PIN` (mínimo 6 dígitos).

## Identidade: atenção

Não há palavras-passe. Cada pessoa escolhe o seu perfil uma vez no dispositivo (fica num cookie). **Isto é identificação, não autenticação:** qualquer pessoa com o link pode fazer-se passar por outro jogador. Para este grupo de amigos de confiança isso é aceite. Só as ações de admin (fechar contas, desativar/reativar e renomear jogadores, marcar qualquer transferência como paga) estão protegidas por PIN. Todas as escritas ficam no histórico de atividade com o perfil que as fez.

## Diferenças de contagem

Na vida real as fichas contam-se mal: a soma dos cash-outs (C) fica diferente da soma das entradas (E). A diferença é **D = C − E** (D > 0: sobram; D < 0: faltam). Com todos os cash-outs preenchidos e D ≠ 0, a sessão mostra o cartão "Sobram/Faltam X €" e pede para **recontarem as fichas**. Se a recontagem confirmar, "Ajustar diferença" distribui **−D** pelos jogadores numa linha separada "Ajuste de contagem". Os cash-outs originais não mudam, e a soma dos resultados líquidos (cash-out − entradas + ajuste) fica exatamente a 0. Há três métodos (`lib/reconcile.ts`):

- **Igual por todos:** cada jogador absorve a mesma parte.
- **Proporcional às entradas:** a parte de cada um é proporcional ao que pôs na mesa; quem não teve entradas não absorve nada.
- **Um só jogador:** um jogador escolhido absorve a diferença toda (ex.: quem se enganou a contar).

Cêntimos que sobram da divisão vão, um a um, para os maiores restos (desempate: maior total de entradas, depois id). Diferenças acima de **5,00 € ou 5 % das entradas** (`lib/config.ts`) mostram um aviso reforçado e só se confirmam com o PIN de admin. Qualquer alteração a entradas ou cash-outs anula o ajuste, e "Desfazer ajuste" faz o mesmo à mão; nos dois casos a sessão volta a ficar por ajustar. Só contam para o fecho as sessões com todos os cash-outs e com D = 0 ou ajuste confirmado. Sessões já fechadas nunca são ajustadas nem desfeitas. Ajustar, desfazer e as anulações automáticas ficam no histórico de atividade com o método e D.

## Ranking e prémios

A página **Ranking** (`/ranking`) usa só **sessões válidas**: todos os cash-outs preenchidos e diferença 0 ou ajuste confirmado. Sessões em aberto mas válidas também contam. O resultado de cada jogador numa sessão é cash-out − entradas + ajuste. Os rebuys de uma sessão são o número de entradas menos 1. Os ex-jogadores (desativados) continuam no ranking. Média, % de sessões ganhas, ROI (lucro ÷ investido) e desvio-padrão só aparecem com pelo menos `MIN_SESSIONS_FOR_RATES` = 3 sessões (`lib/config.ts`); abaixo disso aparece "—". O cálculo está em `lib/stats.ts` (função pura, testada). Em qualquer prémio, o desempate dá a vitória ao caso mais recente.

| Prémio | Regra |
| --- | --- |
| Noite de ouro | Maior ganho numa única sessão. |
| Noite de pesadelo | Maior perda numa única sessão. |
| Em chamas | Maior sequência de vitórias seguidas (mínimo 2); mostra também quem está numa sequência ativa (≥ 2 até à última sessão que jogou). |
| Em queda livre | Maior sequência de derrotas seguidas (mínimo 2). |
| Rei do rebuy | Mais rebuys no total, e o recorde de rebuys numa só noite. |
| Ressuscitado | Maior ganho numa sessão com 2 ou mais rebuys. |
| Sem rede | Mais sessões ganhas sem nenhum rebuy. |
| Montanha-russa | Maior desvio-padrão dos resultados por sessão (≥ 3 sessões; só com 2 ou mais candidatos). |
| Relógio suíço | Menor desvio-padrão dos resultados por sessão (mesmas condições). |
| Pilar da mesa | Maior percentagem de presença nas sessões do período. |
| Fantasma | Jogador ativo há mais tempo sem jogar ("há N dias"); só conta quem faltou pelo menos à última sessão. |
| Mesa de gala | Sessão com o maior pote (soma das entradas), e a sessão com mais rebuys. |

Sem dados suficientes para um prémio, o cartão não aparece. A tabela ordena-se tocando no título da coluna, e o período pode ser "Sempre", "Este ano" ou "Últimos 90 dias". O gráfico mostra o saldo acumulado por sessão (até 8 linhas; por omissão as 5 pessoas com mais sessões). "Partilhar ranking" copia um texto pronto para o WhatsApp.

## Decisões

- **Next.js 15.5 em vez de 16.** O build do Next 16 já não mostra o tamanho do "First Load JS" (necessário para verificar o orçamento de 120 KB) e usa Turbopack por omissão, que o plugin `@serwist/next` não suporta. O 15.5 é mantido e constrói com webpack.
- **Correção ao React do Next 15.5 (ecrã preso no estado antigo).** Sintoma: depois de uma Server Action bem-sucedida (ex.: "Confirmar ajuste" ou "Desfazer ajuste"), a BD ficava atualizada mas o ecrã não mudava até um reload, em cerca de 1/3 a 1/2 das vezes. A resposta da action trazia os dados novos e nenhum pedido mais antigo os sobrepunha. O problema estava no React 19.2 canary incluído no Next 15.5.27 (a última 15.5): a transição suspendia num chunk RSC que chegava a meio da renderização, o `.then()` do chunk chamava o "ping" de forma síncrona, e o React descartava esse ping e deixava a raiz suspensa para sempre (o botão ficava em "A confirmar…"; até um `router.refresh()` podia ficar preso). O React 19.3 (react-dom de topo, Next 16) já guarda o ping. `scripts/patch-react-ping.mjs` aplica essa mesma alteração de uma linha ao `react-dom` do Next no `postinstall`. É idempotente e falha se não reconhecer o código. O `next.config.ts` recusa construir sem a correção e muda a versão da cache do webpack, para uma cache antiga (ex.: a da Vercel) não trazer de volta o código sem a correção. `tests/react-ping-fix.test.ts` verifica o mesmo. Um `router.refresh()` depois das ações não resolvia o problema, porque passa pelo mesmo caminho. Atualizações otimistas e rollback não mudaram. Verificado com Playwright a 375×812, com build de produção e Postgres local: antes falhava em 2 a 4 de cada 6 execuções; depois passou 15/15 e 12/12 (com SW bloqueado) e 5/5 (com SW). O rebuy otimista aparece em ~35 ms. Ao passar para uma versão do Next com React ≥ 19.3, o script deixa de ter efeito ("já corrigido") e pode sair. O caso de `/ranking` com `loading.tsx` (ver "Loading") é provavelmente o mesmo bug, mas não foi testado de novo.
- **Página da sessão sempre atualizada (verificação de versão).** Cada escrita numa sessão sobe `Session.version` e guarda `lastActorPlayerId` e `lastChangeType`, na mesma transação. Isto vale para rebuy, entrada removida, cash-out, juntar ou tirar jogador, editar, ajustar, desfazer o ajuste e fechar contas (`bumpSessionVersion` em `lib/live/bump.ts`, chamado em `lib/actions/sessions.ts` e `lib/actions/settlements.ts`). A página da sessão (`components/session/LiveSession.tsx`) pergunta a `GET /api/sessions/<id>/version`. É uma leitura por chave primária, sem valores nem nomes, com `no-store`. Só quando a versão mudou faz um `router.refresh()`, e o servidor continua a ser a única fonte de verdade.
  - **Porquê assim e não WebSockets:** a Vercel Hobby não mantém ligações abertas, não queríamos contas externas (Pusher, Ably…), e um grupo pequeno com uma ou duas páginas abertas aguenta bem um pedido minúsculo a cada 3 s.
  - **Cadência:** a cada 3 s (±300 ms de jitter), com `setTimeout` encadeado: o pedido seguinte só começa quando o anterior termina, e cada pedido tem 4 s de timeout. Passa a 10 s se não houver alterações nem toques durante 5 minutos, e um toque ou uma alteração repõe os 3 s. Em erro faz backoff de 3 → 6 → 12 → 24 → 30 s (máximo) e volta aos 3 s ao primeiro sucesso. Com o separador oculto não pergunta. Ao voltar a ficar visível, e nos eventos `focus` e `online`, verifica logo. Com 401 ou 404 para; na 404 (sessão apagada) faz um último refresh. Quando a sessão é fechada nas contas, faz o último refresh, mostra "Sessão fechada nas contas" e para.
  - **Atraso esperado:** 3 a 4 s no pior caso (até 3,3 s de espera, mais o pedido e o refresh). Medido com dois browsers em localhost: 2,7 a 3,4 s.
  - A lógica (quando perguntar, backoff, um refresh de cada vez) está em `lib/live/poller.ts`, uma função pura testada com relógio simulado. O aviso ("Rui adicionou um rebuy", `aria-live="polite"`) só aparece para alterações de outras pessoas.
  - **Rascunhos protegidos** (`lib/live/field.ts`): o cash-out e o valor do rebuy personalizado seguem o servidor só enquanto a pessoa não os está a editar. Conta como edição ter escrito ou ter o campo focado: assim um refresh nunca mexe no texto nem no cursor. Se o servidor mudar a meio, aparece "Valor alterado por X: Y €" com "Usar esse valor". Conflitos: o último a gravar ganha, mas o aviso e o toast tornam a alteração visível.
  - O rebuy personalizado passou a vir preenchido com o buy-in por defeito da sessão, que é o valor do servidor que ele segue.
  - As linhas usam `key` = `SessionPlayer.id`. O input de cash-out deixou de ter `key` pelo valor, porque isso remontava o campo e perdia o rascunho.
  - A folha "Ajustar diferença" fica montada enquanto estiver aberta, mesmo que outra pessoa ajuste a diferença entretanto (mostra uma mensagem). Se outra pessoa tirar o jogador que eu estava a editar, aparece uma mensagem.
  - A rota de versão só verifica que há um perfil escolhido, pelo cookie, sem ir à BD: assim cada pedido faz uma única leitura. Não devolve dados sensíveis.
  - `createSession` e `deleteSession` não sobem a versão. Antes de existir, ninguém tem a sessão aberta; depois de apagada, a rota devolve 404.
  - Só a página da sessão se atualiza sozinha. O painel inicial, a lista de sessões e o ranking não.
- **Prisma 6 em vez de 7.** O Prisma 7 deixou de aceitar `url`/`directUrl` no `schema.prisma`; o requisito pede exatamente essa configuração.
- **TypeScript 5.9** (o 7 ainda não é suportado pelo Next 15).
- **Dependências:** só a stack pedida + `serwist`/`@serwist/next` (service worker) e `vitest`. `tsx` (dev) serve apenas para correr o `seed.ts`. Sem bibliotecas de estado, animação ou UI. Ícones PNG gerados por um script Node sem dependências.
- **Região:** `vercel.json` fixa as funções em `fra1` (Frankfurt). No Neon, cria o projeto em **AWS Europe Central 1 (Frankfurt)**: é a região Neon mais próxima de Portugal e fica na mesma cidade das funções, o que reduz a latência de cada query para ~1–2 ms.
- **Nome único:** coluna `Player.nameKey` (`trim()` + minúsculas) com índice `@unique`. A app verifica antes de criar e a BD garante em caso de corrida. Espaços a meio do nome não são normalizados.
- **Buy-in por defeito por sessão:** guardado em `Session.defaultBuyIn` (cêntimos; o modelo pedido não tinha onde o guardar). Mudá-lo não altera entradas já registadas.
- **Sessões válidas:** contam para os saldos e para o fecho só as sessões com todos os cash-outs e com D = 0 ou ajuste de contagem confirmado (ver "Diferenças de contagem"). Uma sessão sem jogadores é considerada válida (0 = 0) e é arquivada no fecho.
- **Ajuste de contagem:** para mudar de método é preciso desfazer primeiro. O pedido leva o D que o utilizador viu: se a sessão mudou entretanto, o servidor recusa e pede para rever. Juntar ou tirar jogadores também conta como alteração de entradas e anula o ajuste. Desfazer está aberto a qualquer perfil, porque só repõe o estado "por ajustar" (que bloqueia o fecho). O PIN de admin acima do limite é verificado só para esse pedido, sem abrir sessão de admin. A soma dos ajustes é verificada contra −D antes de gravar.
- **Criação de sessão:** exige pelo menos 2 jogadores; cada jogador entra com o buy-in por defeito (primeiro BuyIn).
- **Fecho:** corre numa transação com `SELECT … FOR UPDATE` sobre as sessões em aberto (as edições bloqueiam a mesma linha), por isso nenhuma sessão muda a meio do fecho. Se houver alguma sessão inválida, o fecho é recusado e lista as sessões. A soma dos saldos tem de ser exatamente 0, senão aborta.
- **Transferências:** quem paga, quem recebe e o admin podem marcar como paga e também desfazer (para corrigir enganos).
- **Admin:** `lib/admin.ts` é o único módulo de verificação. Cookie httpOnly com 12 h, assinado com HMAC usando o PIN (mudar o PIN invalida as sessões abertas). Tentativas erradas têm 600 ms de atraso. As ações de admin também exigem um perfil escolhido, para ficarem registadas com o nome de quem as fez.
- **"Sou novo aqui"** é a única escrita aceite sem perfil (cria o próprio perfil); fica registada com o próprio jogador como autor.
- **Desativar jogadores:** ficam escondidos de "Quem és tu?" e das listas de seleção; o histórico mantém-se. Jogadores nunca são apagados. Um perfil desativado deixa de poder fazer escritas.
- **Cores de avatar:** fichas vermelha, azul, dourada, verde (feltro), preta e marfim, todas da paleta. Prata e bronze são usadas só no pódio. A cor automática roda pela lista.
- **Contraste:** `--loss` (#FF5C6C) fica abaixo de 4.5:1 sobre o vidro em texto pequeno. Por isso o texto negativo pequeno usa `--loss-soft` (#FFA3AC); `--loss` fica para valores grandes, setas e fundos. O texto dourado sobre vidro usa `--gold-soft` pelo mesmo motivo.
- **Service worker:** pré-cache do JS/CSS, da fonte, dos ícones e da página `/offline`. Páginas (HTML) em **stale-while-revalidate**: arranque imediato e, se a versão nova for diferente, a app faz `router.refresh()` logo a seguir. As **páginas de sessão** (`/sessoes/<id>`) são a exceção: usam **network-first**, e a cópia em cache só serve quando a rede falha. Nunca vão para a cache: os dados RSC (cabeçalho `RSC` ou `?_rsc=`, ou seja, navegações dentro da app e `router.refresh()`), tudo o que está em `/api/*` (inclui a verificação de versão da sessão), pedidos não-GET (todas as escritas são Server Actions = POST), pedidos com o cabeçalho `Next-Action`, e `/admin`. Antes, os dados RSC eram network-first com 4 s de espera e cache offline. Com rede lenta, isso podia mostrar dados antigos na página da sessão, por isso deixaram de ir para a cache. Navegar dentro da app sem rede passa a carregar a página inteira, que vem da cache de páginas. A cache antiga `rsc` é apagada quando o SW novo ativa.
- **Apagar sessões (admin):** na página da sessão, o admin tem "Apagar sessão", com confirmação. Só para sessões **em aberto** (as que já estão num fecho nunca mudam; o servidor recusa com o mesmo bloqueio das edições). Jogadores, entradas, cash-outs e ajustes da sessão saem em cascata (já previsto no schema, sem migração). Fica no histórico de atividade com a data, os jogadores e o pote, e invalida a cache do ranking.
- **Registo do service worker:** feito à mão em `components/OfflineBanner.tsx` (`register: false` no Serwist), protegido com `"serviceWorker" in navigator` e `catch`. O registo automático do `@serwist/next` lançava `Cannot read properties of undefined (reading 'waiting')` quando o browser bloqueia service workers (alguns modos privados ou políticas de empresa). O SW faz `skipWaiting` e `clientsClaim`, por isso não é preciso mais nada do lado da página.
- **Loading:** `loading.tsx` (skeletons) em todas as rotas secundárias. As rotas `/` e `/ranking` não têm um: com o boundary, o React só revelava o conteúdo ~300 ms depois do HTML chegar, o que atrasava o LCP. Ao navegar para estas rotas, o ecrã anterior fica visível até a página chegar (nunca em branco). Em `/ranking` há um segundo motivo: com o boundary, a primeira navegação para a mesma rota com outros parâmetros (período, ordenação, chips do gráfico) era descartada pelo Next 15.5 quando o conteúdo tinha chegado em streaming atrás do skeleton. Verificado: 0/5 navegações aplicadas com `loading.tsx`, 5/5 sem ele.
- **Redirect sem perfil:** feito na página (não em middleware) para não haver uma função extra em cada pedido; na primeira visita o redirect para "Quem és tu?" acontece no browser.
- **Datas:** `Session.date` é `DATE` (sem hora); horas mostradas em Europe/Lisbon.
- **Ranking: dados e cache:** uma única query SQL (sessão × jogador, com soma e contagem de entradas), guardada com `unstable_cache` e a tag `stats` (`STATS_TAG` em `lib/config.ts`). Todas as escritas de sessões, entradas, cash-outs e ajustes, e as mudanças de nome, cor ou estado de um jogador, chamam `revalidateTag`. A página em si é dinâmica (lê o cookie do perfil); o que fica em cache são os dados, e o `computeStats` em memória é barato. A query lê todas as linhas sem `WHERE`, por isso o plano ótimo é leitura sequencial com hash joins (verificado com `EXPLAIN` em 12 000 linhas: 39 ms). **Não foram precisos índices novos nem migração.**
- **Ranking: interação sem JS:** período, ordenação da tabela e chips do gráfico são links (`?periodo=`, `?ordem=`, `?linhas=`) e o gráfico é SVG desenhado no servidor. O único componente cliente novo é o botão "Partilhar ranking".
- **Ranking: regras não especificadas:** um resultado de 0 € interrompe sequências de vitórias e de derrotas. Sequências contam as sessões consecutivas *do jogador*, não as do grupo. Quando o desempate pelo "mais recente" também empata (ex.: duas pessoas com 100 % de presença), ganha a ordem alfabética. O Fantasma usa as sessões do período escolhido. O Pilar da mesa compara presenças no período. A posição no ranking é sempre por lucro, mesmo com a tabela ordenada por outra coluna.
- **Ranking: cores do gráfico:** as linhas usam 8 cores claras próprias (além de dourado, verde e marfim da paleta), para se distinguirem sobre o feltro; o nome no fim de cada linha evita depender da cor.
- **Navegação com 5 itens:** "Ranking" entrou na barra inferior. Verificado a 375 px: cada item tem 66 px e o texto mais largo ("Sessões"/"Ranking") ocupa 53 px, sem overflow nem texto cortado.
- **Seed:** a 3.ª sessão de exemplo passou de "falta um cash-out" para "sobram 3 €, ajuste igual por todos", para o seed ter 3 sessões válidas (o gráfico precisa de 3) e mostrar também um ajuste.
- **Sem paginação na lista de sessões** (um grupo de amigos tem poucas dezenas por ano); usa `content-visibility: auto` para o scroll se manter fluido.

## Estrutura

```
app/            rotas (App Router); (app)/ = páginas com navegação; sw.ts = service worker
components/ui/  Card, Button, Sheet, Nav, Chip, ChipStack, Money, Ticket, SuitDivider, Skeleton
components/     ilhas cliente pequenas (sessão, fecho, perfil) e blocos de página
lib/            settle.ts e reconcile.ts (cálculos puros), config.ts, ledger.ts, players.ts, admin.ts, identity.ts, queries.ts, actions/, live/ (versão da sessão)
prisma/         schema, migrações, seed (só dev)
tests/          Vitest
```
