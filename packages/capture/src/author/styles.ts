/** Styles for the authoring GUI, inlined so the bundle stays a single file. */
export const STYLES = `
:root {
  --bg: #0e1116;
  --panel: #161b22;
  --line: #262c36;
  --fg: #e6e9ee;
  --muted: #8b949e;
  --accent: #3b82f6;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
}
button, input, select, textarea {
  font: inherit;
  color: var(--fg);
  background: #0d1117;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 8px;
}
button { cursor: pointer; background: #1c2128; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.45; cursor: default; }

.app { display: flex; flex-direction: column; height: 100vh; }

header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
header .spacer { flex: 1; }
header .status { color: var(--muted); min-width: 56px; text-align: right; }
button.save { background: var(--accent); border-color: var(--accent); font-weight: 600; }
button.save:disabled { background: #1c2128; border-color: var(--line); }

.error {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 8px 12px;
  background: #3b1418; border-bottom: 1px solid #5c1f26; color: #ffb4bb;
}

.panels { flex: 1; min-height: 0; width: 100%; }

.stage { height: 100%; padding: 16px; overflow: auto; }
.stage-panel { min-width: 0; overflow: hidden; }
.stage-meta { color: var(--muted); margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.stage-frame { overflow: hidden; border: 1px solid var(--line); border-radius: 8px; }
.stage iframe { border: 0; display: block; }

.panel {
  background: var(--panel);
  overflow: auto;
  min-width: 0;
  height: 100%;
}
.panel.annotations { padding: 12px; }
.sidebar { height: 100%; padding: 12px; }

.resize-handle {
  width: 5px;
  flex: 0 0 5px !important;
  background: var(--line);
  outline: none;
  transition: background 0.12s ease;
}
.resize-handle:hover,
.resize-handle[data-separator="active"],
.resize-handle:focus-visible {
  background: var(--accent);
}

.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
.list-head > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-actions { display: flex; gap: 4px; flex: 0 0 auto; }
.list-actions button { padding: 0 8px; }
.list { list-style: none; margin: 0 0 12px; padding: 0; }
.list li {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border: 1px solid transparent; border-radius: 6px; cursor: pointer;
}
.list li:hover { background: #1c2128; }
.list li.sel { border-color: var(--accent); background: #172033; }
.list li.muted { color: var(--muted); cursor: default; }
.list .k { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list .t { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list .badge {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--muted);
  background: #0d1117;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}
.list li button { padding: 0 6px; }

.fields { border-top: 1px solid var(--line); padding-top: 12px; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.row > span:first-child { width: 88px; flex: 0 0 88px; color: var(--muted); }
.row-control { flex: 1; display: flex; }
.row-control > * { width: 100%; }
.row-control input[type="checkbox"] { width: auto; }

fieldset { border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin: 10px 0; }
legend { display: flex; align-items: center; gap: 8px; color: var(--muted); padding: 0 4px; }
button.pick { padding: 1px 8px; }
button.pick.active { background: var(--accent); border-color: var(--accent); }

.empty { padding: 32px; color: var(--muted); }

.mode-toggle { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.mode-toggle button { border: 0; border-radius: 0; background: transparent; padding: 3px 10px; color: var(--muted); }
.mode-toggle button.on { background: var(--accent); color: #fff; }

.route-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.route-bar form { display: flex; gap: 4px; }
.route-bar input { width: 220px; }

.warnings {
  padding: 6px 12px;
  background: #3b2f14; border-bottom: 1px solid #5c4a1f; color: #ffd88a;
}

.hint { color: var(--muted); margin: -2px 0 8px 96px; font-size: 12px; }
.list .reorder { display: flex; gap: 2px; flex: 0 0 auto; }
.list .reorder button { padding: 0 5px; }
`;
