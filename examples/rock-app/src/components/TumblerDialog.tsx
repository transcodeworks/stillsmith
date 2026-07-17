import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";

import type { Rock } from "@/data/rocks";

/**
 * Confirmation for the one irreversible thing Pebble does.
 *
 * Headless UI renders an open dialog through a portal attached to
 * `document.body`, which is the whole reason this component is in the example:
 * see `tumbler-dialog.scene.tsx`.
 */
export function TumblerDialog({ rock, open = true }: { rock: Rock; open?: boolean }) {
  return (
    <Dialog open={open} onClose={() => {}}>
      <DialogBackdrop style={{ position: "fixed", inset: 0, background: "rgb(0 0 0 / 0.55)" }} />

      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center" }}>
        <DialogPanel
          data-shot="tumbler-dialog"
          style={{
            width: 420,
            padding: 24,
            display: "grid",
            gap: 14,
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: "var(--panel)",
            boxShadow: "var(--shadow)",
          }}
        >
          <DialogTitle style={{ margin: 0, fontSize: 17 }}>
            Send {rock.name} to the tumbler?
          </DialogTitle>

          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>
            Thirty days of grit. At Mohs {rock.hardness} it will come out smaller, rounder, and
            nothing like the {rock.grams} g you carried back from {rock.foundAt}.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              data-shot="tumbler-cancel"
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--fg)",
                fontWeight: 500,
              }}
            >
              Leave it be
            </button>

            <button
              type="button"
              data-shot="tumbler-confirm"
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: 0,
                background: "var(--accent)",
                color: "var(--accent-fg)",
                fontWeight: 600,
              }}
            >
              Tumble it
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
