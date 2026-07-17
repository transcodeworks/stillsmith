import { RockInspector } from "@/components/RockInspector";
import { RockShelf } from "@/components/RockShelf";
import { Toolbar } from "@/components/Toolbar";
import type { Rock } from "@/data/rocks";

export interface WorkspaceProps {
  rocks: Rock[];
  selected: Rock;
}

/** The whole app: chrome, shelf, inspector. */
export function Workspace({ rocks, selected }: WorkspaceProps) {
  return (
    <div
      data-shot="workspace"
      style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}
    >
      <Toolbar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <main style={{ flex: 1, overflow: "auto" }}>
          <RockShelf rocks={rocks} selectedId={selected.id} />
        </main>
        <RockInspector rock={selected} />
      </div>
    </div>
  );
}
