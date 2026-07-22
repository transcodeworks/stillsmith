/** Form controls for one tour step. */
import type { Advance, Placement, Step } from "@stillsmith/tour";
import { Num, Row, TargetFields, Text } from "./Fields.jsx";

const PLACEMENTS: Placement[] = [
  "top",
  "bottom",
  "left",
  "right",
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end",
  "left-start",
  "left-end",
  "right-start",
  "right-end",
];

export interface StepFieldsProps {
  step: Step;
  onChange: (s: Step) => void;
  /** Which target field, if any, is in click-to-pick mode. */
  pickingField: string | null;
  onPickField: (field: string | null) => void;
}

export function StepFields({ step, onChange, pickingField, onPickField }: StepFieldsProps) {
  const s = step;
  const set = (patch: Partial<Step>) => onChange({ ...s, ...patch });
  const offset = s.offset ?? {};
  const advanceKind = s.advance?.on ?? "next";

  const changeAdvance = (on: "next" | "click" | "route") => {
    // "next" is the default; leaving the property out keeps the file minimal.
    if (on === "next") set({ advance: undefined });
    else if (on === "click") set({ advance: { on } });
    else set({ advance: { on, path: s.route ?? "/" } });
  };

  return (
    <div className="fields">
      <Row label="title">
        <Text value={s.title} onChange={(title) => set({ title })} />
      </Row>
      <Row label="body">
        <textarea value={s.body} rows={3} onChange={(e) => set({ body: e.target.value })} />
      </Row>

      <TargetFields
        label="target"
        target={s.target}
        onChange={(target) => set({ target })}
        picking={pickingField === "target"}
        onPick={() => onPickField(pickingField === "target" ? null : "target")}
      />
      {!s.target && <div className="hint">No target: the step renders centered.</div>}

      <Row label="placement">
        <select
          value={s.placement ?? ""}
          onChange={(e) => set({ placement: (e.target.value || undefined) as Placement })}
        >
          <option value="">auto (bottom)</option>
          {PLACEMENTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Row>

      <Row label="route">
        <Text value={s.route} placeholder="/settings" onChange={(route) => set({ route })} />
      </Row>

      <fieldset>
        <legend>advance</legend>
        <Row label="on">
          <select
            value={advanceKind}
            onChange={(e) => changeAdvance(e.target.value as "next" | "click" | "route")}
          >
            <option value="next">next button</option>
            <option value="click">click target</option>
            <option value="route">route change</option>
          </select>
        </Row>
        {s.advance?.on === "click" && (
          <TargetFields
            label="click target (defaults to the step's)"
            target={s.advance.target}
            onChange={(target) => set({ advance: { on: "click", target } satisfies Advance })}
            picking={pickingField === "advance.target"}
            onPick={() => onPickField(pickingField === "advance.target" ? null : "advance.target")}
          />
        )}
        {s.advance?.on === "route" && (
          <Row label="path">
            <Text
              value={s.advance.path}
              onChange={(path) => set({ advance: { on: "route", path: path ?? "/" } })}
            />
          </Row>
        )}
      </fieldset>

      <Row label="optional">
        <input
          type="checkbox"
          checked={s.optional ?? false}
          onChange={(e) => set({ optional: e.target.checked || undefined })}
        />
      </Row>
      <Row label="padding">
        <Num value={s.padding} onChange={(padding) => set({ padding })} placeholder="4" />
      </Row>
      <Row label="radius">
        <Num value={s.radius} onChange={(radius) => set({ radius })} placeholder="8" />
      </Row>

      <fieldset>
        <legend title="Or drag the card on the stage">offset</legend>
        <Row label="dx">
          <Num
            value={offset.dx}
            placeholder="0"
            onChange={(dx) => set({ offset: cleanOffset({ ...offset, dx }) })}
          />
        </Row>
        <Row label="dy">
          <Num
            value={offset.dy}
            placeholder="0"
            onChange={(dy) => set({ offset: cleanOffset({ ...offset, dy }) })}
          />
        </Row>
      </fieldset>
    </div>
  );
}

/** Drop an offset that no longer moves anything, so it doesn't land in the file. */
function cleanOffset(o: { dx?: number; dy?: number }): { dx?: number; dy?: number } | undefined {
  const dx = o.dx || undefined;
  const dy = o.dy || undefined;
  return dx === undefined && dy === undefined ? undefined : { dx, dy };
}
