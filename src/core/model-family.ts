/**
 * Map a model identifier to a family (provider/architecture). Used by:
 *   - the install-completeness `roles-distinct-models` check (Layer A1),
 *   - the dynamic-eval producer/judge divergence check (Layer B, score.mjs save).
 *
 * The point is to catch the case where claude-sonnet-4.5 and claude-sonnet-4.6
 * (different ids, same family) are used for producer + reviewer — which defeats
 * the whole single-model-bias mitigation principle. String compare is not enough.
 *
 * Conservative classifier: if we can't recognize the id, return the id verbatim
 * so the check stays strict. Add ids here as new model families ship.
 */
export type ModelFamily =
  | "anthropic-claude"
  | "openai-gpt"
  | "google-gemini"
  | "mistral"
  | "deepseek"
  | "meta-llama"
  | "xai-grok"
  | "cohere"
  | "qwen"
  | string;

const PATTERNS: Array<{ family: ModelFamily; test: RegExp }> = [
  { family: "anthropic-claude", test: /^(anthropic[\.\/-])?claude([-_\.]|$)/i },
  { family: "openai-gpt", test: /^(openai[\.\/-])?(gpt|o[1-9]|codex|davinci|chatgpt)([-_\.]|$)/i },
  { family: "google-gemini", test: /^(google[\.\/-])?(gemini|palm|bard|flash)([-_\.]|$)/i },
  { family: "mistral", test: /^(mistral|mixtral|codestral|ministral)([-_\.]|$)/i },
  { family: "deepseek", test: /^deepseek([-_\.]|$)/i },
  { family: "meta-llama", test: /^(meta[\.\/-])?(llama|code-?llama)([-_\.]|$)/i },
  { family: "xai-grok", test: /^(xai[\.\/-])?grok([-_\.]|$)/i },
  { family: "cohere", test: /^(cohere[\.\/-])?(command|aya)([-_\.]|$)/i },
  { family: "qwen", test: /^qwen([-_\.]|$)/i },
];

export function modelFamily(modelId: string): ModelFamily {
  const id = modelId.trim();
  if (!id) return "";
  for (const p of PATTERNS) if (p.test.test(id)) return p.family;
  // Unknown family — return a stable token derived from the id prefix.
  const m = id.match(/^([a-z0-9]+)/i);
  return m ? `unknown:${m[1]!.toLowerCase()}` : `unknown:${id}`;
}

/** True if two model ids belong to the same family (or are literally identical). */
export function sameFamily(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return modelFamily(a) === modelFamily(b);
}
