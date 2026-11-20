// Direct provider transport for Node (recording runs). Same request bodies and error classes as the edge relay.
import { PROVIDERS, chatBody, classifyHttp, readCompletion, withRateRetry, LlmError } from "../../src/lib/core/llm.ts";

export function nodeTransport(keys, { onWait } = {}) {
  return {
    async complete(req) {
      const p = PROVIDERS[req.provider];
      const key = keys[req.provider];
      if (p.keyPrefix && !key) throw new LlmError("no-key", `No ${p.name} key in the environment.`);
      return withRateRetry(async () => {
        const t0 = Date.now();
        let res;
        try {
          res = await fetch(`${p.base}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify(chatBody({ ...req, stream: false })),
          });
        } catch (e) {
          throw new LlmError("network", e.message);
        }
        const body = await res.text();
        if (!res.ok) throw classifyHttp(res.status, body, res.headers.get("retry-after"));
        return readCompletion(JSON.parse(body), req.model, Date.now() - t0);
      }, (ms) => onWait?.(ms, req.model));
    },
  };
}
