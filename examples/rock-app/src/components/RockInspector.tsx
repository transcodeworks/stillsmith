import { KIND_LABEL, type Rock, type RockPhoto } from "@/data/rocks";

function Field({ label, value, shot }: { label: string; value: string; shot?: string }) {
  return (
    <div data-shot={shot} style={{ display: "grid", gap: 2 }}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/**
 * The photographer and licence, sitting under the photo they apply to.
 *
 * CC BY is only satisfied if the credit travels with the image, so this is a
 * requirement rather than a courtesy — see NOTICE.md.
 */
function PhotoCredit({ photo }: { photo: RockPhoto }) {
  return (
    <p
      data-shot="photo-credit"
      style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "var(--muted)" }}
    >
      Photo{" "}
      <a href={photo.source} style={{ color: "inherit" }}>
        {photo.photographer}
      </a>{" "}
      ·{" "}
      <a href={photo.licenseUrl} style={{ color: "inherit" }}>
        {photo.license}
      </a>
    </p>
  );
}

/** Detail panel for the selected rock. */
export function RockInspector({ rock }: { rock: Rock }) {
  return (
    <aside
      data-shot="inspector"
      style={{
        width: 300,
        flex: "0 0 300px",
        padding: 20,
        display: "grid",
        gap: 18,
        alignContent: "start",
        background: "var(--panel-2)",
        borderLeft: "1px solid var(--line)",
        height: "100%",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div
          aria-hidden
          style={{
            position: "relative",
            overflow: "hidden",
            height: 132,
            borderRadius: 12,
            background: `radial-gradient(120% 100% at 30% 20%, ${rock.colors[0]}, ${rock.colors[1]})`,
            boxShadow:
              "inset 0 -16px 32px rgb(0 0 0 / 0.28), inset 0 8px 16px rgb(255 255 255 / 0.12)",
          }}
        >
          {rock.photo && (
            <img
              src={rock.photo.src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          )}
        </div>
        {rock.photo && <PhotoCredit photo={rock.photo} />}
      </div>

      <div>
        <h2 style={{ margin: "0 0 2px", fontSize: 18 }}>{rock.name}</h2>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{KIND_LABEL[rock.kind]}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Hardness" value={`Mohs ${rock.hardness}`} shot="field-hardness" />
        <Field label="Weight" value={`${rock.grams} g`} shot="field-weight" />
        <Field label="Found at" value={rock.foundAt} shot="field-found-at" />
        <Field label="Found on" value={rock.foundOn} shot="field-found-on" />
      </div>

      <div data-shot="field-notes" style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Notes</span>
        <p style={{ margin: 0, lineHeight: 1.55 }}>{rock.notes}</p>
      </div>

      <button
        type="button"
        data-shot="polish"
        style={{
          padding: "9px 14px",
          borderRadius: 9,
          border: 0,
          background: "var(--accent)",
          color: "var(--accent-fg)",
          fontWeight: 600,
        }}
      >
        Send to the tumbler
      </button>
    </aside>
  );
}
