/**
 * Keyboard and focus behaviour. Static overlays get to ignore all of this;
 * an interactive one doesn't: focus moves into the card, Tab cycles within
 * it, Esc dismisses, arrows step, and focus returns where it was when the
 * tour ends.
 */
import type { TourRoot } from "./types.js";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export interface FocusHandlers {
  onEsc: () => void;
  onNext?: () => void;
  onBack?: () => void;
}

export class FocusManager {
  private readonly doc: Document;
  private container: HTMLElement | null = null;
  private handlers: FocusHandlers | null = null;
  private restoreTo: Element | null = null;
  private listening = false;

  constructor(root: TourRoot) {
    this.doc = root.doc;
  }

  /** Trap focus in `container` (one per shown step). */
  activate(container: HTMLElement, handlers: FocusHandlers): void {
    if (!this.listening) {
      // Only remembered once, at tour start — focus returns to where the
      // user was before the tour, not to the previous step's button.
      this.restoreTo = this.doc.activeElement;
      this.doc.addEventListener("keydown", this.onKeydown, true);
      this.listening = true;
    }
    this.container = container;
    this.handlers = handlers;

    const first = container.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container).focus?.();
  }

  private onKeydown = (e: KeyboardEvent) => {
    const h = this.handlers;
    if (!h) return;

    if (e.key === "Escape") {
      e.preventDefault();
      h.onEsc();
      return;
    }
    if (e.key === "ArrowRight" && h.onNext) {
      h.onNext();
      return;
    }
    if (e.key === "ArrowLeft" && h.onBack) {
      h.onBack();
      return;
    }

    if (e.key === "Tab" && this.container) {
      const focusable = Array.from(this.container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const active = this.doc.activeElement;

      // Cycle at the edges; let Tab move normally inside the card.
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (active && !this.container.contains(active)) {
        // Focus escaped (e.g. the app stole it); pull it back in.
        e.preventDefault();
        first.focus();
      }
    }
  };

  deactivate(): void {
    if (this.listening) {
      this.doc.removeEventListener("keydown", this.onKeydown, true);
      this.listening = false;
    }
    this.container = null;
    this.handlers = null;
    (this.restoreTo as HTMLElement | null)?.focus?.();
    this.restoreTo = null;
  }
}
