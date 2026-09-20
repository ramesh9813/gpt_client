import { useEffect } from "react";
import type { RefObject } from "react";

// Keep input above mobile keyboard: track visualViewport shrink and expose --kb-height.
// With interactive-widget=resizes-content the layout already shrinks; this var covers
// overlay keyboards (iOS Safari) plus adds a little extra lift so the lower section stays visible.
export const useChatViewport = (
  composerInputRef: RefObject<HTMLTextAreaElement>
) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      composerInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composerInputRef]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const EXTRA_LIFT = 8;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      const val = kb > 0 ? Math.round(kb + EXTRA_LIFT) : 0;
      document.documentElement.style.setProperty("--kb-height", `${val}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      document.documentElement.style.setProperty("--kb-height", "0px");
    };
  }, []);
};
