import { findProgram } from "../public/programs.js";
import { I18N } from "../public/i18n.js";
import { createCheckout, getAccess, stripeWebhook } from "./stripe.js";
import { telegramWebhook, setupTelegram, inviteFor, expireAccess } from "./telegram.js";
import { json, safeEqual } from "./util.js";

// Ссылка вида /p/back для сторис и шапки профиля: подставляем заголовок и описание программы
// в мета-теги, чтобы превью в Telegram/Instagram показывало нужную программу.
async function programPage(request, env, id) {
  const program = findProgram(id);
  const res = await env.ASSETS.fetch(new URL("/index.html", request.url));
  if (!program) return res;
  const P = I18N.ru.programs[program.id];
  const pageTitle = `${P.title} — Liza Kovalova`;
  const set = (value) => ({ element: (el) => el.setAttribute("content", value) });
  return new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(pageTitle) })
    .on('meta[property="og:title"]', set(pageTitle))
    .on('meta[name="description"]', set(P.short))
    .on('meta[property="og:description"]', set(P.short))
    .on('meta[property="og:url"]', set(`${env.APP_URL}/p/${program.id}`))
    .transform(res);
}

// Поддержка: покупатель потерял страницу после оплаты → по email из чека Stripe выдаём ссылку заново
async function resend(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) return json({ error: "email_required" }, 400);
  const { results } = await env.DB.prepare("SELECT * FROM orders WHERE lower(email) = lower(?) AND status IN ('paid', 'expired')").bind(email.trim()).all();
  const out = [];
  for (const o of results) out.push({ order: o.id, program: o.program, ...(await inviteFor(env, o)) });
  return json({ orders: out });
}

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/checkout" && method === "POST") {
    // Сессии оплаты создаются только с нашего сайта
    if (request.headers.get("origin") !== new URL(env.APP_URL).origin) return json({ error: "forbidden" }, 403);
    return createCheckout(request, env);
  }
  if (pathname === "/api/access" && method === "GET") return getAccess(request, env);
  if (pathname === "/api/stripe/webhook" && method === "POST") return stripeWebhook(request, env);
  if (pathname === "/tg/webhook" && method === "POST") return telegramWebhook(request, env);
  if (pathname.startsWith("/api/admin/")) {
    if (!env.ADMIN_KEY || !safeEqual(request.headers.get("x-admin-key") || "", env.ADMIN_KEY)) {
      return json({ error: "forbidden" }, 403);
    }
    if (pathname === "/api/admin/setup" && method === "POST") return json(await setupTelegram(env));
    if (pathname === "/api/admin/resend" && method === "POST") return resend(request, env);
  }
  const m = pathname.match(/^\/p\/([a-z]+)\/?$/);
  if (m && method === "GET") return programPage(request, env, m[1]);
  if (pathname.startsWith("/api/") || pathname.startsWith("/tg/")) return json({ error: "not_found" }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      console.error(e.stack || e);
      return json({ error: "server_error" }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(expireAccess(env));
  }
};
