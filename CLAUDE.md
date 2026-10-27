# Liza Kovalova — лендинг онлайн-тренировок

Отдельный клиент и отдельный проект (не связан с DeutschProgress): свой репозиторий, Worker, D1, бот и Stripe.

## Стек
Cloudflare Worker (`src/`, plain JS, без сборки) + D1 (`migrations/`) + статический фронт (`public/`, vanilla ES-модули).
Прод: https://lizakovalova.com (аккаунт Cloudflare клиента Elastica2024, `account_id` в `wrangler.jsonc`)

## Файлы
- `public/programs.js` — программы и цены (единый источник для сайта и сервера), `public/i18n.js` — тексты RU/UA.
- `public/app.js` — роутер (`/`, `/p/:id`, `/success`), view transitions, появление при скролле. CSP запрещает inline-стили: CSS-переменные ставятся через `el.style`.
- `src/stripe.js` — Checkout, проверка оплаты, вебхук (подпись, идемпотентность, возвраты/споры).
- `src/telegram.js` — персональные ссылки `member_limit: 1`, вебхук `chat_member`, удаление при возврате. Бот только техадмин каналов, с покупателем не общается.
  Срок доступа: `accessDays` в `programs.js` → `orders.access_until`; cron раз в час (`expireAccess`) убирает истёкших.
- `src/worker.js` — маршруты, мета-теги для `/p/:id`, админ-эндпоинты `/api/admin/setup`, `/api/admin/resend`.
- `test/e2e.mjs` — `npm test`: wrangler dev + моки Stripe/Telegram, весь путь оплаты и доступа.

## Правила
- Мобильная версия — основная. Основной язык — русский (по умолчанию), второй — украинский. Акцентный цвет — красный (`--red`). Без сборки.
- Любое изменение логики оплаты/доступа — прогнать `npm test`.
