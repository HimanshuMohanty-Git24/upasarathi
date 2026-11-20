// OpenAI-compatible chat for every BYOK provider, shared by the edge relay, the browser and the recorder.

export type ProviderId = "groq" | "openrouter" | "ollama";
export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  base: string;
  keyPrefix: string | null;
  keyUrl: string;
  json: boolean;
  defaultModel: string;
  defaultJudge: string;
  models: { id: string; label: string }[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq: {
    id: "groq", name: "Groq", base: "https://api.groq.com/openai/v1", keyPrefix: "gsk_", keyUrl: "https://console.groq.com/keys", json: true,
    defaultModel: "openai/gpt-oss-20b", defaultJudge: "openai/gpt-oss-120b",
    models: [
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
    ],
  },
  openrouter: {
    id: "openrouter", name: "OpenRouter", base: "https://openrouter.ai/api/v1", keyPrefix: "sk-or-", keyUrl: "https://openrouter.ai/keys", json: false,
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free", defaultJudge: "google/gemma-3-27b-it:free",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
      { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)" },
      { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (free)" },
    ],
  },
  ollama: {
    id: "ollama", name: "Ollama (this computer)", base: "http://localhost:11434/v1", keyPrefix: null, keyUrl: "https://ollama.com/download", json: true,
    defaultModel: "llama3.1", defaultJudge: "qwen2.5",
    models: [
      { id: "llama3.1", label: "Llama 3.1 8B" },
      { id: "qwen2.5", label: "Qwen 2.5 7B" },
    ],
  },
};
export const isProvider = (s: unknown): s is ProviderId => typeof s === "string" && s in PROVIDERS;

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  messages: Msg[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  reasoning?: "low" | "medium" | "high";
  stream?: boolean;
}
export interface LlmResult {
  text: string;
  model: string;
  ms: number;
  finish: string | null;
}
export type LlmErrorCode = "no-key" | "auth" | "model" | "rate-minute" | "rate-daily" | "empty" | "upstream" | "network" | "bad-request";

export class LlmError extends Error {
  code: LlmErrorCode;
  status: number;
  retryAfterMs: number | null;
  constructor(code: LlmErrorCode, message: string, status = 0, retryAfterMs: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Reasoning models spend tokens thinking before they answer; give them headroom or they return nothing. */
export const isReasoningModel = (m: string) => /gpt-oss|qwen3|deepseek-r1|\bo[134]\b|reason|think/i.test(m);
export const REASONING_MIN_TOKENS = 4096;

export function chatBody(req: LlmRequest): Record<string, unknown> {
  const p = PROVIDERS[req.provider];
  const max = isReasoningModel(req.model) ? Math.max(req.maxTokens ?? 0, REASONING_MIN_TOKENS) : req.maxTokens ?? 1400;
  return {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: max,
    stream: Boolean(req.stream),
    ...(req.json && p.json ? { response_format: { type: "json_object" } } : {}),
    ...(req.reasoning && req.provider === "groq" && /gpt-oss/.test(req.model) ? { reasoning_effort: req.reasoning } : {}),
  };
}

function parseRetryAfter(header: string | null, body: string): number | null {
  if (header && /^\d+(\.\d+)?$/.test(header.trim())) return Math.ceil(Number(header) * 1000);
  const m = body.match(/try again in\s+(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?\s*(?:(\d+)ms)?/i);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Math.ceil(Number(m[1] || 0) * 60000 + Number(m[2] || 0) * 1000 + Number(m[3] || 0));
}

/** Turn a provider HTTP failure into a typed error. A per-minute 429 is retryable; a daily quota is not. */
export function classifyHttp(status: number, body: string, retryAfter: string | null = null): LlmError {
  let msg = body.slice(0, 400);
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    msg = (typeof j.error === "string" ? j.error : j.error?.message) || j.message || msg;
  } catch {
    /* not JSON */
  }
  if (status === 401 || status === 403) return new LlmError("auth", `The provider rejected the API key (${status}).`, status);
  if (status === 404 || /model[_ ]not[_ ]found|does not exist|decommissioned|no endpoints found/i.test(msg)) return new LlmError("model", `Model unavailable: ${msg}`, status);
  if (status === 429) {
    if (/per day|\(RPD\)|\(TPD\)|daily|free-models-per-day|requests per day|tokens per day|quota/i.test(msg)) return new LlmError("rate-daily", `Daily limit reached for this key: ${msg}`, status);
    return new LlmError("rate-minute", `Rate limited for a moment: ${msg}`, status, parseRetryAfter(retryAfter, msg) ?? 6000);
  }
  if (status >= 500) return new LlmError("upstream", `Provider error ${status}: ${msg}`, status);
  return new LlmError("bad-request", msg || `HTTP ${status}`, status);
}

export function readCompletion(json: unknown, model: string, ms: number): LlmResult {
  const j = json as { model?: string; choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
  const text = (j.choices?.[0]?.message?.content ?? "").trim();
  const finish = j.choices?.[0]?.finish_reason ?? null;
  if (!text) throw emptyError(finish);
  return { text, model: j.model || model, ms, finish };
}

export function emptyError(finish: string | null): LlmError {
  return new LlmError(
    "empty",
    finish === "length" ? "The model used its whole token budget (likely on reasoning) and returned no answer." : "The model returned an empty answer.",
  );
}

/** Text deltas from an OpenAI-compatible SSE stream. */
export async function* sseDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<{ delta: string; finish: string | null }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[]; error?: { message?: string } };
        if (j.error) throw new LlmError("upstream", j.error.message || "stream error");
        const c = j.choices?.[0];
        if (c?.delta?.content || c?.finish_reason) yield { delta: c.delta?.content || "", finish: c.finish_reason ?? null };
      } catch (e) {
        if (e instanceof LlmError) throw e;
      }
    }
  }
}

/** Retry per-minute rate limits (bounded); stop immediately on a daily quota or any other error. */
export async function withRateRetry<T>(fn: () => Promise<T>, onWait?: (ms: number) => void, max = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof LlmError) || e.code !== "rate-minute" || attempt >= max) throw e;
      const ms = Math.min(e.retryAfterMs ?? 6000, 30000) + 400;
      onWait?.(ms);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}
