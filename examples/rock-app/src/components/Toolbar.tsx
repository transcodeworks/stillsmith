/** App chrome: title, search, and the button that adds a specimen. */
export function Toolbar({ query = "" }: { query?: string }) {
  return (
    <header
      data-shot="toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)",
      }}
    >
      <strong data-shot="brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden>🪨</span> Pebble
      </strong>

      <input
        data-shot="search"
        readOnly
        value={query}
        placeholder="Search the collection…"
        style={{
          flex: 1,
          maxWidth: 360,
          padding: "7px 11px",
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--panel-2)",
          color: "var(--fg)",
          font: "inherit",
        }}
      />

      <span style={{ flex: 1 }} />

      <button
        type="button"
        data-shot="add-rock"
        style={{
          padding: "7px 13px",
          borderRadius: 8,
          border: 0,
          background: "var(--accent)",
          color: "var(--accent-fg)",
          fontWeight: 600,
        }}
      >
        Add specimen
      </button>
    </header>
  );
}
