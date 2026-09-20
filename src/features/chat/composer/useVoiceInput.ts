import { useEffect, useRef, useState } from "react";

interface VoiceInputOptions {
  disabled?: boolean;
  streaming?: boolean;
  compressing?: boolean;
  onTranscript: (text: string) => void;
}

/**
 * Mic voice input: click to listen, click again to only stop listening.
 * The transcript stays in the input; the send button sends it.
 * Split from Composer.tsx. No logic changes.
 */
export const useVoiceInput = ({
  disabled,
  streaming,
  compressing,
  onTranscript,
}: VoiceInputOptions) => {
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  // Voice input: click mic to listen, click again to only stop listening.
  // The transcript stays in the input; the send button sends it.
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const [listening, setListening] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Listening indicator is pure CSS animation (see composer-viz styles): a
  // second getUserMedia mic stream fights speech recognition on Android and
  // makes Google's recognizer fail with "cannot record now".

  // Mobile speech engines re-deliver final chunks across result events, so the
  // same words can arrive two or more times. Collapse consecutive repeated
  // phrases (up to 6 words) so each segment appears exactly once.
  const dedupeTranscript = (text: string): string => {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    for (const w of words) {
      out.push(w);
      for (let n = 1; n <= 6; n++) {
        if (out.length >= n * 2) {
          const tail = out.slice(out.length - n).join(" ").toLowerCase();
          const prev = out.slice(out.length - n * 2, out.length - n).join(" ").toLowerCase();
          if (tail === prev) {
            out.splice(out.length - n, n);
            break;
          }
        }
      }
    }
    return out.join(" ");
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || disabled || streaming || compressing) return;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    finalTranscriptRef.current = "";
    stopRequestedRef.current = false;
    listeningRef.current = true;
    rec.onresult = (e: any) => {
      // Rebuild from the cumulative results array every event: the engine
      // re-delivers final chunks across events, so incremental appending
      // would repeat words ("can you" → "cancan you"). Recomputing keeps
      // each final segment exactly once; only unfinished tails are interim.
      let final = "";
      let interim = "";
      const results = e.results || [];
      for (let i = 0; i < results.length; i++) {
        const transcript = results[i][0]?.transcript || "";
        if (results[i].isFinal) {
          final += transcript;
        } else if (i >= (e.resultIndex || 0)) {
          interim += transcript;
        }
      }
      finalTranscriptRef.current = dedupeTranscript(final);
      onTranscriptRef.current(dedupeTranscript((final + (interim ? " " + interim : "")).trim()));
    };
    rec.onerror = (e: any) => {
      const kind = e?.error || "";
      if (kind === "not-allowed" || kind === "service-not-allowed") {
        setListenError("Microphone blocked. Allow mic permission and try again.");
        stopRequestedRef.current = true;
        listeningRef.current = false;
        setListening(false);
      } else if (kind === "audio-capture") {
        setListenError("No microphone found or mic is busy in another app.");
        stopRequestedRef.current = true;
        listeningRef.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      if (stopRequestedRef.current) {
        // User tapped stop: send the transcript to the AI.
        const text = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = "";
        listeningRef.current = false;
        setListening(false);
        if (text) {
          onTranscriptRef.current(text);
        } else {
          onTranscriptRef.current("");
        }
      } else if (listeningRef.current) {
        // Unexpected end (e.g. mobile pause): resume while still listening.
        try {
          rec.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }
    };
    recognitionRef.current = rec;
    setListening(true);
    setListenError(null);
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  };

  const stopListening = () => {
    stopRequestedRef.current = true;
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      const text = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      setListening(false);
      if (text) onTranscriptRef.current(text);
      else onTranscriptRef.current("");
    }
  };

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup errors
      }
    },
    []
  );

  return {
    listening,
    listenError,
    speechSupported,
    startListening,
    stopListening,
  };
};

export type VoiceInputApi = ReturnType<typeof useVoiceInput>;
