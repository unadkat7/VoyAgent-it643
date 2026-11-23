export default function ConversionFunnel({ funnel = [] }) {
  const highest = Math.max(0, ...funnel.map((step) => step.count));
  return (
    <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">Activity by stage</h2>
      <p className="mt-1 mb-4 text-sm text-muted">Visitors and accounts counted independently at each stage in this period.</p>
      {highest === 0 ? <p className="text-sm text-muted">No stage activity in this period.</p> : (
        <ul className="space-y-3">
          {funnel.map(({ key, label, count }) => (
            <li key={key}>
              <div className="mb-1 flex justify-between gap-2 text-sm"><span>{label}</span><strong>{count.toLocaleString("en-IN")}</strong></div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-bg-subtle">
                <div className="h-full rounded-full bg-primary" style={{ width: `${count / highest * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
