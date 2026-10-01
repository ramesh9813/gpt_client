export const getAside = (): HTMLElement | null => {
  try { return document.getElementById("conversation-history"); } catch { return null; }
};
export const getBackdrop = (): HTMLElement | null => {
  try { return document.querySelector(".conv-side-backdrop") as HTMLElement | null; } catch { return null; }
};
export const reducedMotion = (): boolean => {
  try { return typeof window !== "undefined" && typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
export const clearFollowStyles = () => {
  const aside = getAside();
  if (aside) { aside.style.transition = ""; aside.style.transform = ""; }
  const bd = getBackdrop();
  if (bd) { bd.style.transition = ""; bd.style.opacity = ""; }
};
// Gesture snap: the finger leaves an inline translateX behind, which would
// freeze the drawer (inline beats the state class) and then jump when
// cleared ~60ms later. Instead, ease from the live release position to the
// target so showing/hiding tracks one smooth motion, then hand back to CSS.
const finishSnap = (targetTransform: string, targetOpacity: string | null, done: () => void) => {
  const el = getAside();
  if (!el || reducedMotion()) {
    try { done(); } finally { clearFollowStyles(); }
    return;
  }
  done();
  el.style.transition = "transform 180ms ease-out";
  el.style.transform = targetTransform;
  const bd = getBackdrop();
  if (bd && targetOpacity !== null) {
    bd.style.transition = "opacity 180ms ease-out";
    bd.style.opacity = targetOpacity;
  }
  window.setTimeout(() => { clearFollowStyles(); }, 200);
};
export const snapOpenDrawer = (openDrawer: () => void) =>
  finishSnap("translateX(0px)", null, openDrawer);
export const snapShut = (closeDrawer: () => void) =>
  finishSnap("translateX(-100%)", null, closeDrawer);
export const snapCloseFinish = (closeDrawer: () => void) =>
  finishSnap("translateX(-100%)", "0", closeDrawer);
export const snapStayOpen = () => finishSnap("translateX(0px)", "", () => {});
