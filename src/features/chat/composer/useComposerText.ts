import { useEffect, useRef, useState, type ClipboardEvent, type ChangeEvent, type Dispatch, type KeyboardEvent, type MutableRefObject, type SetStateAction } from "react";
import { WEBSEARCH_ARMED_KEY, readWebSearchArmed } from "../sidebarState";

export const useComposerArmed = () => {
  // Armed when the user picks a model from the Deep Research list.
  const [researchArmed, setResearchArmed] = useState(false);
  // Armed when the user picks Artifact / Simulation from the '+' menu.
  // Mirrors researchArmed exactly: chip indicator, send opts, one-shot disarm.
  const [artifactArmed, setArtifactArmed] = useState(false);
  // Sticky modes: stay on across sends until explicitly cleared.
  // Web search defaults ON; quiz defaults OFF. Both persist in localStorage.
  const [webSearchArmed, setWebSearchArmed] = useState(() => readWebSearchArmed());
  const [mcqArmed, setMcqArmed] = useState(() => {
    try {
      return window.localStorage.getItem("chatapp.mcq.armed") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(WEBSEARCH_ARMED_KEY, String(webSearchArmed));
    } catch {}
  }, [webSearchArmed]);
  useEffect(() => {
    try {
      window.localStorage.setItem("chatapp.mcq.armed", String(mcqArmed));
    } catch {}
  }, [mcqArmed]);

  return {
    researchArmed,
    setResearchArmed,
    artifactArmed,
    setArtifactArmed,
    webSearchArmed,
    setWebSearchArmed,
    mcqArmed,
    setMcqArmed,
  };
};

// Quiz routing prefix (server treats a leading "mcq " as a quiz turn).
export const MCQ_PREFIX = /^\s*mcq(\s|$)/i;

// Single row initially, grow line-by-line up to 4 rows, then scroll inside.
export const adjustTextareaHeight = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  const cs = window.getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 24;
  const padding =
    (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const maxHeight = Math.round(lineHeight * 4 + padding);
  const next = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
};

type SendOpts = { research?: boolean; artifact?: boolean; webSearch?: boolean };

type UseComposerTextOptions = {
  value: string;
  setValue: (value: string) => void;
  images: string[];
  compressing: boolean;
  mcqArmed: boolean;
  researchArmed: boolean;
  artifactArmed: boolean;
  webSearchArmed: boolean;
  disabled?: boolean;
  streaming?: boolean;
  lastUserMessage?: string;
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>;
  onSend: (value: string, images?: string[], opts?: SendOpts) => void;
  clearImages: () => void;
  handleFiles: (files: FileList, kind: "photo" | "screenshot") => void | Promise<void>;
  attachRecent: (src: string) => void;
  setShowRecents: Dispatch<SetStateAction<boolean>>;
  setCameraOpen: Dispatch<SetStateAction<boolean>>;
  setResearchArmed: (value: boolean) => void;
  setArtifactArmed: (value: boolean) => void;
};

export const useComposerText = ({
  value,
  setValue,
  images,
  compressing,
  mcqArmed,
  researchArmed,
  artifactArmed,
  webSearchArmed,
  disabled,
  streaming,
  lastUserMessage,
  inputRef,
  onSend,
  clearImages,
  handleFiles,
  attachRecent,
  setShowRecents,
  setCameraOpen,
  setResearchArmed,
  setArtifactArmed,
}: UseComposerTextOptions) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = value.trim().length > 0 || images.length > 0;

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    if (compressing) return;
    // Sticky quiz mode: route through the quiz pipeline even as the user
    // edits the prompt — no visible prefix needed. Images-only sends skip
    // the prefix so attachments still go through normally.
    const routed =
      mcqArmed && trimmed && !MCQ_PREFIX.test(trimmed) ? `mcq ${trimmed}` : trimmed;
    // webSearch is always explicit (true/false) so an explicit OFF beats
    // the pipeline default-ON; research/artifact stay one-shot opt-ins.
    const opts =
      researchArmed || artifactArmed
        ? {
            ...(researchArmed ? { research: true as const } : {}),
            ...(artifactArmed ? { artifact: true as const } : {}),
            webSearch: webSearchArmed,
          }
        : { webSearch: webSearchArmed };
    onSend(routed, images.length > 0 ? [...images] : undefined, opts);
    setValue("");
    setShowRecents(false);
    // One-shot: disarm research + artifact after sending. Web search and
    // quiz stay on until explicitly cleared.
    setResearchArmed(false);
    setArtifactArmed(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) adjustTextareaHeight(el);
    });
    clearImages();
  };

  const handleSend = () => sendText(value);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !streaming && !compressing) {
        handleSend();
      }
    }
  };

  const handleEditLast = () => {
    if (!lastUserMessage) return;
    setValue(lastUserMessage);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const setTextareaRefs = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (inputRef) {
      inputRef.current = node;
    }
    if (node) adjustTextareaHeight(node);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) adjustTextareaHeight(el);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustTextareaHeight(e.target);
    // Typing takes over: auto-close the camera view and the
    // image-selector card so the thread gets full space.
    if (e.target.value.length > 0) {
      setCameraOpen(false);
      setShowRecents(false);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imgs.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        imgs.forEach((f) => dt.items.add(f));
        void handleFiles(dt.files, "screenshot");
      }
    }
  };

  // Device rows serve blob: URLs — convert back to a File so attach/send
  // flows keep working on real compressed dataURLs.
  const handlePickSrc = (src: string) => {
    if (!src.startsWith("blob:")) {
      attachRecent(src);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) return;
        const file = new File([blob], `device-photo-${Date.now()}.jpg`, {
          type: blob.type,
        });
        const dt = new DataTransfer();
        dt.items.add(file);
        await handleFiles(dt.files, "photo");
      } catch {
        // unreadable blob — ignore
      }
    })();
  };

  return {
    textareaRef,
    canSend,
    handleSend,
    sendText,
    onKeyDown,
    handleEditLast,
    setTextareaRefs,
    handleChange,
    handlePaste,
    handlePickSrc,
    adjustTextareaHeight,
  };
};

export type ComposerTextApi = ReturnType<typeof useComposerText>;
