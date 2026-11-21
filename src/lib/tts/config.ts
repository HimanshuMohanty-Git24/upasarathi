// Local text-to-speech, entirely in the browser: no key, no server. Two engines, each in its own module worker under
// public/tts/ so Next never bundles the runtimes; every script is loaded from a pinned CDN URL and every model from
// Hugging Face, then kept in the browser's Cache API.
//
//   English narration of translations and Śaṅkara's commentary: Kokoro-82M (kokoro-js, q8 ONNX on WASM), with the
//   browser's own speechSynthesis as the zero-download "Quick Read".
//   Sanskrit recitation where no human recording exists: Vāgdhenu (IISc Bengaluru, Prof. Prathosh A P), the
//   flow-matching śloka-to-chant model, ported to ONNX Runtime Web by Hemanth HM. It chants in classical meter and
//   has no Vedic svaras (udātta, anudātta, svarita), so it is never presented as a Vedic recitation.

/** The exact badge on every synthesized chant. */
export const AI_CHANT_BADGE = "AI Chant · Vāgdhenu (classical meter, no Vedic svaras)";

export const KOKORO = {
  worker: "/tts/kokoro-worker.js",
  lib: "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js",
  model: "onnx-community/Kokoro-82M-v1.0-ONNX",
  dtype: "q8",
  /** onnx/model_quantized.onnx, the file kokoro-js loads for dtype "q8" (bytes, from the Hub listing). */
  modelBytes: 92_361_116,
  /** The one file whose presence in the browser cache means the voice is downloaded. */
  modelUrl: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx",
  cacheName: "transformers-cache",
  sampleRate: 24_000,
} as const;

export const KOKORO_VOICES = [
  { id: "bm_george", label: "George", note: "British, male" },
  { id: "af_heart", label: "Heart", note: "American, female" },
  { id: "bf_emma", label: "Emma", note: "British, female" },
  { id: "am_michael", label: "Michael", note: "American, male" },
] as const;
export type KokoroVoice = (typeof KOKORO_VOICES)[number]["id"];

export const SPEEDS = [0.8, 1, 1.25, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];

export const VAGDHENU = {
  worker: "/tts/vagdhenu-worker.js",
  /** The browser engine (sanskrit-tts-web dist/index.mjs), pinned to a commit. */
  lib: "https://cdn.jsdelivr.net/gh/hemanth/sanskrit-tts-web@aedd58f6f96d13b24b4899dc4faec0bcc8b53fdc/dist/index.mjs",
  ort: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.all.min.mjs",
  /** WebGPU weights and the CPU (MatMulInteger) weights; the engine picks one by what the browser supports. */
  repos: { webgpu: "gnumanth/sanskrit-tts-onnx", wasm: "gnumanth/sanskrit-tts-wasm" },
  /** Weights + prosody bank, from the Hub listings (bytes): WebGPU 297.4 MB, CPU 296.0 MB; plus 23.8 MB of runtime. */
  bytes: { webgpu: 297_421_278, wasm: 296_041_287, runtime: 23_824_254 },
  /** The engine's own Cache API bucket and its largest file, to tell whether the model is already here. */
  cacheName: "vagdhenu-models-v10",
  probe: [
    "https://huggingface.co/gnumanth/sanskrit-tts-wasm/resolve/main/vagdhenu_dit_step_q8.onnx",
    "https://huggingface.co/gnumanth/sanskrit-tts-onnx/resolve/main/vagdhenu_dit_step_q8.onnx",
  ],
  sampleRate: 24_000,
  /** Bumped if the engine, seed or segmentation changes, so stale audio is not replayed. */
  audioTag: "vagdhenu-v10-s60-1",
} as const;

export const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;
