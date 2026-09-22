// Offline transcription: Whisper runs fully in-browser via WebAssembly.
// No Google service, no API key, no audio leaves the device. The model
// downloads once (~150MB) and is cached by the browser afterwards.
//
// NOTE: @xenova/transformers is lazy-imported inside loadTranscriber so a
// missing/failed WASM bundle never blanks the whole app at startup. The
// ~1MB+ lib is split into its own chunk and only loads on first mic use.

const MODEL_ID = "Xenova/whisper-tiny";

type ProgressCallback = (percent: number) => void;

let transcriber: any = null;
let loading: Promise<any> | null = null;

export const isTranscriberReady = () => transcriber !== null;

export const loadTranscriber = (onProgress?: ProgressCallback): Promise<any> => {
  if (transcriber) return Promise.resolve(transcriber);
  if (!loading) {
    loading = import("@xenova/transformers")
      .then(({ env, pipeline }) => {
        env.allowLocalModels = false;
        return pipeline("automatic-speech-recognition", MODEL_ID, {
          progress_callback: (p: any) => {
            if (p?.status === "progress" && typeof p.progress === "number") {
              onProgress?.(Math.round(p.progress));
            }
          },
        });
      })
      .then((t) => {
        transcriber = t;
        return t;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
};

// Decode any recorded blob (webm/opus from MediaRecorder) to 16kHz mono PCM,
// the exact input Whisper expects. The sampleRate hint resamples automatically.
export const blobToSpeechAudio = async (blob: Blob): Promise<Float32Array> => {
  const buffer = await blob.arrayBuffer();
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio is not supported on this device.");
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(buffer);
    return decoded.getChannelData(0);
  } finally {
    void ctx.close().catch(() => undefined);
  }
};

// Device locale → Whisper language (Hindi/English mix is our common case).
export const deviceSpeechLanguage = (): string => {
  const locale = (navigator.language || "en").toLowerCase();
  if (locale.startsWith("hi")) return "hindi";
  return "english";
};

export const transcribeSpeechAudio = async (
  audio: Float32Array,
  language?: string
): Promise<string> => {
  const pipe = await loadTranscriber();
  const output = await pipe(audio, {
    language: language || deviceSpeechLanguage(),
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = Array.isArray(output)
    ? output.map((o: any) => o?.text || "").join(" ")
    : output?.text || "";
  return text.trim();
};
