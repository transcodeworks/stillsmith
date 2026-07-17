import { RockCard } from "@/components/RockCard";
import type { Rock } from "@/data/rocks";

export interface RockShelfProps {
  rocks: Rock[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

/** The grid of rocks — the main view of the collection. */
export function RockShelf({ rocks, selectedId, onSelect }: RockShelfProps) {
  return (
    <section data-shot="shelf" style={{ padding: 20 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>The Shelf</h2>
        <span data-shot="shelf-count" style={{ color: "var(--muted)", fontSize: 13 }}>
          {rocks.length} specimens
        </span>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))",
          gap: 14,
        }}
      >
        {rocks.map((rock) => (
          <RockCard
            key={rock.id}
            rock={rock}
            selected={rock.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
