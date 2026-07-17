import { useCallback, useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";

import type { Annotation, Offset, Target } from "@stillsmith/annotate";
import type { Shot } from "../types.js";
import { AnnotationFields } from "./Fields.jsx";
import { ShotList } from "./ShotList.jsx";
import { Stage } from "./Stage.jsx";
import {
  type EditableShot,
  type StateDTO,
  createShot,
  deleteShot,
  fetchState,
  saveShot,
} from "./api.js";

/** The shot fields the GUI owns; everything else in the literal is left alone. */
function editable(shot: Shot): EditableShot {
  const { annotations, viewport, tags, presets, delay, fullPage } = shot;
  return { annotations, viewport, tags, presets, delay, fullPage };
}

/**
 * Only the fields the user actually changed.
 *
 * The codemod rewrites every property it is handed, so handing it the whole shot
 * would reprint `viewport`, `tags` and `presets` — reformatting them and
 * discarding any comments on them — just because someone nudged an offset. Send
 * the delta and the rest of the literal is never touched.
 */
function changedProps(original: EditableShot, draft: EditableShot): Partial<EditableShot> {
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof EditableShot)[]) {
    if (JSON.stringify(original[key]) !== JSON.stringify(draft[key])) props[key] = draft[key];
  }
  return props;
}

function newAnnotation(): Annotation {
  return { kind: "outline", target: { selector: "" } };
}

/**
 * Where the GUI opens. Everything defaults to "the first one", which is what the
 * dev server wants; they're here so a caller can land on a specific shot —
 * stillsmith's own docs use it to photograph the editor with a real annotation
 * selected, and it's the hook a shareable deep link would use.
 */
export interface AppProps {
  initialScene?: string;
  /** A shot's *export* name, e.g. "Tour". */
  initialShot?: string;
  initialPreset?: string;
  /** Index into the shot's annotations. */
  initialAnnotation?: number;
  /** The shell's shots/tours switch — rendered only when tours are configured. */
  modeToggle?: React.ReactNode;
}

export function App({
  initialScene,
  initialShot,
  initialPreset,
  initialAnnotation,
  modeToggle,
}: AppProps = {}) {
  const [state, setState] = useState<StateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const [sceneId, setSceneId] = useState<string | null>(initialScene ?? null);
  const [exportName, setExportName] = useState<string | null>(initialShot ?? null);
  const [presetName, setPresetName] = useState<string | null>(initialPreset ?? null);

  const [draft, setDraft] = useState<EditableShot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pickingField, setPickingField] = useState<string | null>(null);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "stillsmith-author",
  });

  const load = useCallback(async () => {
    try {
      const next = await fetchState();
      setState(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scene = useMemo(
    () => state?.scenes.find((s) => s.id === sceneId) ?? state?.scenes[0] ?? null,
    [state, sceneId],
  );
  const shotDTO = useMemo(
    () => scene?.shots.find((s) => s.exportName === exportName) ?? scene?.shots[0] ?? null,
    [scene, exportName],
  );
  const presets = state ? Object.keys(state.presets) : [];
  const preset = state?.presets[presetName ?? presets[0] ?? ""] ?? null;

  // Reset the draft whenever the selected shot changes identity.
  const shotKey = `${scene?.file ?? ""}#${shotDTO?.exportName ?? ""}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on shotKey by design
  useEffect(() => {
    setDraft(shotDTO ? editable(shotDTO.shot) : null);
    setDirty(false);
    setSelected(initialAnnotation ?? null);
    setPickingField(null);
  }, [shotKey, initialAnnotation]);

  const annotations = draft?.annotations ?? [];

  // Stable: it only ever calls state setters, which React guarantees are stable.
  const patchDraft = useCallback((mutate: (d: EditableShot) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });
    setDirty(true);
  }, []);

  const setAnnotations = (next: Annotation[]) =>
    patchDraft((d) => {
      // An empty array would write `annotations: []` into the file; dropping the
      // key entirely is what the author means by "no annotations".
      d.annotations = next.length > 0 ? next : undefined;
    });

  const onPick = useCallback(
    (target: Target) => {
      if (selected == null || !pickingField) return;
      patchDraft((d) => {
        const a = d.annotations?.[selected];
        if (!a) return;
        if (pickingField === "to" && a.kind === "arrow") a.to = target;
        else if ("target" in a) a.target = target;
      });
      setPickingField(null);
    },
    [selected, pickingField, patchDraft],
  );

  // A drag on the stage writes straight into the annotation's `offset`. An
  // offset that no longer moves anything is dropped, so the codemod never writes
  // `offset: { dx: 0, dy: 0 }` into the file. Selecting the dragged annotation
  // keeps the fields panel in sync with what the pointer is doing.
  const onOffsetChange = useCallback(
    (index: number, offset: Offset) => {
      patchDraft((d) => {
        const a = d.annotations?.[index];
        if (!a) return;
        const dx = offset.dx || undefined;
        const dy = offset.dy || undefined;
        a.offset = dx === undefined && dy === undefined ? undefined : { dx, dy };
      });
      setSelected(index);
    },
    [patchDraft],
  );

  const onSave = async () => {
    if (!scene || !shotDTO || !draft) return;

    const props = changedProps(editable(shotDTO.shot), draft);
    if (Object.keys(props).length === 0) {
      setDirty(false);
      return;
    }

    setStatus("saving…");
    try {
      await saveShot(scene.file, shotDTO.exportName, props);
      await load();
      setDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus(""), 1500);
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onAddShot = async () => {
    if (!scene) return;
    const name = prompt("New shot export name (e.g. Annotated)");
    if (!name) return;
    try {
      await createShot(scene.file, name);
      const next = await load();
      if (next) setExportName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDeleteShot = async () => {
    if (!scene || !shotDTO) return;
    if (!confirm(`Delete shot "${shotDTO.exportName}" from ${scene.id}?`)) return;
    try {
      await deleteShot(scene.file, shotDTO.exportName);
      setExportName(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!state) {
    return <div className="empty">{error ? `Error: ${error}` : "Loading…"}</div>;
  }
  if (state.scenes.length === 0) {
    return (
      <div className="empty">No scenes matched the `scenes` globs in stillsmith.config.ts.</div>
    );
  }

  return (
    <div className="app">
      <header>
        <strong>stillsmith</strong>
        {state.tours.length > 0 && modeToggle}

        <select value={scene?.id ?? ""} onChange={(e) => setSceneId(e.target.value)}>
          {state.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>

        <span className="spacer" />

        <select
          value={presetName ?? presets[0] ?? ""}
          onChange={(e) => setPresetName(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <span className="status">{status}</span>
        <button type="button" className="save" onClick={onSave} disabled={!dirty || !shotDTO}>
          {dirty ? "Save" : "Saved"}
        </button>
      </header>

      {error && (
        <div className="error">
          {error}
          <button type="button" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      <Group
        id="stillsmith-author"
        className="panels"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="shots"
          className="panel"
          defaultSize={220}
          minSize={140}
          maxSize={420}
          groupResizeBehavior="preserve-pixel-size"
        >
          <ShotList
            scene={scene}
            selectedExport={shotDTO?.exportName ?? null}
            onSelect={setExportName}
            onAdd={onAddShot}
            onDelete={onDeleteShot}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel id="stage" className="stage-panel" minSize={240}>
          {scene && preset && shotDTO ? (
            <Stage
              sceneFile={scene.file}
              preset={preset}
              viewport={draft?.viewport}
              annotations={annotations}
              picking={pickingField !== null && selected !== null}
              onPick={onPick}
              onOffsetChange={onOffsetChange}
            />
          ) : (
            <div className="empty stage">This scene has no shots yet. Add one.</div>
          )}
        </Panel>

        <Separator className="resize-handle" />

        <Panel
          id="annotations"
          className="panel annotations"
          defaultSize={320}
          minSize={220}
          maxSize={560}
          groupResizeBehavior="preserve-pixel-size"
        >
          <div className="list-head">
            <span>Annotations</span>
            <button
              type="button"
              disabled={!shotDTO}
              onClick={() => {
                setAnnotations([...annotations, newAnnotation()]);
                setSelected(annotations.length);
              }}
            >
              + add
            </button>
          </div>

          <ol className="list">
            {annotations.map((a, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: annotations have no stable id
                key={i}
                className={i === selected ? "sel" : ""}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(i)}
              >
                <span className="k">{a.kind}</span>
                <span className="t">{describeTarget(a)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnnotations(annotations.filter((_, j) => j !== i));
                    setSelected(null);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {annotations.length === 0 && <li className="muted">none</li>}
          </ol>

          {selected != null && annotations[selected] && (
            <AnnotationFields
              annotation={annotations[selected]}
              onChange={(next) =>
                setAnnotations(annotations.map((a, i) => (i === selected ? next : a)))
              }
              pickingField={pickingField}
              onPickField={setPickingField}
            />
          )}
        </Panel>
      </Group>
    </div>
  );
}

function describeTarget(a: Annotation): string {
  const t = a.kind === "arrow" ? a.to : a.target;
  return t?.selector ?? t?.text ?? (t?.rect ? "rect" : "—");
}
