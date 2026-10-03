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
      // Dados RSC das navegações dentro da app (não guardamos prefetches). Network-first: o router.refresh()
      // e as navegações têm de ver saldos atuais; a cópia em cache só serve para ler offline.
      matcher: ({ request }) => request.headers.get("RSC") === "1" && !request.headers.has("Next-Router-Prefetch"),
      handler: new NetworkFirst({
        cacheName: "rsc",
        networkTimeoutSeconds: 4,
        plugins: [okOnly, new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 })],
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
