/**
 * The tours workbench — the App.tsx of tour mode. Same skeleton (list /
 * stage / fields, delta-only saves through the codemod), different stage:
 * tours are authored against the running app, not a scene iframe.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";

import type { Offset, Target } from "@stillsmith/annotate";
import type { Step } from "@stillsmith/tour";
import { AppStage } from "./AppStage.jsx";
import { Row, Text } from "./Fields.jsx";
import { StepFields } from "./StepFields.jsx";
import { TourStepList } from "./TourList.jsx";
import {
  type EditableTour,
  type StateDTO,
  type TourDTO,
  createTour,
  deleteTour,
  fetchState,
  saveTour,
} from "./api.js";

function editable(tour: TourDTO["tour"]): EditableTour {
  return { steps: tour.steps, fixture: tour.fixture };
}

function changedProps(original: EditableTour, draft: EditableTour): Partial<EditableTour> {
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof EditableTour)[]) {
    if (JSON.stringify(original[key]) === JSON.stringify(draft[key])) continue;
    // `null` is the wire spelling of "remove this prop": JSON has no undefined,
    // so a cleared field would otherwise vanish from the body silently.
    props[key] = draft[key] === undefined ? null : draft[key];
  }
  return props;
}

export interface ToursAppProps {
  /** Rendered in the header so the shell can swap workbenches. */
  modeToggle?: React.ReactNode;
}

export function ToursApp({ modeToggle }: ToursAppProps) {
  const [state, setState] = useState<StateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const [tourId, setTourId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableTour | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pickingField, setPickingField] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [route, setRoute] = useState("/");
  const [warnings, setWarnings] = useState<string[]>([]);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "stillsmith-tours" });

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

  const tourDTO = useMemo(
    () => state?.tours.find((t) => t.id === tourId) ?? state?.tours[0] ?? null,
    [state, tourId],
  );
  const presets = state ? Object.keys(state.presets) : [];
  const preset = state?.presets[presetName ?? presets[0] ?? ""] ?? null;

  // Reset the draft whenever the selected tour changes identity.
  const tourKey = `${tourDTO?.file ?? ""}#${tourDTO?.exportName ?? ""}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on tourKey by design
  useEffect(() => {
    setDraft(tourDTO ? editable(tourDTO.tour) : null);
    setDirty(false);
    setSelected(tourDTO && tourDTO.tour.steps.length > 0 ? 0 : null);
    setPickingField(null);
    setPlaying(false);
  }, [tourKey]);

  const steps = draft?.steps ?? [];
  const step = selected != null ? (steps[selected] ?? null) : null;

  // Selecting a step with a route pulls the stage onto that route, so the
  // preview lands where the step will actually run.
  const stepRoute = step?.route;
  useEffect(() => {
    if (stepRoute) setRoute(stepRoute);
  }, [stepRoute]);

  const patchSteps = useCallback((mutate: (steps: Step[]) => Step[]) => {
    setDraft((prev) => (prev ? { ...prev, steps: mutate(structuredClone(prev.steps)) } : prev));
    setDirty(true);
  }, []);

  const setStep = (index: number, next: Step) =>
    patchSteps((all) => all.map((s, i) => (i === index ? next : s)));

  const onPick = useCallback(
    (target: Target) => {
      if (selected == null || !pickingField) return;
      patchSteps((all) =>
        all.map((s, i) => {
          if (i !== selected) return s;
          if (pickingField === "advance.target") {
            return { ...s, advance: { on: "click", target } };
          }
          return { ...s, target };
        }),
      );
      setPickingField(null);
    },
    [selected, pickingField, patchSteps],
  );

  const onOffsetChange = useCallback(
    (offset: Offset) => {
      if (selected == null) return;
      patchSteps((all) =>
        all.map((s, i) => {
          if (i !== selected) return s;
          const dx = offset.dx || undefined;
          const dy = offset.dy || undefined;
          return { ...s, offset: dx === undefined && dy === undefined ? undefined : { dx, dy } };
        }),
      );
    },
    [selected, patchSteps],
  );

  const onSave = async () => {
    if (!tourDTO || !draft) return;
    const props = changedProps(editable(tourDTO.tour), draft);
    if (Object.keys(props).length === 0) {
      setDirty(false);
      return;
    }
    setStatus("saving…");
    try {
      await saveTour(tourDTO.file, tourDTO.exportName, props);
      await load();
      setDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus(""), 1500);
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onAddStep = () => {
    patchSteps((all) => [...all, { body: "" }]);
    setSelected(steps.length);
  };

  const onDeleteStep = () => {
    if (selected == null) return;
    patchSteps((all) => all.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const onMoveStep = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    patchSteps((all) => {
      const next = [...all];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
    setSelected(to);
  };

  const onAddTour = async () => {
    if (!tourDTO) return;
    const name = prompt("New tour export name (e.g. FeatureTour)");
    if (!name) return;
    try {
      await createTour(tourDTO.file, name);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDeleteTour = async () => {
    if (!tourDTO) return;
    if (!confirm(`Delete tour "${tourDTO.exportName}" from ${tourDTO.file}?`)) return;
    try {
      await deleteTour(tourDTO.file, tourDTO.exportName);
      setTourId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!state) {
    return <div className="empty">{error ? `Error: ${error}` : "Loading…"}</div>;
  }
  if (state.tours.length === 0) {
    return (
      <div className="empty">
        No tours matched the `tours` globs in stillsmith.config.ts. Add a `*.tour.ts` exporting
        {" `{ id, steps: [] } satisfies Tour`"} to begin.
      </div>
    );
  }

  const playTour = tourDTO ? { ...tourDTO.tour, ...(draft ?? {}) } : null;

  return (
    <div className="app">
      <header>
        <strong>stillsmith</strong>
        {modeToggle}

        <select value={tourDTO?.id ?? ""} onChange={(e) => setTourId(e.target.value)}>
          {state.tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={onAddTour} title="Add a tour to this file">
          +
        </button>
        <button type="button" onClick={onDeleteTour} disabled={!tourDTO} title="Delete this tour">
          ×
        </button>

        <span className="spacer" />

        <button type="button" onClick={() => setPlaying((p) => !p)} disabled={!playTour}>
          {playing ? "■ stop" : "▶ play"}
        </button>

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
        <button type="button" className="save" onClick={onSave} disabled={!dirty || !tourDTO}>
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
      {warnings.length > 0 && !playing && <div className="warnings">{warnings.join(" · ")}</div>}

      <Group
        id="stillsmith-tours"
        className="panels"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="steps"
          className="panel"
          defaultSize={240}
          minSize={140}
          maxSize={420}
          groupResizeBehavior="preserve-pixel-size"
        >
          <TourStepList
            tourId={tourDTO?.id ?? null}
            steps={steps}
            selected={selected}
            onSelect={setSelected}
            onAdd={onAddStep}
            onDelete={onDeleteStep}
            onMove={onMoveStep}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel id="stage" className="stage-panel" minSize={240}>
          {preset ? (
            <AppStage
              route={route}
              onRouteChange={setRoute}
              preset={preset}
              appUrl={state?.appUrl}
              step={step}
              stepIndex={selected ?? 0}
              stepCount={steps.length}
              tour={playTour}
              playing={playing}
              onStopPlay={() => setPlaying(false)}
              picking={pickingField !== null && selected !== null}
              onPick={onPick}
              onOffsetChange={onOffsetChange}
              onWarnings={setWarnings}
            />
          ) : (
            <div className="empty stage">No presets configured.</div>
          )}
        </Panel>

        <Separator className="resize-handle" />

        <Panel
          id="step-fields"
          className="panel annotations"
          defaultSize={320}
          minSize={220}
          maxSize={560}
          groupResizeBehavior="preserve-pixel-size"
        >
          <div className="list-head">
            <span>Tour</span>
          </div>
          <div className="fields">
            <Row label="fixture">
              <Text
                value={draft?.fixture}
                placeholder="registered fixture name"
                onChange={(fixture) => {
                  setDraft((prev) => (prev ? { ...prev, fixture } : prev));
                  setDirty(true);
                }}
              />
            </Row>
          </div>

          <div className="list-head">
            <span>Step {selected != null ? selected + 1 : "—"}</span>
          </div>
          {step && selected != null ? (
            <StepFields
              step={step}
              onChange={(next) => setStep(selected, next)}
              pickingField={pickingField}
              onPickField={setPickingField}
            />
          ) : (
            <div className="empty">Select a step.</div>
          )}
        </Panel>
      </Group>
    </div>
  );
}
