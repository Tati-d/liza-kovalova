# Liza Kovalova — онлайн-тренировки (прототип)

Простой лендинг в стиле lava.top: профиль, разделы программ, страница программы с кнопкой оплаты, страница успеха с доступом в Telegram. Два языка: русский и украинский.

Статический сайт без сборки и без бэкенда: GitHub Pages + Stripe Payment Links.

## Файлы
- `config.js` — цены, ссылки Stripe и Telegram (единственное, что нужно менять)
- `i18n.js` — все тексты RU / UA
- `index.html` — главная и страницы программ (`#/back`, `#/hips`, `#/splits`, `#/legs`, `#/pilates`)
- `success.html` — после оплаты, кнопка «Открыть Telegram-канал»

## Подключить Stripe
1. Stripe Dashboard → Payment Links → создать ссылку на каждую программу.
2. В настройках ссылки: **After payment → Don't show confirmation page → Redirect** на
   `https://tati-d.github.io/liza-kovalova/success.html?p=back` (для каждой программы свой `p=`).
3. Вставить `https://buy.stripe.com/...` в `stripeLink` в `config.js`.

Пока `stripeLink` пустой, кнопка оплаты ведёт сразу на страницу успеха в демо-режиме.

## Telegram
Создать закрытый канал на каждую программу (или один общий), вставить инвайт-ссылку в `telegram`.

## Ограничение прототипа и что дальше
Ссылка в канал видна на странице успеха, её можно переслать. Для продакшена:
- Stripe webhook `checkout.session.completed` → Cloudflare Worker;
- Worker через Telegram Bot API создаёт одноразовую ссылку (`createChatInviteLink`, `member_limit: 1`) и показывает её / отправляет на email;
- либо бот одобряет заявки на вступление (`creates_join_request`) только у оплативших.
