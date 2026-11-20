"use client";
import { useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/core/llm";
import { getSettings, saveSettings, useSettings } from "@/lib/client/settings";
import { browserTransport } from "@/lib/client/transport";
import { IconClose, IconExternal } from "@/components/ui/Icons";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const [provider, setProvider] = useState<ProviderId>(s.provider);
  const [key, setKey] = useState(s.keys[s.provider] || "");
  const [model, setModel] = useState(s.model);
  const [judgeModel, setJudgeModel] = useState(s.judgeModel);
  const [test, setTest] = useState<string | null>(null);
  const p = PROVIDERS[provider];

  const choose = (id: ProviderId) => {
    setProvider(id);
    setKey(getSettings().keys[id] || "");
    setModel(PROVIDERS[id].defaultModel);
    setJudgeModel(PROVIDERS[id].defaultJudge);
  };
  const save = () => {
    saveSettings({ provider, model, judgeProvider: provider, judgeModel, keys: { ...getSettings().keys, [provider]: key.trim() } });
    onClose();
  };
  const runTest = async () => {
    saveSettings({ provider, model, keys: { ...getSettings().keys, [provider]: key.trim() } });
    setTest("Testing…");
    try {
      const r = await browserTransport().complete({ provider, model, maxTokens: 64, temperature: 0, messages: [{ role: "user", content: "Reply with the single word OK." }] });
      setTest(`Connected: ${r.model} replied in ${r.ms} ms.`);
    } catch (e) {
      setTest(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className="card w-full max-w-[520px] p-5 shadow-[var(--shadow)]" role="dialog" aria-modal="true" aria-label="Language model" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bring your own key</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <p className="mt-1 text-[13.5px] text-text-3">
          Only live harness runs need a model. The key stays in this browser and is sent, per request, through this site&apos;s relay to the provider you choose. Nothing is stored on the server.
        </p>
        <label className="mt-4 block text-[13px] font-semibold">Provider</label>
        <div className="mt-1 flex gap-2">
          {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => (
            <button key={id} className={`btn btn-sm ${provider === id ? "btn-accent" : ""}`} onClick={() => choose(id)}>{PROVIDERS[id].name}</button>
          ))}
        </div>
        {p.keyPrefix && (
          <>
            <label className="mt-4 block text-[13px] font-semibold" htmlFor="key">API key</label>
            <input id="key" type="password" autoComplete="off" placeholder={`${p.keyPrefix}…`} value={key} onChange={(e) => setKey(e.target.value)} />
            <a className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-text-3 underline" href={p.keyUrl} target="_blank" rel="noreferrer">Get a free {p.name} key <IconExternal size={12} /></a>
          </>
        )}
        <label className="mt-4 block text-[13px] font-semibold" htmlFor="model">Model under test (baseline and re-aligned)</label>
        <input id="model" list="models" value={model} onChange={(e) => setModel(e.target.value)} />
        <label className="mt-3 block text-[13px] font-semibold" htmlFor="judge">Judge model</label>
        <input id="judge" list="models" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)} />
        <p className="mt-1 text-[12.5px] text-text-3">A different judge is preferred. If it is the same model, results carry a visible &ldquo;same-model judge&rdquo; badge (self-preference risk).</p>
        <datalist id="models">{p.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</datalist>
        {test && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{test}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={runTest} disabled={Boolean(p.keyPrefix) && !key.trim()}>Test</button>
          <button className="btn btn-accent" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
