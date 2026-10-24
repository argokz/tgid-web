import { dispatchHotkey, type HotkeyEntry } from '~/utils/hotkeys';
import { hasBlockingOverlay, isTypingTarget } from '~/utils/escapeKey';

/**
 * Регистрация в реестре горячих клавиш (utils/hotkeys.ts). Один слушатель `keydown` на окно
 * ставится при первой регистрации — композаблы (`useMapDraw`, `useTopologyEditor`) и компоненты
 * регистрируются сами, layout ничего монтировать не должен. На сервере — пустая операция.
 */
const entries: HotkeyEntry[] = [];
let listening = false;

const onKeydown = (ev: KeyboardEvent) => {
  if (ev.defaultPrevented) return;
  const hit = dispatchHotkey(entries, ev, {
    typing: isTypingTarget(ev.target),
    overlay: hasBlockingOverlay(document),
  });
  if (!hit) return;
  ev.preventDefault();
  ev.stopPropagation();
};

const ensureListener = () => {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', onKeydown);
};

/** Зарегистрировать обработчик; возвращает функцию снятия */
export function registerHotkeys(entry: HotkeyEntry): () => void {
  if (import.meta.server || typeof window === 'undefined') return () => {};
  ensureListener();
  entries.push(entry);
  return () => {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
  };
}

/** Сколько обработчиков зарегистрировано (тесты, отладка) */
export const registeredHotkeyCount = () => entries.length;
