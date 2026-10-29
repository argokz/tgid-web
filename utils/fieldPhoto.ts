/**
 * Фото и координаты с телефона для полевого приложения: фото уменьшается на устройстве (камера даёт 4–12 МБ,
 * сервер принимает до 2 МБ — itwin-api work_orders.MAX_PHOTO_BYTES), положение — один замер GPS на действие.
 */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_MAX_BYTES = 2_000_000;
const QUALITIES = [0.82, 0.7, 0.55];
const GPS_TIMEOUT_MS = 8000;
/** замер не старше минуты годится: бригада стоит у места работ */
const GPS_MAX_AGE_MS = 60_000;

/** Размер, вписанный в квадрат maxSide (не увеличивая) */
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Фото с камеры → JPEG не больше PHOTO_MAX_SIDE по длинной стороне и PHOTO_MAX_BYTES. Поворот по EXIF
 * учитывает createImageBitmap (imageOrientation: 'from-image'). Не удалось декодировать — исходный файл,
 * если он и так подходит; иначе ошибка с текстом для бригады.
 */
export async function downscalePhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (file.size <= PHOTO_MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw new Error('Не удалось открыть фото — снимите ещё раз или выберите JPEG');
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не умеет уменьшать фото');
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const q of QUALITIES) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new Error('Фото слишком большое даже после уменьшения');
  } finally {
    bitmap.close();
  }
}

export interface LonLat {
  lon: number;
  lat: number;
}

/** Где телефон сейчас; нет разрешения, нет спутников за 8 с — null (действие уходит без координат) */
export function currentPosition(): Promise<LonLat | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lon: Number(p.coords.longitude.toFixed(6)), lat: Number(p.coords.latitude.toFixed(6)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: GPS_MAX_AGE_MS },
    );
  });
}

/** Ссылка «Маршрут»: geo: открывает навигатор на Android; на iPhone — Apple Maps */
export function routeLink(lat: number, lon: number, label: string, userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(label)}`;
  }
  return `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(label)})`;
}
