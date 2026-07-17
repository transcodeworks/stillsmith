import type { SceneDTO } from "./api.js";

export interface ShotListProps {
  scene: SceneDTO | null;
  selectedExport: string | null;
  onSelect: (exportName: string) => void;
  onAdd: () => void;
  onDelete: () => void;
}

/** Left-rail shot list for the active scene. */
export function ShotList({ scene, selectedExport, onSelect, onAdd, onDelete }: ShotListProps) {
  const shots = scene?.shots ?? [];

  return (
    <div className="sidebar shot-list">
      <div className="list-head">
        <span>Shots{scene ? ` · ${scene.id}` : ""}</span>
        <div className="list-actions">
          <button type="button" onClick={onAdd} disabled={!scene} title="Add shot">
            +
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!selectedExport || shots.length === 0}
            title="Delete selected shot"
          >
            ×
          </button>
        </div>
      </div>

      <ol className="list">
        {shots.map((s) => {
          const annCount = s.shot.annotations?.length ?? 0;
          return (
            <li
              key={s.exportName}
              className={s.exportName === selectedExport ? "sel" : ""}
              onClick={() => onSelect(s.exportName)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(s.exportName)}
            >
              <span className="k">{s.exportName}</span>
              {annCount > 0 && <span className="badge">{annCount}</span>}
            </li>
          );
        })}
        {shots.length === 0 && <li className="muted">no shots yet</li>}
      </ol>
    </div>
  );
}
