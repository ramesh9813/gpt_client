export const asElement = (t: EventTarget | null): HTMLElement | null => {
  if (!t) return null;
  if (t instanceof HTMLElement) return t;
  const parent = (t as unknown as { parentElement?: HTMLElement | null }).parentElement;
  return parent ?? null;
};

export const isScrollableX = (el: HTMLElement): boolean => {
  try { if (el.scrollWidth > el.clientWidth + 8) return true; } catch { return false; }
  return false;
};

export const findScrollableAncestor = (target: HTMLElement | null): HTMLElement | null => {
  let el: HTMLElement | null = target;
  let depth = 0;
  while (el && depth < 10) {
    if (isScrollableX(el)) return el;
    try { if (el.classList?.contains("msg-list") || el.tagName === "BODY") break; } catch { break; }
    el = el.parentElement;
    depth += 1;
  }
  return null;
};

export const findCardScroller = (target: HTMLElement | null): HTMLElement | null => {
  let card: HTMLElement | null = null;
  try { card = target?.closest?.(".msg-codeblock, .msg-md-pre, .markdown table, .markdown pre, table, pre") as HTMLElement | null; } catch { card = null; }
  if (!card) return null;
  if (isScrollableX(card)) return card;
  let candidates: NodeListOf<Element> | null = null;
  try { candidates = card.querySelectorAll?.("div, pre, code, table"); } catch { candidates = null; }
  if (candidates) for (let i = 0; i < candidates.length; i += 1) if (isScrollableX(candidates[i] as HTMLElement)) return candidates[i] as HTMLElement;
  return card;
};

export const closestSafe = (target: HTMLElement | null, selector: string): Element | null => {
  try { return target?.closest?.(selector) ?? null; } catch { return null; }
};
