# Staging: включение записи (ТУ → defect) после cutover API

Не выполнять на production БД. Только копия.

## 1. API `.env` (стенд)

```
AUTH_DISABLED=false
DEV_LOGIN_ENABLED=false
STRICT_AUTH=true
AUTH_REQUIRED_GET=false
JWT_SECRET=<длинный случайный>
MUTATIONS_ENABLED=true
TOPOLOGY_MUTATIONS_ENABLED=false
REDIS_ADDR=127.0.0.1:6379
```

UsersDB: пользователь с `role=editor` и паролем `{bcrypt}…` или `{noop}…`.

## 2. Web `.env`

```
NUXT_PUBLIC_MAP_API_BASE_URL=http://localhost:8011
NUXT_PUBLIC_MUTATIONS_ENABLED=true
NUXT_PUBLIC_TOPOLOGY_EDITING_ENABLED=false
```

## 3. Smoke перед E2E

```bash
API_BASE=http://localhost:8011 python web-itwin/scripts/acceptance/p1_smoke.py
API_BASE=http://localhost:8011 python web-itwin/scripts/acceptance/p2_mutations_smoke.py
```

## 4. Ручной E2E ТУ

1. Войти (editor).
2. Инструменты → Технические условия → Создать (минимальные поля: номер, дата, источник).
3. Изменить состояние → Сохранить.
4. Свод → Excel `tu-balance` (не список `tu`).
5. Удалить тестовую запись.
6. Проверить audit (app log / `audit_log`).

## 5. Ручной E2E defect (после дампа)

1. Создать нарушение с `lineid`/`nodeid` если есть.
2. Word-карта.
3. Удалить тестовую запись.

## DoD

- [ ] viewer получает 403 на create
- [ ] editor пишет ТУ; audit есть
- [ ] topology create всё ещё 503 при `TOPOLOGY_MUTATIONS_ENABLED=false`
