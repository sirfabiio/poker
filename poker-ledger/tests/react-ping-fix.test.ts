import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Ver scripts/patch-react-ping.mjs e "Decisões" no README: sem esta correção o ecrã pode ficar preso no estado
// antigo depois de uma Server Action (ex.: "Confirmar ajuste").
const require = createRequire(import.meta.url);
const read = (f: string) => readFileSync(require.resolve(`next/dist/compiled/react-dom/cjs/${f}`), "utf8");

describe("React do Next: ping durante a renderização", () => {
  it.each(["react-dom-client.production.js", "react-dom-client.development.js"])("%s guarda o ping em vez de o perder", (f) => {
    const src = read(f);
    const ping = src.slice(src.indexOf("function pingSuspendedRoot("), src.indexOf("function retryTimedOutBoundary("));
    expect(ping).toMatch(/\?\s*prepareFreshStack\(root, 0\)\s*:\s*\(workInProgressRootPingedLanes \|= pingedLanes\)\s*:/);
    expect(ping).not.toMatch(/&&\s*prepareFreshStack\(root, 0\)/);
  });
});
