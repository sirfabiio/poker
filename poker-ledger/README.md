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

## Decisões

- **Next.js 15.5 em vez de 16.** O build do Next 16 já não mostra o tamanho do "First Load JS" (necessário para verificar o orçamento de 120 KB) e usa Turbopack por omissão, que o plugin `@serwist/next` não suporta. O 15.5 é mantido e constrói com webpack.
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
- **Service worker:** pré-cache do JS/CSS, da fonte, dos ícones e da página `/offline`. Páginas (HTML) em **stale-while-revalidate**: arranque imediato e, se a versão nova for diferente, a app faz `router.refresh()` logo a seguir. Os dados RSC das navegações dentro da app usam **network-first** (4 s) com a cache só como recurso offline: com SWR, o `router.refresh()` recebia dados antigos e escondia saldos atualizados. Nunca vão para a cache: pedidos não-GET (todas as escritas são Server Actions = POST), pedidos com o cabeçalho `Next-Action`, e `/admin`.
- **Loading:** `loading.tsx` (skeletons) em todas as rotas secundárias. A rota principal `/` não tem um: com o boundary, o React só revelava o conteúdo ~300 ms depois do HTML chegar, o que atrasava o LCP. Ao navegar para `/`, o ecrã anterior fica visível até a página chegar (nunca em branco).
- **Redirect sem perfil:** feito na página (não em middleware) para não haver uma função extra em cada pedido; na primeira visita o redirect para "Quem és tu?" acontece no browser.
- **Datas:** `Session.date` é `DATE` (sem hora); horas mostradas em Europe/Lisbon.
- **Sem paginação na lista de sessões** (um grupo de amigos tem poucas dezenas por ano); usa `content-visibility: auto` para o scroll se manter fluido.

## Estrutura

```
app/            rotas (App Router); (app)/ = páginas com navegação; sw.ts = service worker
components/ui/  Card, Button, Sheet, Nav, Chip, ChipStack, Money, Ticket, SuitDivider, Skeleton
components/     ilhas cliente pequenas (sessão, fecho, perfil) e blocos de página
lib/            settle.ts e reconcile.ts (cálculos puros), config.ts, ledger.ts, players.ts, admin.ts, identity.ts, queries.ts, actions/
prisma/         schema, migrações, seed (só dev)
tests/          Vitest
```
