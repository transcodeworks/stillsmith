/** Form controls for one annotation. Kind-specific fields plus the shared ones. */
import type { ReactNode } from "react";

import type { Annotation, Anchor, Target } from "@stillsmith/annotate";

const KINDS: Annotation["kind"][] = ["outline", "highlight", "arrow", "callout", "label"];
const COLORS = ["accent", "danger", "success", "warning", "info"];
const ANCHORS: Anchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

/** A labelled control. Deliberately not a <label>: several rows wrap a <select>
 * or a group rather than a single input, and a <label> with no associated
 * control is worse for a screen reader than a plain row. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span className="row-control">{children}</span>
    </div>
  );
}

export function Num({
  value,
  onChange,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

export function Text({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

function Check({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={value ?? false}
      onChange={(e) => onChange(e.target.checked || undefined)}
    />
  );
}

/** A Target, with a click-to-pick button that resolves it against the live scene.
 * Exported: the tour step editor anchors with the same three fields. */
export function TargetFields({
  label,
  target,
  onChange,
  onPick,
  picking,
}: {
  label: string;
  target: Target | undefined;
  onChange: (t: Target) => void;
  onPick: () => void;
  picking: boolean;
}) {
  const t = target ?? {};
  return (
    <fieldset>
      <legend>
        {label}
        <button type="button" className={picking ? "pick active" : "pick"} onClick={onPick}>
          {picking ? "click an element…" : "pick"}
        </button>
      </legend>
      <Row label="selector">
        <Text
          value={t.selector}
          placeholder="[data-shot='card']"
          onChange={(selector) => onChange({ ...t, selector })}
        />
      </Row>
      <Row label="text">
        <Text value={t.text} onChange={(text) => onChange({ ...t, text })} />
      </Row>
      <Row label="nth">
        <Num value={t.nth} onChange={(nth) => onChange({ ...t, nth })} />
      </Row>
    </fieldset>
  );
}

export interface AnnotationFieldsProps {
  annotation: Annotation;
  onChange: (a: Annotation) => void;
  /** Which target field, if any, is currently in click-to-pick mode. */
  pickingField: string | null;
  onPickField: (field: string | null) => void;
}

export function AnnotationFields({
  annotation,
  onChange,
  pickingField,
  onPickField,
}: AnnotationFieldsProps) {
  const a = annotation;
  // Kind-specific fields diverge, so a kind change starts from a clean object
  // carrying only what every kind shares.
  const changeKind = (kind: Annotation["kind"]) => {
    const base = { color: a.color, offset: a.offset };
    const target = "target" in a ? a.target : { selector: "" };
    if (kind === "arrow") onChange({ ...base, kind, to: target });
    else if (kind === "callout") onChange({ ...base, kind, target, text: "" });
    else if (kind === "label") onChange({ ...base, kind, target, badge: 1 });
    else onChange({ ...base, kind, target });
  };

  const set = (patch: Partial<Annotation>) => onChange({ ...a, ...patch } as Annotation);
  const offset = a.offset ?? {};

  return (
    <div className="fields">
      <Row label="kind">
        <select value={a.kind} onChange={(e) => changeKind(e.target.value as Annotation["kind"])}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Row>

      <Row label="color">
        <select value={a.color ?? "accent"} onChange={(e) => set({ color: e.target.value })}>
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Row>

      {a.kind === "arrow" ? (
        <TargetFields
          label="to"
          target={a.to}
          onChange={(to) => onChange({ ...a, to })}
          picking={pickingField === "to"}
          onPick={() => onPickField(pickingField === "to" ? null : "to")}
        />
      ) : (
        <TargetFields
          label="target"
          target={a.target}
          onChange={(target) => onChange({ ...a, target })}
          picking={pickingField === "target"}
          onPick={() => onPickField(pickingField === "target" ? null : "target")}
        />
      )}

      {(a.kind === "outline" || a.kind === "highlight") && (
        <>
          <Row label="padding">
            <Num value={a.padding} onChange={(padding) => set({ padding })} placeholder="4" />
          </Row>
          <Row label="radius">
            <Num value={a.radius} onChange={(radius) => set({ radius })} placeholder="8" />
          </Row>
        </>
      )}

      {a.kind === "outline" && (
        <>
          <Row label="width">
            <Num value={a.width} onChange={(width) => onChange({ ...a, width })} placeholder="3" />
          </Row>
          <Row label="dashed">
            <Check value={a.dashed} onChange={(dashed) => onChange({ ...a, dashed })} />
          </Row>
        </>
      )}

      {a.kind === "highlight" && (
        <>
          <Row label="dim">
            <Check value={a.dim} onChange={(dim) => onChange({ ...a, dim })} />
          </Row>
          <Row label="dimOpacity">
            <Num
              value={a.dimOpacity}
              onChange={(dimOpacity) => onChange({ ...a, dimOpacity })}
              placeholder="0.55"
            />
          </Row>
          <Row label="fillOpacity">
            <Num
              value={a.fillOpacity}
              onChange={(fillOpacity) => onChange({ ...a, fillOpacity })}
              placeholder="0.18"
            />
          </Row>
        </>
      )}

      {a.kind === "arrow" && (
        <>
          <Row label="curve">
            <Check value={a.curve} onChange={(curve) => onChange({ ...a, curve })} />
          </Row>
          <Row label="width">
            <Num value={a.width} onChange={(width) => onChange({ ...a, width })} placeholder="3" />
          </Row>
          <Row label="headSize">
            <Num
              value={a.headSize}
              onChange={(headSize) => onChange({ ...a, headSize })}
              placeholder="14"
            />
          </Row>
          <Row label="gap">
            <Num value={a.gap} onChange={(gap) => onChange({ ...a, gap })} placeholder="6" />
          </Row>
        </>
      )}

      {a.kind === "callout" && (
        <>
          <Row label="text">
            <textarea
              value={a.text}
              rows={3}
              onChange={(e) => onChange({ ...a, text: e.target.value })}
            />
          </Row>
          <Row label="badge">
            <Text
              value={a.badge == null ? undefined : String(a.badge)}
              onChange={(badge) => onChange({ ...a, badge })}
            />
          </Row>
          <Row label="placement">
            <select
              value={a.placement ?? "auto"}
              onChange={(e) => onChange({ ...a, placement: e.target.value as typeof a.placement })}
            >
              {["auto", "top", "bottom", "left", "right"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Row>
          <Row label="maxWidth">
            <Num
              value={a.maxWidth}
              onChange={(maxWidth) => onChange({ ...a, maxWidth })}
              placeholder="240"
            />
          </Row>
          <Row label="gap">
            <Num value={a.gap} onChange={(gap) => onChange({ ...a, gap })} placeholder="16" />
          </Row>
        </>
      )}

      {a.kind === "label" && (
        <>
          <Row label="badge">
            <Text
              value={String(a.badge ?? "")}
              onChange={(badge) => onChange({ ...a, badge: badge ?? "" })}
            />
          </Row>
          <Row label="anchor">
            <select
              value={a.anchor ?? "top-left"}
              onChange={(e) => onChange({ ...a, anchor: e.target.value as Anchor })}
            >
              {ANCHORS.map((an) => (
                <option key={an} value={an}>
                  {an}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}

      <fieldset>
        <legend title="Or drag the annotation on the stage">offset</legend>
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
