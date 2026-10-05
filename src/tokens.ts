import { getEncoding } from "js-tiktoken";
import type { RawTool, ToolMeasure } from "./types.js";

export const TOKENIZER_NAME = "cl100k_base";
export const TOKENIZER_NOTE =
  "proxy tokenizer: comparable across servers, not provider-native (up to ~15% off)";

let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) encoder = getEncoding("cl100k_base");
  return encoder;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function toolText(tool: RawTool): string {
  const schema = tool.inputSchema === undefined ? "{}" : JSON.stringify(tool.inputSchema);
  return `${tool.name}\n${tool.description ?? ""}\n${schema}`;
}

export function measureTool(tool: RawTool): ToolMeasure {
  const descriptionChars = (tool.description ?? "").length;
  const schemaChars =
    (tool.inputSchema === undefined ? "{}" : JSON.stringify(tool.inputSchema)).length;
  const text = toolText(tool);
  const chars = text.length;
  return {
    name: tool.name,
    tokens: countTokens(text),
    chars,
    estimate: estimateTokens(chars),
    descriptionChars,
    schemaChars,
  };
}