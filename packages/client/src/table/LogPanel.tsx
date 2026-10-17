import { useState } from 'react';

const KEY = 'am:log-open';
const load = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

/** Журнал партии: свежие строки сверху; сворачивается (запоминается в браузере). */
export function LogPanel({ log }: { log: string[] }) {
  const [open, setOpen] = useState(load);
  const toggle = () => {
    setOpen(!open);
    try { localStorage.setItem(KEY, open ? '0' : '1'); } catch { /* приватный режим */ }
  };
  return (
    <section className={`log ${open ? '' : 'closed'}`}>
      <button className="log-head" onClick={toggle}>Журнал {open ? '▾' : '▸'}</button>
      {open
        ? log.slice(-60).reverse().map((line, i) => <div key={log.length - i}>{line}</div>)
        : log.length > 0 && <div className="log-last">{log[log.length - 1]}</div>}
    </section>
  );
}
