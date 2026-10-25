import { CURRENCY, findProgram } from "../public/programs.js";
import { I18N } from "../public/i18n.js";
import { now, hmac, toHex, safeEqual, json } from "./util.js";
import { inviteFor, revokeAccess } from "./telegram.js";

const SIGNATURE_TOLERANCE = 300; // секунд

// Stripe API принимает form-urlencoded с вложенными ключами: a[b][0][c]=...
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, body) {
  const res = await fetch(`${env.STRIPE_API || "https://api.stripe.com"}/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body ? form(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${data.error?.message || res.status}`);
  return data;
}

// POST /api/checkout { program, lang, utm } → { url } на страницу оплаты Stripe
export async function createCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ demo: true });

  const body = await request.json().catch(() => ({}));
  const program = findProgram(body.program);
  if (!program) return json({ error: "unknown_program" }, 400);
  const lang = body.lang === "uk" ? "uk" : "ru";
  const T = I18N[lang];
  const P = T.programs[program.id];
  const utm = typeof body.utm === "object" && body.utm ? body.utm : {};
  const clip = (v) => (typeof v === "string" ? v.slice(0, 100) : undefined);
  const metadata = {
    program: program.id,
    lang,
    utm_source: clip(utm.utm_source),
    utm_medium: clip(utm.utm_medium),
    utm_campaign: clip(utm.utm_campaign)
  };

  // Цена и продукт задаются только здесь, на сервере — клиент передаёт лишь id программы.
  const session = await stripe(env, "POST", "checkout/sessions", {
    mode: "payment",
    locale: "auto",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: program.price,
        product_data: { name: [P.title, P.tag].filter(Boolean).join(" — "), description: T.stripeDescription }
      }
    }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/p/${program.id}`,
    metadata,
    payment_intent_data: { metadata }
  });
  return json({ url: session.url });
}

// Сохраняет оплаченную сессию в заказы. Идемпотентно: повторный вызов ничего не меняет.
export async function recordPaidSession(env, session) {
  if (session.payment_status !== "paid") return null;
  const program = findProgram(session.metadata?.program);
  if (!program) throw new Error(`session ${session.id} without known program`);
  await env.DB.prepare(
    `INSERT INTO orders (id, program, lang, amount, currency, email, payment_intent, status, access_until, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?) ON CONFLICT(id) DO NOTHING`
  ).bind(
    session.id, program.id, session.metadata?.lang === "uk" ? "uk" : "ru",
    session.amount_total, session.currency, session.customer_details?.email || null,
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    program.accessDays ? (session.created || now()) + program.accessDays * 86400 : null,
    now()
  ).run();
  return env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(session.id).first();
}

// GET /api/access?session_id=cs_... → персональная ссылка в канал для оплатившего.
// session_id знает только покупатель: Stripe подставляет его в адрес страницы успеха.
// Проверяем оплату напрямую в Stripe, поэтому не зависим от того, дошёл ли уже webhook.
export async function getAccess(request, env) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ error: "bad_session" }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "not_configured" }, 503);

  let order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!order) {
    let session;
    try {
      session = await stripe(env, "GET", `checkout/sessions/${id}`);
    } catch {
      return json({ error: "not_found" }, 404);
    }
    if (session.payment_status !== "paid") return json({ status: "pending" }, 202);
    order = await recordPaidSession(env, session);
  }
  if (order.status === "revoked") return json({ status: "revoked" }, 403);

  return json({ program: order.program, ...(await inviteFor(env, order)) });
}

// Проверка подписи Stripe-Signature: t=...,v1=...
export async function verifyStripeSignature(env, payload, header) {
  if (!header || !env.STRIPE_WEBHOOK_SECRET) return false;
  const parts = Object.groupBy(header.split(",").map((p) => p.split("=")), ([k]) => k);
  const t = Number(parts.t?.[0]?.[1]);
  const signatures = (parts.v1 || []).map(([, v]) => v);
  if (!t || !signatures.length || Math.abs(now() - t) > SIGNATURE_TOLERANCE) return false;
  const expected = toHex(await hmac(env.STRIPE_WEBHOOK_SECRET, `${t}.${payload}`));
  return signatures.some((s) => safeEqual(s, expected));
}

// POST /api/stripe/webhook
export async function stripeWebhook(request, env) {
  const payload = await request.text();
  if (!(await verifyStripeSignature(env, payload, request.headers.get("stripe-signature")))) {
    return json({ error: "bad_signature" }, 400);
  }
  const event = JSON.parse(payload);
  const fresh = await env.DB.prepare("INSERT INTO stripe_events (id, at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(event.id, now()).run();
  if (!fresh.meta.changes) return json({ ok: true, duplicate: true });

  try {
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await recordPaidSession(env, obj);
        break;
      case "charge.refunded":
        // Частичный возврат доступ не отзывает, полный — отзывает.
        if (obj.refunded) await revokeByPaymentIntent(env, obj.payment_intent);
        break;
      case "charge.dispute.created":
        await revokeByPaymentIntent(env, obj.payment_intent);
        break;
    }
  } catch (e) {
    // Даём Stripe повторить доставку позже
    await env.DB.prepare("DELETE FROM stripe_events WHERE id = ?").bind(event.id).run();
    throw e;
  }
  return json({ ok: true });
}

async function revokeByPaymentIntent(env, paymentIntent) {
  if (!paymentIntent) return;
  const order = await env.DB.prepare("SELECT * FROM orders WHERE payment_intent = ?").bind(paymentIntent).first();
  if (!order || order.status === "revoked") return;
  await env.DB.prepare("UPDATE orders SET status = 'revoked' WHERE id = ?").bind(order.id).run();
  await revokeAccess(env, order);
}
