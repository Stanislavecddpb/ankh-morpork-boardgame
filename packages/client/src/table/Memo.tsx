import { useState } from 'react';

const PAGES = [
  { src: '/memo/memo-1.webp', title: 'Персонажи и районы' },
  { src: '/memo/memo-2.webp', title: 'Символы карточек' },
];

/** Памятка игрока из коробки: кнопка в правом нижнем углу, раскрывается поверх поля. */
export function Memo() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  return (
    <>
      <button className="hand-toggle btn memo-toggle" onClick={() => setOpen(true)}>📜 Памятка</button>
      {open && (
        <div className="popup" onClick={() => setOpen(false)}>
          <div className="popup-box memo-box" onClick={(e) => e.stopPropagation()}>
            <div className="memo-tabs">
              {PAGES.map((p, i) => (
                <button key={p.src} className={`btn ${i === page ? '' : 'ghost'}`} onClick={() => setPage(i)}>{p.title}</button>
              ))}
              <button className="btn ghost memo-close" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
            <img src={PAGES[page].src} alt={PAGES[page].title} />
          </div>
        </div>
      )}
    </>
  );
}
