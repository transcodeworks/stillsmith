import { KIND_LABEL, type Rock } from "@/data/rocks";

export interface RockCardProps {
  rock: Rock;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** One rock on the shelf. */
export function RockCard({ rock, selected = false, onSelect }: RockCardProps) {
  return (
    <button
      type="button"
      data-shot={`rock-${rock.id}`}
      onClick={() => onSelect?.(rock.id)}
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        textAlign: "left",
        borderRadius: 12,
        background: "var(--panel)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
        boxShadow: selected
          ? "0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)"
          : "var(--shadow)",
        color: "inherit",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "relative",
          overflow: "hidden",
          height: 96,
          borderRadius: 8,
          background: `radial-gradient(120% 100% at 30% 20%, ${rock.colors[0]}, ${rock.colors[1]})`,
          boxShadow:
            "inset 0 -12px 24px rgb(0 0 0 / 0.25), inset 0 6px 12px rgb(255 255 255 / 0.12)",
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
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}
      >
        <span style={{ fontWeight: 600 }}>{rock.name}</span>
        {rock.favourite && (
          <span
            data-shot={`favourite-${rock.id}`}
            title="Favourite"
            style={{ color: "var(--accent)" }}
          >
            ★
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, color: "var(--muted)", fontSize: 12 }}>
        <span>{KIND_LABEL[rock.kind]}</span>
        <span aria-hidden>·</span>
        <span>Mohs {rock.hardness}</span>
      </div>
    </button>
  );
}
