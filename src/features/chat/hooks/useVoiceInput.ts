import { useEffect, useRef, useState } from "react";
import {
  getActiveTranscriber,
  savedKeyForProvider,
  transcribeAudioBlob,
} from "../../../lib/transcribe";
import { loadTranscriber } from "../voice/whisper";

export type VoicePhase = "idle" | "loading" | "recording" | "processing";

type UseVoiceInputOptions = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  compressing?: boolean;
};

// Record-then-transcribe: tap mic → RECORDING, tap mic/stop again →
// PROCESSING (decode + transcribe the WHOLE clip), then the full transcript
// is placed into the composer via onTranscript for review before send.
// Offline push-to-talk: MediaRecorder captures mic audio, Whisper (WASM,
// on-device) transcribes it. No Google service involved, so no system toasts.
export const useVoiceInput = ({
  onTranscript,
  disabled,
  streaming,
  compressing,
}: UseVoiceInputOptions) => {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    if (disabled || streaming || compressing) return;
    if (recorderRef.current?.state === "recording") return;
    if (!supported) {
      setError("Voice input is not supported on this device.");
      return;
    }
    setError(null);

    // Cloud transcriber chosen (provider + key saved) needs no local model —
    // skip the ~150MB download and go straight to the mic.
    const cloudActive = (() => {
      const active = getActiveTranscriber();
      return !!active && !!savedKeyForProvider(active.provider);
    })();
    if (!cloudActive) {
      // 1. Model first (one-time ~150MB download, cached afterwards).
      setPhase("loading");
      setProgress(0);
      try {
        await loadTranscriber((p) => setProgress(p));
      } catch {
        setPhase("idle");
        setError("Could not load the speech model. Check connection and retry.");
        return;
      }
    }

    // 2. Then the mic.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
    } catch {
      setPhase("idle");
      setError("Microphone blocked. Allow mic permission and try again.");
    }
  };

  const stop = async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    // Recording stopped → PROCESSING: decode + transcribe the WHOLE clip.
    setPhase("processing");
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          })
        );
      recorder.stop();
    });
    stopStream();
    try {
      // Cloud transcriber when one is chosen + keyed, else on-device default.
      const result = await transcribeAudioBlob(blob);
      setPhase("idle");
      if (result?.text) {
        onTranscriptRef.current(result.text);
      } else {
        setError("Could not hear anything. Try again.");
      }
    } catch {
      setPhase("idle");
      setError("Transcription failed. Try again.");
    }
  };

  useEffect(
    () => () => {
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignore cleanup errors
      }
      stopStream();
    },
    []
  );

  return {
    supported,
    phase,
    progress,
    error,
    start,
    stop,
    clearError: () => setError(null),
  };
};

export type VoiceInputApi = ReturnType<typeof useVoiceInput>;
