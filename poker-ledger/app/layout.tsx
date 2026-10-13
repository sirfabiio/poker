import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

// Única fonte web: títulos e valores grandes.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: { default: "Poker Ledger", template: "%s · Poker Ledger" },
  description: "As contas do poker do grupo, sem complicações.",
  applicationName: "Poker Ledger",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Poker" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06231A",
  colorScheme: "dark",
};

// Capta cedo os avisos do service worker (antes de o React montar): "esta página tinha versão mais nova"
// e "o servidor redirecionou esta página" (ex.: sessão terminada) → recarrega uma vez para seguir o redirecionamento.
const SW_STALE_SCRIPT =
  "navigator.serviceWorker&&navigator.serviceWorker.addEventListener('message',function(e){var d=e.data;if(!d)return;if(d.type==='page-updated'){window.__plStale=1;dispatchEvent(new Event('pl-stale'))}else if(d.type==='page-redirected'&&d.url.split('#')[0]===location.href.split('#')[0]){var k='pl-redir:'+location.pathname,n=Date.now(),t=0;try{t=+sessionStorage.getItem(k)||0;sessionStorage.setItem(k,n)}catch(x){}if(n-t>3000)location.reload()}})";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={fraunces.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SW_STALE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
