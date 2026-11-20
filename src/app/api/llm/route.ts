// The only server code: a stateless relay for bring-your-own-key chat completions (Groq, OpenRouter, local Ollama).
// No database, no stored keys, no retrieval. The browser sends the full request; this forwards it with the key.
import { PROVIDERS, chatBody, classifyHttp, isProvider, readCompletion, sseDeltas, LlmError, type LlmRequest } from "@/lib/core/llm";
import { isLocalRequest } from "@/lib/server/guard";

export const runtime = "edge";

const META_SEP = "\u0000";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (e: LlmError) => json({ error: { code: e.code, message: e.message, retryAfterMs: e.retryAfterMs } }, e.status && e.status < 600 ? e.status : e.code === "no-key" ? 401 : 502);

export async function POST(req: Request) {
  let body: Partial<LlmRequest> & { baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return fail(new LlmError("bad-request", "Invalid JSON body", 400));
  }
  if (!isProvider(body.provider)) return fail(new LlmError("bad-request", "Unknown provider", 400));
  if (!body.model || !Array.isArray(body.messages) || !body.messages.length) return fail(new LlmError("bad-request", "Missing model or messages", 400));
  const local = isLocalRequest(req);
  const p = PROVIDERS[body.provider];
  const envKey = local && p.keyPrefix ? process.env[body.provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"] : undefined;
  const key = req.headers.get("x-upasarathi-key")?.trim() || envKey?.trim();
  if (p.keyPrefix && !key) return fail(new LlmError("no-key", `No ${p.name} key. Add one in Settings.`, 401));
  if (body.provider === "ollama" && !local) return fail(new LlmError("bad-request", "Ollama is only available when UpaSārathi runs on your own computer.", 400));
  const base = body.provider === "ollama" ? `${(body.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "").replace(/\/v1$/, "")}/v1` : p.base;

  const messages = body.messages.slice(0, 12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 24000) }));
  const request: LlmRequest = { provider: body.provider, model: String(body.model).slice(0, 120), messages, temperature: body.temperature, maxTokens: body.maxTokens, json: body.json, reasoning: body.reasoning, stream: Boolean(body.stream) };
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) };
  if (body.provider === "openrouter") Object.assign(headers, { "HTTP-Referer": "https://github.com/upasarathi", "X-Title": "UpaSarathi" });

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(chatBody(request)), signal: req.signal });
  } catch (e) {
    return fail(new LlmError("network", (e as Error).message, 502));
  }
  if (!res.ok) return fail(classifyHttp(res.status, await res.text(), res.headers.get("retry-after")));

  if (!request.stream) {
    try {
      const r = readCompletion(await res.json(), request.model, Date.now() - t0);
      return json(r);
    } catch (e) {
      return fail(e instanceof LlmError ? e : new LlmError("upstream", (e as Error).message, 502));
    }
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finish: string | null = null;
      try {
        for await (const d of sseDeltas(res.body!)) {
          if (d.delta) controller.enqueue(enc.encode(d.delta.replace(/\u0000/g, "")));
          if (d.finish) finish = d.finish;
        }
        controller.enqueue(enc.encode(META_SEP + JSON.stringify({ model: request.model, finish })));
      } catch (e) {
        const err = e instanceof LlmError ? e : new LlmError("upstream", (e as Error).message);
        controller.enqueue(enc.encode(META_SEP + JSON.stringify({ model: request.model, finish, error: { code: err.code, message: err.message } })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
