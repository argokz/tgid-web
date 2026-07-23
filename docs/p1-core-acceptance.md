# P1 — приёмка ядра (sety / пьезометр / паспорт / топология)

Чеклист для контрольной (тестовой) копии БД. Не выполнять mutating-сценарии на production.

## Предусловия

- Копия БД с известными эталонными фрагментами desktop.
- API: `AUTH_DISABLED=true` только на стенде приёмки, либо выданный JWT роли `calculator`/`admin`.
- `TOPOLOGY_MUTATIONS_ENABLED=false` до отдельного разрешения.
- Desktop `gid8` на той же копии БД для сверки чисел.

## 1. Расчёт sety

1. В desktop: плановый расчёт выбранного фрагмента, сохранить протокол и ключевые узлы (`PT_OUT`/`UT_OUT` расходы, напоры, температуры).
2. В web: тот же фрагмент → «Расчёт» → дождаться Celery SUCCESS.
3. Сверить минимум 5 узлов и 5 линий: расход, напор, температура (±допуск предметника).
4. Зафиксировать `calculation_id`, `task_id`, расхождения в `docs/acceptance-results/`.

Smoke (без БД эталона):

```bash
curl -s -X POST "$API/run-sety-cmd" -H "Content-Type: application/json" \
  -d "{\"params\": \"--help-or-fragment-args\"}"
curl -s "$API/task/<task_id>"
```

Скрипт: [`scripts/acceptance/p1_smoke.py`](../scripts/acceptance/p1_smoke.py)

## 2. Пьезометр

1. Выбрать два узла с известным путём в desktop.
2. В web: режим трассировки / PiezometerModal → график.
3. Сверить упорядоченный список узлов и значения напоров на графике.

## 3. Excel-паспорт

1. В desktop: паспорт участка MAG/MS/RS для контрольного объекта.
2. В web: PassportDialog → выгрузка Excel.
3. Визуально сверить 15 листов; проверить кириллицу (риск двойной перекодировки в `passport_module`).

## 4. Топология (только тестовая БД)

Включать только после бэкапа:

```
TOPOLOGY_MUTATIONS_ENABLED=true
MUTATIONS_ENABLED=true
NUXT_PUBLIC_TOPOLOGY_EDITING_ENABLED=true
AUTH_DISABLED=false  # + JWT admin
```

Сценарии:

1. Создать узел → создать линию → move → split → soft-delete.
2. Проверить `heatpipesections` копирование при split.
3. Убедиться, что зависимые `lineid/nodeid*` не «сиротеют» без правил (зафиксировать список затронутых таблиц).

## Definition of Done P1

- [ ] sety: численная сверка подписана предметником
- [ ] пьезометр: путь и значения совпали
- [ ] паспорт: 15 листов читаемы, данные совпали
- [ ] topology: E2E на копии БД зелёный; production флаги остаются `false`
