export function LogPanel({ log }: { log: string[] }) {
  return (
    <section className="log">
      {log.slice(-60).reverse().map((line, i) => <div key={log.length - i}>{line}</div>)}
    </section>
  );
}
