import { useEffect, useRef, useState } from "react";
import {
  blobToSpeechAudio,
  loadTranscriber,
  transcribeSpeechAudio,
} from "../voice/whisper";

export type VoicePhase = "idle" | "loading" | "recording" | "transcribing";

type UseVoiceInputOptions = {
  onTranscript: (text: string) => void;
};

// Offline push-to-talk: MediaRecorder captures mic audio, Whisper (WASM,
// on-device) transcribes it. No Google service involved, so no system toasts.
export const useVoiceInput = ({ onTranscript }: UseVoiceInputOptions) => {
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
    if (!supported) {
      setError("Voice input is not supported on this device.");
      return;
    }
    setError(null);

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
    setPhase("transcribing");
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
      const audio = await blobToSpeechAudio(blob);
      const text = await transcribeSpeechAudio(audio);
      setPhase("idle");
      if (text) {
        onTranscriptRef.current(text);
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
