# Журналы с записью: паритет с gid6 (этап 9)

Эталон — gid6 remont: `gid6/gid6/remont2.cpp`, `opres2.cpp` (SaveOpresNew / SaveOpres /
delOsmotrOrRemont / ListOpres), `fun.cpp` (OnRemontUtverdit, OnShurfUtverdit),
правила полей `gid6/gidr/tab/remont/*.validate|*.before`. В gid8 большая часть обработчиков
журналов пустая, поэтому он как эталон не используется.

## 1. Что есть в gid6

| Журнал / операция | Функции gid6 | Таблицы БД |
|---|---|---|
| Контур ремонта: создать план (кап./инвест.) / текущий | OnRemontAddPlan (remontTypeID=1, stateID=1, plan_flag=1, utverdit=0), OnRemontAddCurrent (3, 2, utverdit=2) | `remont2` |
| Контур опрессовки: создать план | OnOpresAddPlan (vid_ispytaniID=1, sostoyanie_opresID=1, описание контура по участкам МС/РС) | `opres` |
| Контур осмотра: создать | OnSaveOsmotr2New | `osmotr` |
| Контур освидетельствования | OnSaveOsvidet2New | `osvidet2` (в Алматы таблицы нет) |
| Сохранить состав контура | SaveOpres: `DELETE …Deployed` + `INSERT (directionID, lineID)` по выделенным участкам, обе трубы (nomP и nomO) | `remont2deployed`, `opresdeployed`, `osmotrdeployed` |
| Проверки контура | участок должен быть в МС/РС и в участке ПТС (для ремонта и осмотра) | `heatpipesections`, `pipesections`, `uchastok_ms/rs` |
| Показ контура, список участков | setOsmotr, viewOpresProtokol | те же + `faktory_riska_truboprovoda` |
| Удалить контур | delOsmotrOrRemont: запись + Deployed + факторы риска (тип 2 осмотр, 3 ремонт) | + `faktory_riska_truboprovoda` |
| Утвердить план ремонта | OnRemontUtverdit: дата утверждения, stateID=2, utverdit=1 (после проверки NotNull) | `remont2` |
| Утвердить план шурфовок (пакет) | OnRemontShurfPlanUtverdit + OnShurfUtverditALL: выбор неутверждённых плановых (naznachenie_vskrID=1) за сезон, utverdit=1, дата, назначение, ФИО/должность/служба утверждающего, визирующий | `shurfy`, `dolzhnosti`, `subdivisions` |
| Утверждение опрессовки | флаг utverdit в списке контуров (col_3), утверждающий в карточке | `opres` |
| Нарушения: добавить / удалить / переместить | OnRemontPovrDefAdd/Del/Move | `defect` (+ `defecttube`, `defectkamera`, `defectchannel`, `defectmeropr`, `defectopis`) |
| Шурфы: плановый / внеплановый / удалить / переместить | OnRemontPovrShurfAdd/AddNeplan/Del/Move | `shurfy` (+ `defectsforshurfy`, `vidy_elementov_for_shurfy`, `nalichie_vblizi_kommunikacij_for_shurfy`) |
| Документы (плановые, акты, фото) | вкладка документов карточки | `remontdocuments`, `opresdocuments`, `opresacts`, `osmotrdocuments`, `shurfdocuments`, `defectdocuments` (objid, remontdocumenttypeid, date_doc, path) |
| Факторы риска по участкам ПТС | faktory_riska_truboprovoda_osmotr / _remont / _shurf | `faktory_riska_truboprovoda` |
| Word-планы | Remont_docx1–3 (график выполнения, план кап./инвест., план ремонтов), OnRemontShurfPlanExcel(Month) | — |
| Журналы-выборки | OnRemontPlan/Current/Process/Vypolneno, OnAllPlanRemont2, OnAllPlanShurfy, OnDefectZhurnal* | — |

## 2. Что сделано в web (этап 9)

**API** (`itwin-api/routers/journals.py`, `database/journal_specs.py`, `database/journal_write.py`),
журналы `defects`, `shurfs`, `inspections`, `repairs`, `pressure-tests`:

| Маршрут | Что делает |
|---|---|
| `GET /api/v1/journals`, `GET …/{j}/schema` | какие поля пишутся (ключи — как в API чтения), типы, режимы создания, справочники подписантов и видов документов |
| `POST …/{j}` | создание; `mode` = plan / current / unplanned (значения по умолчанию как в gid6), `line_ids` — сразу контур; точка нарушения/шурфа — из координат или середина трубопровода |
| `PATCH …/{j}/{id}`, `DELETE …/{j}/{id}` | правка только изменённых полей; удаление с Deployed, факторами риска, документами, связями; ссылки из `defect` (remontid/osmotrid/opresid) обнуляются |
| `GET/PUT …/{j}/{id}/contour` | состав контура с GeoJSON и предупреждениями; замена состава как SaveOpres, парная труба подачи/обратки добавляется автоматически |
| `POST …/{j}/{id}/approve`, `POST …/{j}/approve`, `POST …/{j}/{id}/unapprove`, `GET …/{j}/{id}/approval`, `GET …/{j}/approval/candidates` | утверждение одного/пакета, снятие, «кто/когда» (поля записи + audit_log), список неутверждённых планов |
| `GET/POST/PATCH/DELETE …/{j}/{id}/documents[/{doc}]` | реестр документов записи |

Проверки из `*.validate` gid6: уникальность наименования (ремонт, опрессовка, осмотр), порядок дат
(After), парные поля (номер/дата приказа, номер/дата акта), обязательные поля при создании, формат
времени чч:мм, существование ссылок (участки не удалены, справочники). Для утверждения ремонта —
NotNull полей плана из `remont2.validate` и непустой контур; текущий ремонт (utverdit=2) не утверждается.
Колонки утверждения меняются только эндпоинтами утверждения. Права: editor+ и MUTATIONS_ENABLED на
сервере; каждая операция пишет `audit_log` в своей транзакции (INSERT/UPDATE/DELETE/CONTOUR/APPROVE/UNAPPROVE).
Имена таблиц/колонок — только из описания журналов, сверка с каталогом через `sql_ident`.

Старый универсальный CRUD (`/api/v1/update|create|delete/{table}`) для этих таблиц теперь
принимает реальные колонки и ключи журнала (раньше allow-list состоял из несуществующих колонок —
запись из веба всегда падала 400).

**Web**: `components/JournalRecordPanels.vue` (утверждение, контур, документы — в карточках
ремонта, опрессовки, осмотра; утверждение и документы — шурфа; документы — нарушения),
`JournalBatchApprovalDialog.vue` (кнопка «Утвердить план» в журналах ремонтов, шурфов, опрессовок),
`JournalContourPickBar.vue` + `composables/useJournalContourLayer.ts` (контур на карте и выбор участков
кликом), `composables/useJournalRecordForm.ts` (создание/правка/удаление через новые маршруты,
в форме редактируются только записываемые поля). Подтверждение перед удалением, сохранением
контура, утверждением и снятием утверждения; ошибки 422/409 — с подписями полей.

## 3. Чего нет (следующие шаги)

| Что | Почему / что нужно |
|---|---|
| Факторы риска по участкам контура (`faktory_riska_truboprovoda`, gid6 CheckFaktoryRiskaForRemont) | в Алматы трубы не привязаны к участкам ПТС — нечего заполнять; UI и API — отдельная задача |
| Загрузка файлов документов | хранится путь/ссылка, как в gid6; для загрузки нужен `python-multipart` и решение о хранилище |
| Word-планы ремонтов (Remont_docx1–3), Excel плана шурфовок | этап «Excel-отчёты»; сейчас есть только Word-карточка ремонта/опрессовки |
| Описание контура опрессовки из МС/РС (OnOpresAddPlan) | `uchastok_ms/rs` не связаны с участками в Алматы |
| Освидетельствования (`osvidet2`) | таблицы нет в БД Алматы |
| Связанные списки нарушения (defecttube/kamera/channel/meropr/opis), элементы и коммуникации шурфа, `opresacts`, узлы-границы опрессовки (`list_opres_node1/2`) | только чтение и каскадное удаление; правка — отдельные формы |
| Перемещение нарушения/шурфа кликом по карте | API принимает `longitude/latitude`, в UI кнопки нет |
| Улица (`ulicaid`) в форме нарушения/шурфа | 680 улиц — нужен autocomplete; номер дома редактируется |
| Коррозия (`indikator_korrozii`), ТУ, АЛСЕКО | запись идёт через прежний универсальный CRUD/роуты ТУ без типов и проверок; перевести на `journal_specs` тем же способом |
