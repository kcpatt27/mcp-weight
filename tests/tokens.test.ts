import { test } from "node:test";
import assert from "node:assert/strict";
import { countTokens, estimateTokens, measureTool, toolText } from "../src/tokens.js";

test("countTokens handles empty input and scales with length", () => {
  assert.equal(countTokens(""), 0);
  const short = countTokens("hello world");
  const long = countTokens("hello world ".repeat(50));
  assert.ok(short > 0 && short < 10, `short=${short}`);
  assert.ok(long > short, `${long} should exceed ${short}`);
});

test("estimateTokens is ceil(chars/4)", () => {
  assert.equal(estimateTokens(0), 0);
  assert.equal(estimateTokens(1), 1);
  assert.equal(estimateTokens(4), 1);
  assert.equal(estimateTokens(5), 2);
});

test("measureTool reports tokens, chars, and components", () => {
  const tool = {
    name: "demo",
    description: "Does a demo thing.",
    inputSchema: { type: "object", properties: { a: { type: "string" } } },
  };
  const m = measureTool(tool);
  assert.equal(m.name, "demo");
  assert.ok(m.tokens > 0);
  assert.equal(m.chars, toolText(tool).length);
  assert.equal(m.estimate, Math.ceil(m.chars / 4));
  assert.equal(m.descriptionChars, tool.description.length);
  assert.ok(m.schemaChars > 0);
});

test("a longer description costs more tokens", () => {
  const base = { name: "t", inputSchema: { type: "object", properties: {} } };
  const small = measureTool({ ...base, description: "short" });
  const big = measureTool({ ...base, description: "much longer description ".repeat(20) });
  assert.ok(big.tokens > small.tokens);
});