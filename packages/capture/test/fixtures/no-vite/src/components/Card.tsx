import "../card.css";

export function Card({ title }: { title: string }) {
  return (
    <div className="card stillsmith-postcss-ok" data-shot="card">
      <h1>{title}</h1>
    </div>
  );
}
