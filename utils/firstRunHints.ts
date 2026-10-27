/**
 * Подсказка первого запуска по зонам экрана (этап 8, раздел 4 плана): 3–4 шага, закрывается и не возвращается.
 * Шаг привязан к зоне через селектор; зоны, которых на экране нет (телефон, свёрнутая колонка), пропускаются.
 */
export type HintSide = 'bottom' | 'left' | 'right';

export interface FirstRunStep {
  id: string;
  /** Селекторы якоря по порядку: первый видимый */
  anchors: string[];
  side: HintSide;
  title: string;
  text: string;
}

export const FIRST_RUN_STORAGE_KEY = 'firstRunHints';
/** Версия набора шагов: новая — показать ещё раз тем, кто видел прежний */
export const FIRST_RUN_VERSION = '1';

export const FIRST_RUN_STEPS: FirstRunStep[] = [
  {
    id: 'sections',
    anchors: ['.nav-links'],
    side: 'bottom',
    title: 'Разделы',
    text: 'Расчёт, протокол и выгрузки — здесь. Справа — поиск по всему (Ctrl+K), инструменты и ваш профиль.',
  },
  {
    id: 'layers',
    anchors: ['.desktop-sidebar', '.sidebar-toggle-wrap'],
    side: 'right',
    title: 'Слои и фрагменты',
    text: 'Слева — видимость и порядок слоёв, фрагменты сети, подписи и ПТС.',
  },
  {
    id: 'map-tools',
    anchors: ['.map-controls'],
    side: 'left',
    title: 'Инструменты карты',
    text: 'Справа сверху — измерения, пьезометр и информация об объекте, внизу — вид карты и масштаб. Наведите на кнопку — появится подсказка.',
  },
  {
    id: 'palette',
    anchors: ['[data-first-run="palette"]'],
    side: 'bottom',
    title: 'Команды и поиск',
    text: 'Ctrl+K — журнал, инструмент, узел сети или адрес по названию. Клавиша ? — все горячие клавиши.',
  },
];

export interface HintRect { left: number; top: number; width: number; height: number }
export interface HintSize { w: number; h: number }

/** Отступ карточки от якоря и от краёв окна */
export const HINT_GAP_PX = 12;

/**
 * Положение карточки у якоря: со своей стороны, а если не помещается — с противоположной (или снизу/сверху);
 * затем прижать к окну. Возвращает левый верхний угол.
 */
export function placeHintCard(anchor: HintRect, card: HintSize, view: HintSize, side: HintSide): { x: number; y: number } {
  const g = HINT_GAP_PX;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const centerX = anchor.left + anchor.width / 2 - card.w / 2;
  const centerY = anchor.top + anchor.height / 2 - card.h / 2;
  let x: number;
  let y: number;
  if (side === 'bottom') {
    x = centerX;
    y = anchor.top + anchor.height + g;
    if (y + card.h > view.h - g) y = anchor.top - card.h - g;
  } else {
    const right = anchor.left + anchor.width + g;
    const left = anchor.left - card.w - g;
    const fitsRight = right + card.w <= view.w - g;
    const fitsLeft = left >= g;
    if (side === 'right' ? fitsRight : !fitsLeft && fitsRight) x = right;
    else if (fitsLeft) x = left;
    else {
      // ни слева, ни справа (узкий экран) — под якорем
      x = centerX;
      y = anchor.top + anchor.height + g;
      return { x: Math.round(clamp(x, g, view.w - card.w - g)), y: Math.round(clamp(y, g, view.h - card.h - g)) };
    }
    y = centerY;
  }
  return {
    x: Math.round(clamp(x, g, Math.max(g, view.w - card.w - g))),
    y: Math.round(clamp(y, g, Math.max(g, view.h - card.h - g))),
  };
}
