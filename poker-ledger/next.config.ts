import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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
