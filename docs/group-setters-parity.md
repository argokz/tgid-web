# Групповые установщики (aSet*) и справочники — паритет с десктопом

Этап 9. Эталон: gid8 `gidview/gidrSlot.cpp` (onSet*), `set_line/set_line.cpp`
(`setSomething` / `setValue` / `setMark*Value`), `dialog/NoVisual.cpp` (справочники);
gid6 `set_obl.cpp` (OnSet*). API: `itwin-api/database/group_setters.py`,
`database/dictionaries.py`, роуты `routers/group_setters.py`. Web: `GroupSetterDialog.vue`,
`DictionariesDialog.vue` (каталог инструментов → «Исходные данные», роль editor+).

## Как работает десктоп

- Меню «Выделение → Область → Выделить область», затем «Потребители» / «Участки
  теплопроводов» / «Код расчётной схемы» / «Надписи». Пункты активны только при выделении
  (`addActionWithCondition(..., is_mark)`).
- `setSomething(is_node, typ, col, default)`: значение — из справочника (GID.lookup; для
  справочников с `fileID` — только записи текущего фрагмента) или число через `QInputDialog`;
  подтверждение «все поля X будут установлены в Y», затем
  `UPDATE <таблица> SET col = val WHERE nodeID|lineID|id IN (<выделенные>)`.
- `setValue(TIP_PO, …)` после `setSomething(TIP_PR, …)` — то же значение пишется и в
  обобщённых потребителей (часто в другую колонку: `hourIrregCoeff` → `hourIrregCoeffOpen`).
- Журнал: `change_group_start/end` (legacy-триггеры `log_changes` пишут audit_log).

## Как работает веб

- Набор объектов: **фрагмент(ы)** (`fileid`), **выбрано на карте** (клики по участкам или
  узлам, режим выбора `useJournalMapBridge` с `kind: 'node'`), **фильтр** — фрагменты,
  видимая область карты (аналог «Выделить область», `bbox` → `ST_MakeEnvelope` в SRID схемы),
  условия «поле = значение / пусто / заполнено» по полям установщиков той же цели.
  «Вся база» без условий не допускается. До 50 000 объектов за операцию.
- Цели: потребители (`nodes.id`, у которых есть realconsumers/generalizedconsumers),
  участки теплопроводов (`linesobj.id` с heatpipesections), линейные объекты (`linesobj`),
  узлы (`nodes`). Удалённые (`removed ≠ 0`) не входят.
- **Предпросмотр (dry-run)**: число объектов и строк по таблицам, сколько реально изменится,
  до 200 строк «было → станет», id, не подошедшие к установщику, предупреждения (поле в расчёте,
  запись справочника из другого фрагмента).
- **Применение**: editor+, `MUTATIONS_ENABLED`; одна транзакция; `expected_changes` из
  предпросмотра — при расхождении 409 `stale_preview`. Триггеры `log_changes` пишут построчный
  audit_log с `tgid.current_group_id`, API добавляет сводку `GROUP_SET` от имени пользователя.
- **Отмена**: `POST /api/v1/group-setters/undo` (dry-run и применение) — старые значения из
  audit_log группы; строки, изменённые после операции, не трогаются (`conflicts`); исходные
  строки помечаются `is_rolled_back`, пишется `GROUP_UNDO`. Повторная отмена → 409.

## Карта установщиков

| Ключ API | Десктоп | Цель | Пишется | Значение |
|---|---|---|---|---|
| responsible | gid8 aSetOtv, gid6 OnSetOtv | потребители | realconsumers.responsibleid | responsibles (statusid = 15) |
| calc_temperature | aSetTr / OnSetTr | потребители | real+generalized .calctemperatureid | calctemperatures (фрагмент) |
| spec_expend | aSetUr / OnSetUr | потребители | real+generalized .specexpendid | specexpends (фрагмент) |
| var_coeff_consumers | aSetKvPt / OnSetKvPt | потребители | real+generalized .varcoeffid | varcoefficients (фрагмент) |
| mix_factor | aSetUf / OnSetUf | потребители | realconsumers.mixfactcoeff | число, 2.2 |
| vol_ventilation | aSetUdobVent | потребители | real+generalized .volwatervs | число, 1 |
| vol_heating | aSetUdobOt | потребители | real+generalized .volwaterhs | число, 1 |
| open_hour_coeff | aSetOpenKoef | потребители | real.hourirregcoeff, gen.hourirregcoeffopen | 1.2 |
| open_recirc_loss | aSetOpenRez | потребители | real.circhlosopen, gen.avghlcompopen | 30 |
| open_recirc_temp | aSetOpenRezT | потребители | real.temprecircpipe, gen.temprecircpipeopen | 40 |
| open_hw_temp | aSetOpenGvsT | потребители | real.calctemphwdo, gen.calctemphwdoopen | 60 |
| heat_point | gid6 OnSetTp (gid8 закомментирован) | потребители | realconsumers.heatpointid | heatpoint |
| automation | gid6 OnSetAvtoOn/Off (gid8 пустые) | потребители | realconsumers.automdegid | automdegs |
| throttle_sign | gid6 OnSetShaiba | потребители | realconsumers.calcferdiametersignid | calcferdiametersigns |
| diameter | aSetDiams / OnSetDiams | участки | diametercondit/external/internal, wallthickness | standardtubes ГОСТ/Стандарт/Россия |
| local_losses_share | aSetLosesShare | участки | heatpipesections.locallosesshare | 0 |
| work_hours | aSetKolChas | участки | heatpipesections.signnumwork | signnumworks |
| var_coeff_pipes | aSetKvUt / OnSetKvUt | участки | varcoeffidflow + varcoeffidret | varcoefficients (фрагмент) |
| heat_test_coeff | aSetKti / OnSetKti | участки | heatpipesections.heattestscoeff | 1 |
| pipe_repair_type | aSetPipeRemontType / OnSetRemontType | участки | heatpipesections.piperemonttypeid | piperemonttypes |
| tubing_type | aSetTubingType | участки | heatpipesections.tubingtypeid | tubingtypes |
| roughness | aSetSher / OnSetSher | участки | heatpipesections.tuberoughness | 0.5 |
| date_last_relay | gid6 OnSetDate1 (gid8 пустой) | участки | lasttransdate | дата |
| date_commissioning | gid6 OnSetDate2 | участки | firstpicdatehp + lasttransdate (как gid6) | дата |
| date_planned_repair | gid6 OnSetDate3 | участки | repairdateplantp | дата |
| length | aSetLength / OnSetLength | участки | heatpipesections.pipesectlength | ST_Length(linesobj.shape), м |
| organization | aSetOrg / OnSetOrg | линейные объекты | linesobj.organizationid | organizations |
| line_labels | aSetPodpOn/Off | линейные объекты | linesobj.displaysign | 0 показывать / 1 нет |
| scheme_code | aSetKodRs / OnSetKodRs | узлы | nodes.externalcodeid | externalcodes (фрагмент, не удалённые) |
| node_labels | aSetPodpOn/Off | узлы | nodes.displaysign | 0 / 1 |

Не перенесены: `aSetTp` в gid8 (закомментирован; есть gid6-вариант `heat_point`),
`aSetKorrozia` (gid6 — отдельный сценарий планирования индикаторов коррозии, не установщик
поля), `aSetCoordNull` (обнуление координат — операция топологии), `OnSetUchRs/UchMs`
(gid6-режимы выделения участков эксплуатации), `aSetPsMap/aSetAddr/aSetLineid/aSetIst`
(в gid8 пустые обработчики), `OnSetPodpOnAll/OffAll` («для всей базы» — в вебе только по набору).
Отличие: надписи узлов и участков — два установщика (десктоп меняет оба за раз).

## Справочники (`/api/v1/dictionaries`)

| Ключ | Таблица | Фрагмент | Проверка ссылок при удалении (409) |
|---|---|---|---|
| spec-expends | specexpends | да | real/generalized .specexpendid |
| var-coefficients | varcoefficients (Kv, влияет на расчёт) | да | real/generalized .varcoeffid, heatpipesections.varcoeffidflow/ret |
| calc-temperatures | calctemperatures | да | real/generalized .calctemperatureid |
| gvs-load-graphs | gvsloadgraphs (график ГВС) | да | real/generalized .gvsloadgraphid |
| organizations | organizations | нет | linesobj/nodes/heatpipesections/pipesections .organizationid, павильоны, камеры, каналы, компенсаторы, uchastok_rs, контроль техсостояния |
| exploitation-districts | rayon_ekspluatatsii | нет | источники, участки эксплуатации, здания ТУ, капремонт, defekt2 |
| administrative-districts | administrativnyy_rayon | нет | по наименованию: zhile, zhile1, organizatsii (АЛСЕКО) |
| responsibles | responsibles (техники) | нет | realconsumers и журналы (.responsibleid) |

Как gid8 NoVisual: коды UR/TR/KV/GV живут по фрагментам (`fileid` обязателен при создании),
удаление запрещено, пока код используется. Дополнительно: код уникален в пределах фрагмента
(409 `duplicate`), перенос используемой записи в другой фрагмент запрещён. Поля формы — все
колонки таблицы из каталога, кроме служебных (`id`, `id_old`, геометрия); подписи — из
`rus_names`. Каждая запись/правка/удаление пишет audit_log.

## Данные Алматы (копия)

- `responsibles` пустая → установщик «ФИО техников» без значений, пока техников не заведут
  в справочнике.
- `gvsloadgraphs`, `districts`, `administrativedistricts` пустые; `heatpoint` пустая.
- Все записи specexpends, на которые ссылаются потребители, из того же фрагмента, что и узел.
