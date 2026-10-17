import { useState, type ImgHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

/**
 * Картинка карты, которая при наведении показывается крупно (как карты в руке):
 * превью встаёт рядом с картинкой, по высоте ~60% экрана, не выходя за края.
 */
export function ZoomImg(props: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [box, setBox] = useState<{ left: number; top: number; height: number } | null>(null);
  return (
    <>
      <img {...props}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const height = Math.min(window.innerHeight * 0.62, 640);
          const width = height * 0.632;
          // Справа от картинки, если помещается, иначе слева (боковая панель — у правого края).
          const left = r.right + 16 + width < window.innerWidth ? r.right + 16 : Math.max(8, r.left - 16 - width);
          const top = Math.max(8, Math.min(r.top + r.height / 2 - height / 2, window.innerHeight - height - 8));
          setBox({ left, top, height });
        }}
        onMouseLeave={() => setBox(null)} />
      {/* В body: стили контейнера (например, ширина картинок в колонке колод) не должны искажать превью. */}
      {box && createPortal(
        <img className="card-preview" src={props.src} alt="" style={{ left: box.left, top: box.top, height: box.height, width: 'auto' }} />,
        document.body,
      )}
    </>
  );
}
