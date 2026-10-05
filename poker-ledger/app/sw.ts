/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Nunca guardar em cache: área de admin (sessão de admin) e qualquer pedido que não seja GET
// (as escritas são Server Actions = POST, e nunca passam pela cache).
const NEVER_CACHE = ["/admin"];

/** Só guarda respostas 200 que não sejam redirecionamentos. */
const okOnly: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => (response.status === 200 && !response.redirected ? response : null),
};

/** Quando uma página servida da cache tem versão nova, avisa a app para se refrescar. */
const notifyOnChange: SerwistPlugin = {
  cacheDidUpdate: async ({ oldResponse, newResponse, request }) => {
    if (!oldResponse) return;
    const [a, b] = await Promise.all([oldResponse.clone().text(), newResponse.clone().text()]);
    if (a === b) return;
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) c.postMessage({ type: "page-updated", url: request.url });
  },
};

const isNever = (url: URL) => NEVER_CACHE.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
/** Pedidos de dados (RSC das navegações e router.refresh, e /api/*): sempre à rede, para nunca esconderem dados novos. */
const isData = (url: URL, request: Request) =>
  request.headers.get("RSC") === "1" || url.searchParams.has("_rsc") || url.pathname.startsWith("/api/");
/** Página de uma sessão (/sessoes/<id>): muda enquanto se joga. */
const isSessionPage = (url: URL) => /^\/sessoes\/[^/]+\/?$/.test(url.pathname);

const serwist = new Serwist({
  // Pré-cache do app shell: JS/CSS do build, fonte (self-hosted pelo next/font), ícones e página offline.
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin, request }) => !sameOrigin || isNever(url) || request.headers.has("Next-Action"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"),
      handler: new CacheFirst({
        cacheName: "static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      // RSC e /api/* (inclui a verificação de versão da sessão): nunca em cache.
      matcher: ({ url, request }) => isData(url, request),
      handler: new NetworkOnly(),
    },
    {
      // Páginas de sessão: network-first; a cópia em cache só serve quando a rede falha (leitura offline).
      matcher: ({ url, request }) => request.mode === "navigate" && isSessionPage(url),
      handler: new NetworkFirst({
        cacheName: "session-pages",
        plugins: [okOnly, new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 14 })],
      }),
    },
    {
      // Páginas (abrir/recarregar a app): stale-while-revalidate para arrancar logo; se a versão nova
      // for diferente, a app recebe "page-updated" e faz router.refresh() (que vai à rede, acima).
      matcher: ({ request }) => request.mode === "navigate",
      handler: new StaleWhileRevalidate({
        cacheName: "pages",
        plugins: [okOnly, notifyOnChange, new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 14 })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.mode === "navigate" }],
  },
});

serwist.addEventListeners();

// A cache "rsc" de versões anteriores deixou de ser usada (os dados RSC já não vão para a cache).
self.addEventListener("activate", (e) => e.waitUntil(caches.delete("rsc")));
