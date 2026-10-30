/*!
 * ТГИД — встраиваемая карта тепловой сети, JS SDK (протокол v1).
 *
 *   <div id="tgid-map" style="height:480px"></div>
 *   <script src="https://<сайт ТГИД>/tgid-embed.js"></script>
 *   <script>
 *     var map = TGIDEmbed.create(document.getElementById('tgid-map'), {
 *       url: 'https://<сайт ТГИД>/embed',   // страница карты
 *       key: 'tge_…',                        // ключ встраивания (выдаёт администратор ТГИД)
 *       layers: ['pipes', 'heat_sources'],   // необязательно: часть слоёв ключа
 *       center: [76.9, 43.24], zoom: 14,     // необязательно: начальный вид
 *       ui: true                             // false — без легенды и карточки объекта
 *     });
 *     map.on('select', function (e) { console.log(e.layer, e.id, e.properties); });
 *     map.setView({ center: [76.95, 43.25], zoom: 16 });
 *     map.highlight('pipes', [604, 605]);
 *     map.getView().then(function (v) { console.log(v.view, v.bounds); });
 *   </script>
 *
 * События: ready, select, moveend, error. Команды ждут готовности карты (ready) и уходят только в её iframe.
 */
(function (root) {
  'use strict';

  var SOURCE = 'tgid-embed';
  var VERSION = 1;
  var REPLY_TIMEOUT_MS = 5000;

  function originOf(url) {
    var a = new URL(url, root.location.href);
    return a.origin;
  }

  function buildSrc(options) {
    var u = new URL(options.url, root.location.href);
    u.searchParams.set('key', options.key);
    if (options.layers && options.layers.length) u.searchParams.set('layers', options.layers.join(','));
    if (options.center) u.searchParams.set('center', options.center[0] + ',' + options.center[1]);
    if (typeof options.zoom === 'number') u.searchParams.set('zoom', String(options.zoom));
    if (options.ui === false) u.searchParams.set('ui', '0');
    return u.toString();
  }

  function TGIDMap(container, options) {
    if (!container || !container.appendChild) throw new Error('TGIDEmbed: нужен элемент-контейнер');
    if (!options || !options.url || !options.key) throw new Error('TGIDEmbed: нужны url страницы карты и key');
    this._handlers = {};
    this._queue = [];
    this._pending = {};
    this._seq = 0;
    this._ready = false;
    this._origin = originOf(options.url);

    var frame = root.document.createElement('iframe');
    frame.src = buildSrc(options);
    frame.title = options.title || 'Карта тепловой сети';
    frame.style.border = '0';
    frame.style.width = '100%';
    frame.style.height = options.height ? String(options.height) + (typeof options.height === 'number' ? 'px' : '') : '100%';
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('allowfullscreen', '');
    this.iframe = frame;

    this._onMessage = (event) => {
      if (event.source !== frame.contentWindow || event.origin !== this._origin) return;
      var m = event.data;
      if (!m || m.source !== SOURCE || m.v !== VERSION || typeof m.type !== 'string') return;
      if (m.type === 'view' && this._pending[m.id]) {
        this._pending[m.id](m);
        return;
      }
      if (m.type === 'ready') {
        this._ready = true;
        var queued = this._queue;
        this._queue = [];
        for (var i = 0; i < queued.length; i++) this._post(queued[i]);
      }
      this._emit(m.type, m);
    };
    root.addEventListener('message', this._onMessage);
    container.appendChild(frame);

    this.ready = new Promise((resolve) => {
      this.on('ready', resolve);
    });
  }

  TGIDMap.prototype._emit = function (type, payload) {
    var list = (this._handlers[type] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        if (root.console) root.console.error('TGIDEmbed: ошибка в обработчике «' + type + '»', err);
      }
    }
  };

  TGIDMap.prototype._post = function (command) {
    if (!this.iframe || !this.iframe.contentWindow) return;
    var message = { source: SOURCE, v: VERSION };
    for (var k in command) if (Object.prototype.hasOwnProperty.call(command, k)) message[k] = command[k];
    this.iframe.contentWindow.postMessage(message, this._origin);
  };

  TGIDMap.prototype._send = function (command) {
    if (this._ready) this._post(command);
    else this._queue.push(command);
  };

  /** Подписаться на событие; возвращает функцию отписки */
  TGIDMap.prototype.on = function (type, handler) {
    (this._handlers[type] = this._handlers[type] || []).push(handler);
    return () => this.off(type, handler);
  };

  TGIDMap.prototype.off = function (type, handler) {
    var list = this._handlers[type] || [];
    var i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  };

  /** { center: [долгота, широта], zoom } — любое из двух */
  TGIDMap.prototype.setView = function (view) {
    this._send({ type: 'setView', center: view && view.center, zoom: view && view.zoom });
  };

  /** [запад, юг, восток, север] в градусах */
  TGIDMap.prototype.fitBounds = function (bounds, padding) {
    this._send({ type: 'fitBounds', bounds: bounds, padding: padding });
  };

  /** Видимые слои — из слоёв ключа */
  TGIDMap.prototype.setLayers = function (layers) {
    this._send({ type: 'setLayers', layers: layers });
  };

  /** Подсветить объекты слоя по id; пустой список — снять подсветку */
  TGIDMap.prototype.highlight = function (layer, ids) {
    this._send({ type: 'highlight', layer: layer, ids: ids || [] });
  };

  /** Текущий вид: Promise<{ view: { center, zoom }, bounds }> */
  TGIDMap.prototype.getView = function () {
    var id = 'v' + (++this._seq);
    return new Promise((resolve, reject) => {
      var timer = root.setTimeout(() => {
        delete this._pending[id];
        reject(new Error('TGIDEmbed: карта не ответила'));
      }, REPLY_TIMEOUT_MS);
      this._pending[id] = (m) => {
        root.clearTimeout(timer);
        delete this._pending[id];
        resolve({ view: m.view, bounds: m.bounds });
      };
      this._send({ type: 'getView', id: id });
    });
  };

  /** Убрать карту и подписки */
  TGIDMap.prototype.destroy = function () {
    root.removeEventListener('message', this._onMessage);
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    this._handlers = {};
    this._queue = [];
  };

  root.TGIDEmbed = {
    version: VERSION,
    create: function (container, options) { return new TGIDMap(container, options); },
  };
})(window);
