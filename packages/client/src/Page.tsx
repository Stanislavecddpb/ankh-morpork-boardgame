import type { ReactNode } from 'react';

/** Обложка экранов вне партии: пергамент, заголовок шрифтом FolkardCyr. */
export function Page({ title = 'Анк-Морпорк', subtitle, children }: {
  title?: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <div className="page">
      <main className="page-main">
        <header className="page-head">
          <h1>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}

export function PlayerCountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="page-count" role="radiogroup" aria-label="Число игроков">
      {[2, 3, 4].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n}
          className={value === n ? 'on' : ''} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
