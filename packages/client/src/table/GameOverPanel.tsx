import { PERSONALITY_BY_ID, type AMState } from '@am/engine';
import { personalityImg } from './assets';

const REASON = {
  personality: 'выполнил условие своей личности',
  vimes: 'колода закончилась — побеждает Командор Ваймс',
  score: 'победа по очкам',
  manual: 'объявлено вручную',
  riots: 'бунты: восемь беспорядков — победа по очкам',
};

export function GameOverPanel({ G, nameOf }: { G: AMState; nameOf: (pid: string) => string }) {
  const over = G.gameover!;
  return (
    <div className="popup">
      <div className="popup-box gameover">
        <h2>Победа: {over.winner != null ? nameOf(over.winner) : 'ничья'}</h2>
        <p>{REASON[over.reason]}</p>
        <div className="reveal">
          {Object.entries(over.personalities).map(([pid, id]) => (
            <figure key={pid}>
              <img src={personalityImg(id)} alt={PERSONALITY_BY_ID[id]?.name} />
              <figcaption>
                {nameOf(pid)}{over.scores && <> — {over.scores[pid]} очк.</>}
              </figcaption>
            </figure>
          ))}
        </div>
        <a className="btn" href="#/">На главную</a>
      </div>
    </div>
  );
}
