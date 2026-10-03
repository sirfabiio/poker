import { describe, expect, it } from "vitest";
import { makeAdminToken, pinMatches, verifyAdminToken, ADMIN_TTL_SECONDS } from "@/lib/admin";

describe("sessão de admin", () => {
  const pin = "246810";
  it("aceita só o PIN certo", () => {
    expect(pinMatches("246810", pin)).toBe(true);
    expect(pinMatches("000000", pin)).toBe(false);
    expect(pinMatches("", pin)).toBe(false);
  });
  it("token válido durante 12h, depois expira", () => {
    const now = Date.now();
    const t = makeAdminToken(pin, now);
    expect(verifyAdminToken(t, pin, now)).toBe(true);
    expect(verifyAdminToken(t, pin, now + (ADMIN_TTL_SECONDS + 1) * 1000)).toBe(false);
  });
  it("rejeita tokens forjados, vazios ou de outro PIN", () => {
    const t = makeAdminToken(pin);
    expect(verifyAdminToken(undefined, pin)).toBe(false);
    expect(verifyAdminToken("", pin)).toBe(false);
    expect(verifyAdminToken(t, "135790")).toBe(false);
    const [exp] = t.split(".");
    expect(verifyAdminToken(`${Number(exp) + 9999}.${t.split(".")[1]}`, pin)).toBe(false);
  });
});
