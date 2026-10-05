import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import withSerwistInit from "@serwist/next";

// O React do Next 15.5 tem de levar a correção do ping (scripts/patch-react-ping.mjs, corre no postinstall).
// Sem ela, uma Server Action ou navegação pode ficar presa no ecrã antigo. Recusa construir sem a correção.
const REACT_PING_FIX = "react-ping-fix-1";
const reactDomClient = readFileSync(require.resolve("next/dist/compiled/react-dom/cjs/react-dom-client.production.js"), "utf8");
if (!/\? 0 === \(executionContext & 2\)\s*\?\s*prepareFreshStack\(root, 0\)/.test(reactDomClient)) {
  throw new Error("Falta a correção do React (ping perdido). Corre `node scripts/patch-react-ping.mjs` (ou `npm install`).");
}

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Em desenvolvimento o service worker atrapalha (cache); só existe no build de produção.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  // Registo manual em components/OfflineBanner.tsx: o registo automático do Serwist lança
  // "Cannot read properties of undefined (reading 'waiting')" quando o browser bloqueia service workers.
  register: false,
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    // A cache do webpack identifica node_modules pela versão do pacote, não pelo conteúdo: sem isto, uma cache
    // antiga (ex.: a cache de build da Vercel) podia trazer de volta o react-dom sem a correção.
    if (config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      config.cache.version = `${config.cache.version ?? ""}|${REACT_PING_FIX}`;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
