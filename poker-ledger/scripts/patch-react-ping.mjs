// Corrige no React incluído no Next 15.5 (19.2 canary) um "ping" perdido que deixava o ecrã preso no estado antigo
// depois de uma Server Action ou navegação (ver "Decisões" no README). Corre no postinstall; sem dependências.
//
// Quando a renderização de uma transição suspende num chunk RSC que entretanto chegou (estado "resolved_model"),
// o .then() do chunk chama o ping de forma síncrona, ainda dentro da renderização. Com o estado "suspender com atraso",
// o React 19.2 ignorava esse ping e marcava a raiz como suspensa para sempre. A correção é a mesma do React 19.3
// (já presente no react-dom de topo e no Next 16): guardar o ping em workInProgressRootPingedLanes.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const COND = String.raw`(0 === \(executionContext & 2\)|\(executionContext & RenderContext\) === NoContext)`;
const PINGED = String.raw`\(workInProgressRootPingedLanes \|= pingedLanes\)`;
const BUGGY = new RegExp(String.raw`\?\s*${COND}\s*&&\s*prepareFreshStack\(root, 0\)\s*:\s*${PINGED}`, "g");
const FIXED = new RegExp(String.raw`\?\s*${COND}\s*\?\s*prepareFreshStack\(root, 0\)\s*:\s*${PINGED}\s*:\s*${PINGED}`);

const require = createRequire(import.meta.url);
let nextDir;
try {
  nextDir = path.dirname(require.resolve("next/package.json"));
} catch {
  console.log("[patch-react-ping] next não está instalado; nada a fazer.");
  process.exit(0);
}

let patched = 0;
let ok = 0;
for (const channel of ["react-dom", "react-dom-experimental"]) {
  const dir = path.join(nextDir, "dist", "compiled", channel, "cjs");
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(dir, name);
    const src = readFileSync(file, "utf8");
    if (!src.includes("function pingSuspendedRoot(")) continue;
    if (FIXED.test(src)) {
      ok++;
      continue;
    }
    const out = src.replace(BUGGY, (_m, cond) => `? ${cond} ? prepareFreshStack(root, 0) : (workInProgressRootPingedLanes |= pingedLanes) : (workInProgressRootPingedLanes |= pingedLanes)`);
    if (out === src) {
      console.error(`[patch-react-ping] Não reconheci pingSuspendedRoot em ${file}. Revê scripts/patch-react-ping.mjs.`);
      process.exit(1);
    }
    writeFileSync(file, out);
    patched++;
  }
}
console.log(`[patch-react-ping] ${patched} ficheiro(s) corrigido(s), ${ok} já estavam corrigidos.`);
