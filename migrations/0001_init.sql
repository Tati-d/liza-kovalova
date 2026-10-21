-- Заказ = одна оплаченная Stripe Checkout Session.
CREATE TABLE orders (
  id TEXT PRIMARY KEY,              -- Stripe checkout session id (cs_...)
  program TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  email TEXT,
  payment_intent TEXT,
  status TEXT NOT NULL,             -- paid | revoked
  invite_link TEXT UNIQUE,          -- персональная одноразовая ссылка в канал (member_limit = 1)
  invite_expires INTEGER,
  tg_user_id INTEGER,               -- кто вступил по этой ссылке (из обновления chat_member)
  joined_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX orders_pi ON orders (payment_intent);
CREATE INDEX orders_email ON orders (email);

-- Защита от повторной обработки одного и того же события Stripe.
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
