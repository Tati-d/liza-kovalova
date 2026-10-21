# Liza Kovalova — онлайн-тренировки

Лендинг с продажей программ (RU / UA) и выдачей доступа в закрытые Telegram-каналы.
Прод: https://liza-kovalova.dyachektana.workers.dev

## Как устроено
1. Покупатель открывает программу (`/p/back`, `/p/hips`, `/p/splits`, `/p/legs`, `/p/pilates`) и жмёт «Купить доступ».
2. Сервер создаёт Stripe Checkout с ценой из `public/programs.js` (клиент цену не передаёт). Карты, Apple Pay, Google Pay, Link.
3. После оплаты Stripe возвращает на `/success`. Сервер сам проверяет оплату в Stripe и создаёт **персональную одноразовую ссылку** в канал (`member_limit: 1`, живёт 7 дней).
4. Telegram сообщает, кто вступил по ссылке. Возврат платежа или спор → ссылка гасится, участник удаляется из канала.

Покупатель с ботом не общается. Технический бот нужен только как админ канала: Telegram выдаёт персональные ссылки и удаляет участников только через Bot API.

## Безопасность
- Цена задаётся только на сервере, оплата проверяется через Stripe API и подписанный вебхук (HMAC, защита от повтора, идемпотентность).
- Ссылка в канал персональная: по ней вступит ровно один человек; пересылать бессмысленно.
- Пока покупатель в канале, новая ссылка не выдаётся; вышел — получит новую, старая гасится.
- Вебхук Telegram проверяется по секретному заголовку, админ-эндпоинты — по `ADMIN_KEY`.
- Строгий CSP и заголовки безопасности (`public/_headers`), `session_id` убирается из адресной строки.

## Подключение (один раз)
**Stripe**
1. Dashboard → Developers → API keys → секретный ключ: `npx wrangler secret put STRIPE_SECRET_KEY`.
2. Developers → Webhooks → endpoint `https://liza-kovalova.dyachektana.workers.dev/api/stripe/webhook`, события:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`.
   Signing secret: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
3. Settings → Payment methods: включить Apple Pay, Google Pay, Link (и при желании Revolut Pay, Klarna и др.).

**Telegram**
1. @BotFather → создать бота → токен: `npx wrangler secret put BOT_TOKEN`.
2. Создать закрытый канал на каждую программу (или один на несколько), добавить бота админом с правами «Приглашать по ссылке» и «Блокировать участников».
3. id каналов (`-100…`) вписать в `CHANNELS` в `wrangler.jsonc`, например `{"back":"-100123…","hips":"-100456…"}`.
4. `npx wrangler secret put TG_WEBHOOK_SECRET` (любая длинная случайная строка) и `npx wrangler secret put ADMIN_KEY`.
5. `npm run deploy`, затем:
   `curl -X POST -H "x-admin-key: …" https://liza-kovalova.dyachektana.workers.dev/api/admin/setup` — подпишет вебхук и проверит права бота в каждом канале.

Пока `STRIPE_SECRET_KEY` не задан, кнопка оплаты работает в демо-режиме: деньги не списываются, доступ не выдаётся.

## Ссылки для соцсетей
`https://liza-kovalova.dyachektana.workers.dev/p/back?utm_source=instagram&utm_campaign=stories` — сразу на программу; utm-метки попадают в metadata платежа в Stripe.

## Поддержка
Покупатель потерял страницу после оплаты → по email из чека:
`curl -X POST -H "x-admin-key: …" -d '{"email":"…"}' https://liza-kovalova.dyachektana.workers.dev/api/admin/resend`

## Перед запуском (ЕС)
- Страницы Impressum, Datenschutz, AGB и ссылки на них в подвале.
- Для цифрового контента — согласие покупателя на немедленное исполнение и отказ от права отзыва (можно включить в Stripe Checkout через `consent_collection` / `custom_text`).
- Цены и тексты программ согласовать с Лизой (сейчас 29 € везде).

## Разработка
`npm i`, `npm run db:local`, `npm run dev`. Тест всего пути с моками Stripe и Telegram: `npm test`.
