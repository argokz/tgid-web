# P2 — вертикальный CRUD журналов (после P0)

Шаблон переноса изменяющей части одного журнала end-to-end.

## Предусловия (P0)

- `MUTATIONS_ENABLED=true` только на стенде
- `NUXT_PUBLIC_MUTATIONS_ENABLED=true`
- `AUTH_DISABLED=false`, JWT роли `editor`+
- Таблица в allow-list `auth.MUTABLE_TABLES`
- Аудит пишется в `audit_log` или app log

## Порядок вертикали (на примере ТУ)

1. **Read-only уже есть:** `GET /api/technical-conditions*` + `TechnicalConditionJournalDialog`.
2. **Allow-list:** `tehnicheskie_usloviya` уже в `MUTABLE_TABLES`.
3. **API:** generic `POST /api/v1/create/{table}`, `PUT /api/v1/update/...`, `DELETE /api/v1/delete/...` с JWT + audit.
4. **UI:** кнопки Create/Edit/Save/Delete видны только при `mutationsEnabled`.
5. **Клиент:** `fastApiService.createObject/updateObjectAttributes/deleteObject` → `/api/v1/...` + Bearer `itwin_access_token`.
6. **Приёмка:** создать/изменить/удалить ТУ на копии БД; сверить карточку desktop; проверить audit запись.

## Приоритет модулей с данными

1. Технические условия (~4.8k строк)
2. АЛСЕКО loads (read-only сверка есть; CRUD отдельно из-за адресного matching)
3. Эксплуатация (defect/shurf/…) — после загрузки контрольного дампа (сейчас 0 строк)

## DoD модуля CRUD

- [ ] RBAC: viewer не пишет; editor пишет
- [ ] Optimistic locking / version (следующий шаг — колонка version или updated_at check)
- [ ] Contract + E2E тест
- [ ] Журнал действий
- [ ] Word/Excel акты — отдельный подпункт, не блокирует минимальный CRUD
