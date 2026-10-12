import { describe, expect, it } from "vitest";
import { configuredMasterKey, masterKeyMatches } from "@/lib/master-key";

describe("chave mestra (ADMIN_PIN)", () => {
  it("sem variável ou fraca: desligada", () => {
    expect(configuredMasterKey({} as NodeJS.ProcessEnv)).toBeNull();
    expect(configuredMasterKey({ ADMIN_PIN: "12345" } as NodeJS.ProcessEnv)).toBeNull();
    expect(configuredMasterKey({ ADMIN_PIN: "12ab5678" } as NodeJS.ProcessEnv)).toBeNull();
  });
  it("com pelo menos 6 algarismos: ligada", () => {
    expect(configuredMasterKey({ ADMIN_PIN: "123456" } as NodeJS.ProcessEnv)).toBe("123456");
  });
  it("só aceita a chave exata", () => {
    expect(masterKeyMatches("987654321", "987654321")).toBe(true);
    expect(masterKeyMatches("98765432", "987654321")).toBe(false);
    expect(masterKeyMatches("", "987654321")).toBe(false);
  });
});
