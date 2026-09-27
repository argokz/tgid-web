# Excel-отчёты: паритет с десктопом (этап 9)

Десктоп gid6, меню «Excel» (`gidrView.cpp OnExcel2`): список `gid6/gidr/excel2/*.lst`. Каждый `.lst` —
шаблон `.xls` и пары «SQL из `excel2/sql2`, строка шапки, номер листа», плюс DOP-ячейки
(режим, дата/время расчёта, Tнаруж). `CCxema::Excel2List` подставляет `$fileID$` (активный
фрагмент) и `$calculationID$` (последний расчёт фрагмента, `getOutID`) и пишет строки
запроса под шапку листа начиная с колонки A. Всего в `excel2/sql2` 44 SQL.

В вебе то же самое:

- SQL: `itwin-api/sql/reports/*.sql`, PostgreSQL, параметры `$1` (фрагмент) и `$2` (расчёт),
  значения в текст не подставляются. `{{_consumerview}}`: общий подзапрос потребителей
  (в десктопе это представление `consumerview`, в PG его нет).
- Шаблоны: `itwin-api/report_templates/excel2/*.xlsx`, переведены из десктопных `.xls` один к одному
  (Excel), шапки, объединения и ширины колонок совпадают.
- Каталог и сборка: `database/excel_reports.py`; API `GET /api/reports/catalog`,
  `GET /api/reports/catalog/{id}/excel?fragment_id=&calculation_id=` (по умолчанию последний расчёт
  фрагмента, как `getOutID`). Запросы в read-only транзакции, `statement_timeout` 60 с, книга
  собирается в потоке. Самый тяжёлый отчёт на Алматы («Участки теплопроводов», 8,9 тыс. строк)
  собирается за ~7 с, поэтому Celery не понадобился.
- Web: инструмент «Отчёты Excel» (группа «Реестры и отчёты») → `ExcelReportsDialog.vue`:
  каталог с поиском и группами, фрагмент, расчёт, скачивание через `fastApiService` (Bearer).
  В том же каталоге остались 9 сводных ведомостей веба (`/api/reports/excel/{doc_type}`).
- Проверки: `tests/test_excel_reports.py` (без БД: нет диалекта MS SQL, только `$1/$2`, листы
  и строки шапки шаблонов), `scripts/golden/reports_smoke.py` (каждый SQL и каждая книга на живой базе).

Отличия от десктопа:

- Порядок строк: в десктопе он шёл по обходу графа (`vyd.id1`), в вебе `ORDER BY` код схемы → узел → id.
- Отчёт по выделению на схеме (`isMark`) не перенесён, отчёт строится по всему фрагменту.
- Если колонок в запросе больше, чем в шапке шаблона, десктоп писал их без подписи. Веб подписывает их
  именем поля в строке номеров колонок; так сделано в gnc, grd, gre, grr, gur, gup и в `gpt` (+1).

## Карта 44 SQL (`excel2/sql2`)

Данные посчитаны на `almatygid_copy`, фрагмент 74, расчёт 3. «—» в колонке «Строк» означает, что SQL не перенесён.
Условные обозначения: Ф — фрагмент, Р — расчёт.

| SQL gid6 | Меню `.lst` / лист | Параметры | Основные таблицы | Веб: файл → отчёт | Строк (Алматы, ф74) | Примечание |
|---|---|---|---|---|---|---|
| Участки | Участки; OUT_Участки теплопроводов /1 | Ф | heatpipesections, linesobj, nodes | vh_uchastki → gut, out_ut | 1818 | была упрощённая ведомость `ut` |
| OUT_Участки | OUT_Участки теплопроводов /2 | Ф, Р | ut_out | out_uchastki → out_ut | 3458 | расчёт перенесён из WHERE в LEFT JOIN |
| OUT_Участки_Теплогидравлика | OUT_Участки теплопроводов /3 | Ф, Р | ut_out | out_uchastki_teplogidravlika → out_ut | 3458 | 3 хвостовые колонки за шапкой убраны |
| OUT_Участки Отключенные | OUT_Участки теплопроводов /4 | Ф, Р | ut_out, heatpipesections | out_uchastki_otklyuchennye → out_ut | 133 | |
| Потребители реальные | Потребители реальные /1; OUT_Потребители /1 | Ф | realconsumers | vh_potrebiteli_realnye → gpt, out_pt | 6 | в Алматы реальные почти только во фр. 72–86 (2817) |
| Потребители обобщенные | Потребители обобщенные; OUT_Потребители /2 | Ф | generalizedconsumers | vh_potrebiteli_obobshennye → gpo, out_pt | 1031 | была сводная `pt` |
| OUT_PT_Расчетные нагрузки | OUT_Потребители /3 | Ф | consumerview | out_pt_raschetnye_nagruzki → out_pt | 1037 | consumerview собран подзапросом |
| OUT_Потребители2 | OUT_Потребители /4 | Ф, Р | pt_out | out_potrebiteli_gidravlika → out_pt | 958 | DOP: режим, дата, время, Tн |
| OUT_PT_Тепло | OUT_Потребители /5 | Ф, Р | consumerview, pt_out | out_pt_teplo → out_pt | 958 | в PG нет представления consumerview |
| OUT_PT_ТеплоГидравл | OUT_Потребители /6 | Ф, Р | consumerview, pt_out | out_pt_teplogidravlika → out_pt | 958 | |
| OUT_PT_Отключенные | OUT_Потребители /7 | Ф, Р | real/generalizedconsumers, pt_out | out_pt_otklyuchennye → out_pt | 79 | в сумму z добавлено независимое отопление |
| OUT_PT_Отключенные_реальные | OUT_Дроссельные органы /3 | Ф, Р | realconsumers, pt_out | out_pt_otklyuchennye_realnye → out_dr | 5 | в десктопе колонки съезжали |
| Дроссели | Потребители реальные /2; OUT_Дроссельные органы /1 | Ф | realconsumers | vh_drosseli → gpt, out_dr | 6 | |
| OUT_Дроссельные органы | OUT_Дроссельные органы /2 | Ф, Р | dr_out | out_drosselnye_organy → out_dr | 0 | **dr_out пуста** (расчёт дросселей не сохраняется) |
| Задвижки | Задвижки; OUT_Задвижки /1 | Ф | dampers | vh_zadvizhki → gzd, out_zd | 35 | была сводная `zd` |
| OUT_Задвижки1 | OUT_Задвижки /2 | Ф, Р | zd_out, dampers | out_zadvizhki → out_zd | 35 | |
| OUT_Задвижки_Упр | OUT_Задвижки /3 | Ф, Р | zd_out | out_zadvizhki_upr → out_zd | 0 | в Алматы нет dispatcherswitch = «Управляющая» |
| OUT_Задвижки_Секц | OUT_Задвижки /4 | Ф, Р | zd_out | out_zadvizhki_sekc → out_zd | 0 | 52 «Секционирующих», но не во внутренних схемах фр. 74 |
| OUT_Задвижки_НС | OUT_Задвижки /5 | Ф, Р | zd_out, pumpstations | out_zadvizhki_ns → out_zd | 15 | |
| OUT_Задвижки_ТП | OUT_Задвижки /6 | Ф, Р | zd_out, nodes.nodetypeid 7–11 | out_zadvizhki_tp → out_zd | 0 | во фр. 74 нет ТП с zd_out |
| OUT_Насосные_агрегаты | OUT_Насосные агрегаты | Ф, Р | ns_out, standardpumps | out_nasosnye_agregaty → out_nsa | 37 | `ns_out.a19` (текст) сравнивается с `standardpumps.id::text` |
| Насосный агрегат | Насосный агрегат | Ф | pumps, standardpumps | vh_nasosny_agregat → gns | 41 | в десктопе запрос брал NS_OUT мимо шапки; здесь исходная `pumps`; была сводная `ns` |
| Насосная станция | Насосная станция | Ф | pumpstations | vh_nasosnaya_stanciya → gnc | 29 | |
| OUT_Регуляторы | OUT_Сетевые регуляторы | Ф, Р | rs_out, pressregulators | out_regulyatory → out_rs | 70 | uzel3 брался из n2 (ошибка), исправлено |
| Регулятор давления | Регулятор давления | Ф | pressregulators | vh_regulyator_davleniya → grd | 72 | |
| Регулятор перепада | Регулятор перепада | Ф | pressdropregulators | vh_regulyator_perepada → gre | 0 (ф76: 1) | в исходнике мойибейк П/О; внутренний узел через LEFT JOIN |
| Регуляторы расхода | Регуляторы расхода | Ф | consumptregulators | vh_regulyatory_rashoda → grr | 0 | в Алматы 7 шт., у ф74 обе на удалённых участках |
| Регулирующая арматура | Регулирующая арматура; OUT_Регулирующая арматура | Ф | regularmatures | vh_reguliruyushaya_armatura → gra, out_ra | 0 | **regularmatures пуста** (Астана: 62) |
| Байпасы | Байпасы наружных теплопроводов; OUT_Байпасы /1 | Ф | bypass | vh_baipasy → gbp, out_bp | 0 | **bypass пуста** (Астана: 435); была сводная `bp` |
| OUT_Байпасы | OUT_Байпасы /2 | Ф, Р | bp_out | out_baipasy → out_bp | 0 | **bp_out пуста** |
| Коэффициенты вариации | Коэффициенты вариации | Ф | varcoefficients | vh_koef_variacii → gkv | 10 | |
| Удельные расходы | Удельные расходы | Ф | specexpends | vh_udelnye_rashody → gur | 2 | |
| Узел подпитки | Узел подпитки | Ф | refillnodes | vh_uzel_podpitki → gup | 0 | в Алматы 1 узел, не во фр. 74 |
| Узлы с заданным напором | Узлы с заданным напором | Ф | setpressnodes | vh_uzly_zadannyi_napor → gzn | 2 | |
| Узлы | Узлы | Ф | nodes | vh_uzly → gus | 1777 | |
| Теплоснабжающая система | HS_Система теплоснабжения /1 | — | heatsystem, seasons | vh_teplosnabzhayushaya_sistema → hs | 1 | пропущенная запятая сдвигала колонки, порядок выровнен по шапке |
| Расчетные схемы | HS_Система теплоснабжения /3 | Ф | externalcodes | vh_raschetnye_shemy → hs | 18 | |
| Организации | HS_Система теплоснабжения /4 | — | organizations | vh_organizacii → hs | 16579 | справочник общий, без фрагмента |
| Материальная характеристика | нет в меню, шаблона нет | Ф | heatpipesections | materialnaya_harakteristika → mat_char | 1819 | шапка задана в каталоге |
| Район эксплуатации | строка закомментирована в HS_.lst | — | exploitReg | не перенесён | — | таблицы нет (есть rayon_ekspluatatsii) |
| OUT_PT_Отключенные2 | нет в меню | Ф | realconsumers, pt_out | не перенесён | — | дубль OUT_PT_Отключенные без обобщённых потребителей |
| OUT_Насосные_станции | нет в меню (.lst нет) | Ф, Р | nst_out | не перенесён | — | nst_out пуста |
| OUT_Шайбы | нет в меню | — | DR_OUT.kod/uzel, PT_OUT.kod | не перенесён | — | старая dBase-схема, таких колонок нет |
| IT_Основные характеристики системы | `.!lst` (отключён) | — | [Расчетная схема], US_OUT.kod, #include | не перенесён | — | старая dBase-схема |

Итог: перенесено 39 SQL, не перенесено 5; ни один из пяти не выводится в действующем меню десктопа.
В каталоге 26 отчётов, собранных из `.lst`: 8 книг «вход + результаты» (OUT_*), 16 входных
таблиц, «Система теплоснабжения» и «Материальная характеристика».
На Алматы (фр. 74) данные есть в 19 из 26 книг. Полностью пустые книги: gbp, out_bp, gra, out_ra
(пустые таблицы bypass, bp_out, regularmatures), а также gre, grr, gup (во фрагменте 74 таких
объектов нет). На Астане (`astanagid_2026_03_17`, фр. 3151) байпасы, регулирующая арматура
и регуляторы расхода дают строки.

Меню десктопа вне 44 SQL (`sql3`, `sql4`): «OUT_Теплопотребление Потребители» и «OUT_Теплопотребление
Расчетные схемы» не перенесены, они относятся к теплопотерям/теплопотреблению (poteriNew).

## Сводные ведомости веба (9, были до этапа)

`/api/reports/excel/{doc_type}` (`reports_generator.py`): ut, zd, bp, ns, pt, tu, tu-balance,
heat-loss-seasons, heat-loss-sources. Первые пять дают упрощённые версии десктопных таблиц (свои шапки,
без шаблона). Теперь им соответствуют gut, gzd, gbp, gns и gpo/gpt с шапками десктопа. ТУ и
теплопотери относятся к журналам, в меню «Excel» десктопа их нет. Все девять остались в каталоге
в группе «Сводные ведомости».

## Проблемы данных, найденные при прогоне

- В 11 узлах Алматы в `externalnodename` есть управляющий символ (например, `3АР-8-7с/ут1`, фрагменты
  76, 80, 84, 86, 91 и др.). Excel такие символы не принимает, при выгрузке они вырезаются.
- Пустые `bypass`, `regularmatures`, `bp_out`, `dr_out`, `nst_out`. Результаты расчёта дросселей
  и байпасов sety в базу не пишет.
- `ns_out.a19` хранит id типоразмера насоса строкой (`'0'`), а не integer.
