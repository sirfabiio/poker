import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseEuros } from "@/lib/money";

describe("dinheiro em cêntimos", () => {
  it("converte texto sem floats", () => {
    expect(parseEuros("20")).toBe(2000);
    expect(parseEuros("12,5")).toBe(1250);
    expect(parseEuros("0.10")).toBe(10);
    expect(parseEuros("1 200,99 €")).toBe(120099);
    expect(parseEuros("19,99")).toBe(1999);
    expect(parseEuros("-5")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("1,234")).toBeNull();
  });
  it("formata em pt-PT", () => {
    expect(formatCents(1250).replace(/\s/g, " ")).toBe("12,50 €");
    expect(centsToInput(1205)).toBe("12,05");
  });
});
