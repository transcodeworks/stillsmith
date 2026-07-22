import type { Step } from "@stillsmith/tour";

export interface TourStepListProps {
  tourId: string | null;
  steps: Step[];
  selected: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

/** Left-rail step list for the active tour — order is the tour. */
export function TourStepList({
  tourId,
  steps,
  selected,
  onSelect,
  onAdd,
  onDelete,
  onMove,
}: TourStepListProps) {
  return (
    <div className="sidebar shot-list">
      <div className="list-head">
        <span>Steps{tourId ? ` · ${tourId}` : ""}</span>
        <div className="list-actions">
          <button type="button" onClick={onAdd} disabled={!tourId} title="Add step">
            +
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={selected == null}
            title="Delete selected step"
          >
            ×
          </button>
        </div>
      </div>

      <ol className="list">
        {steps.map((s, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: order is identity for steps
            key={i}
            className={i === selected ? "sel" : ""}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(i)}
          >
            <span className="badge">{i + 1}</span>
            <span className="k">{s.title || s.body || "(empty)"}</span>
            {s.route && <span className="badge">{s.route}</span>}
            <span className="reorder">
              <button
                type="button"
                title="Move up"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(i, -1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                title="Move down"
                disabled={i === steps.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(i, 1);
                }}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
        {steps.length === 0 && <li className="muted">no steps yet</li>}
      </ol>
    </div>
  );
}
