// Сквозной тест: поднимает мок Stripe + Telegram, локальный Worker (wrangler dev) с отдельной D1
// и проверяет весь путь: оплата → персональная ссылка в канал → вступление → возврат.
// Запуск: npm test
import http from "node:http";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOCK_PORT = 8799, PORT = 8798, BASE = `http://localhost:${PORT}`;
const SECRETS = {
  STRIPE_SECRET_KEY: "sk_test_mock", STRIPE_WEBHOOK_SECRET: "whsec_mock", BOT_TOKEN: "123:mock",
  TG_WEBHOOK_SECRET: "tgsecret", ADMIN_KEY: "adminkey"
};
const CHANNEL = "-1001234567890";
const SESSION = "cs_test_a1b2c3d4e5f6g7h8";

// ---------- Мок Stripe и Telegram ----------
const calls = [];
const sessions = {};
let linkN = 0, memberStatus = "member";
const mock = http.createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const send = (d) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(d)); };
  if (req.url === "/v1/checkout/sessions" && req.method === "POST") {
    const f = new URLSearchParams(body);
    calls.push({ stripe: "create", form: f });
    sessions[SESSION] = {
      id: SESSION, payment_status: "paid", amount_total: Number(f.get("line_items[0][price_data][unit_amount]")),
      currency: "eur", payment_intent: "pi_test_1", customer_details: { email: "buyer@example.com" },
      metadata: { program: f.get("metadata[program]"), lang: f.get("metadata[lang]") }
    };
    return send({ id: SESSION, url: "https://checkout.stripe.test/pay" });
  }
  const m = req.url.match(/^\/v1\/checkout\/sessions\/(.+)$/);
  if (m) {
    if (!sessions[m[1]]) { res.statusCode = 404; return send({ error: { message: "No such session" } }); }
    return send(sessions[m[1]]);
  }
  const t = req.url.match(/^\/bot([^/]+)\/(\w+)$/);
  if (t) {
    const params = body ? JSON.parse(body) : {};
    calls.push({ tg: t[2], params });
    if (t[2] === "getMe") return send({ ok: true, result: { id: 999, username: "liza_access_bot" } });
    if (t[2] === "createChatInviteLink") return send({ ok: true, result: { invite_link: `https://t.me/+LINK${++linkN}` } });
    if (t[2] === "getChatMember") {
      const status = params.user_id === 999 ? "administrator" : memberStatus;
      return send({ ok: true, result: { status, can_invite_users: true } });
    }
    return send({ ok: true, result: true });
  }
  res.statusCode = 404; send({});
});

// ---------- Помощники ----------
let failed = 0;
function check(name, cond, extra) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && extra !== undefined ? " — " + JSON.stringify(extra) : ""}`);
  if (!cond) failed++;
}
const api = async (path, opts = {}) => {
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};
const post = (path, body, headers = {}) =>
  api(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
function stripeSig(payload, t = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", SECRETS.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}
const webhook = (event, sig) => {
  const payload = JSON.stringify(event);
  return api("/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig ?? stripeSig(payload) }, body: payload });
};
const tgHook = (update, secret = SECRETS.TG_WEBHOOK_SECRET) =>
  post("/tg/webhook", update, { "x-telegram-bot-api-secret-token": secret });
const joinVia = (userId, link) => tgHook({ chat_member: {
  chat: { id: Number(CHANNEL) }, invite_link: { invite_link: link },
  new_chat_member: { status: "member", user: { id: userId } }
} });
const lastTg = (method) => [...calls].reverse().find((c) => c.tg === method);
const clear = () => (calls.length = 0);

// ---------- Запуск ----------
const persist = mkdtempSync(join(tmpdir(), "lk-e2e-"));
await new Promise((r) => mock.listen(MOCK_PORT, r));
execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persist], { stdio: "ignore" });
const vars = {
  ...SECRETS, APP_URL: BASE, CHANNELS: JSON.stringify({ back: CHANNEL, hips: CHANNEL }),
  STRIPE_API: `http://localhost:${MOCK_PORT}`, TG_API: `http://localhost:${MOCK_PORT}`
};
const dev = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--persist-to", persist,
  ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])], { stdio: ["ignore", "pipe", "pipe"] });
let devLog = "";
dev.stdout.on("data", (d) => (devLog += d));
dev.stderr.on("data", (d) => (devLog += d));
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + "/")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

try {
  // Оплата
  let r = await post("/api/checkout", { program: "back" });
  check("checkout без Origin нашего сайта → 403", r.status === 403, r);
  r = await post("/api/checkout", { program: "back", price: 1, lang: "uk", utm: { utm_source: "instagram" } }, { origin: BASE });
  check("checkout возвращает ссылку Stripe", r.data.url === "https://checkout.stripe.test/pay", r);
  const f = calls.find((c) => c.stripe === "create")?.form;
  check("цену задаёт сервер (2900), а не клиент", f?.get("line_items[0][price_data][unit_amount]") === "2900");
  check("utm и язык уходят в metadata", f?.get("metadata[utm_source]") === "instagram" && f?.get("metadata[lang]") === "uk");
  r = await post("/api/checkout", { program: "../../etc" }, { origin: BASE });
  check("неизвестная программа → 400", r.status === 400, r);

  // Настройка Telegram
  r = await post("/api/admin/setup", {}, { "x-admin-key": "wrong" });
  check("setup с неверным ключом → 403", r.status === 403, r);
  r = await post("/api/admin/setup", {}, { "x-admin-key": SECRETS.ADMIN_KEY });
  check("setup проверяет права в канале", r.data.channels?.back === "ok", r);
  const hook = lastTg("setWebhook")?.params;
  check("вебхук Telegram с секретом и только chat_member", hook?.secret_token === SECRETS.TG_WEBHOOK_SECRET && hook.allowed_updates.join() === "chat_member", hook);

  // Доступ после оплаты
  r = await api("/api/access?session_id=hack");
  check("кривой session_id → 400", r.status === 400, r);
  r = await api("/api/access?session_id=cs_test_unknownsession1");
  check("чужой/несуществующий session_id → 404", r.status === 404, r);
  clear();
  r = await api(`/api/access?session_id=${SESSION}`);
  check("оплаченная сессия → персональная ссылка", r.data.status === "ready" && r.data.link === "https://t.me/+LINK1", r);
  const inv = lastTg("createChatInviteLink")?.params;
  check("ссылка одноразовая (member_limit 1) и с сроком", inv?.member_limit === 1 && inv.expire_date > Date.now() / 1000, inv);
  const link = r.data.link;
  r = await api(`/api/access?session_id=${SESSION}`);
  check("повторное открытие даёт ту же ссылку", r.data.link === link, r);

  // Вебхук Stripe
  const ev = { id: "evt_1", type: "checkout.session.completed", data: { object: sessions[SESSION] } };
  r = await webhook(ev, "t=1,v1=deadbeef");
  check("вебхук с неверной подписью → 400", r.status === 400, r);
  const old = Math.floor(Date.now() / 1000) - 3600;
  r = await webhook(ev, stripeSig(JSON.stringify(ev), old));
  check("вебхук со старой подписью (replay) → 400", r.status === 400, r);
  r = await webhook(ev);
  check("вебхук с верной подписью → ok", r.status === 200 && r.data.ok, r);
  r = await webhook(ev);
  check("повтор того же события игнорируется", r.data.duplicate === true, r);

  // Вступление в канал
  r = await tgHook({ chat_member: {} }, "wrong");
  check("вебхук Telegram без секрета → 403", r.status === 403, r);
  await joinVia(111, link);
  clear();
  r = await api(`/api/access?session_id=${SESSION}`);
  check("после вступления новая ссылка не выдаётся", r.data.status === "joined" && !r.data.link && !lastTg("createChatInviteLink"), r);
  memberStatus = "left";
  r = await api(`/api/access?session_id=${SESSION}`);
  check("вышел из канала → новая ссылка, старая гасится", r.data.link === "https://t.me/+LINK2" && lastTg("revokeChatInviteLink")?.params.invite_link === link, r);
  memberStatus = "member";
  await joinVia(111, r.data.link);

  // Поддержка: повторная выдача по email
  r = await post("/api/admin/resend", { email: "BUYER@example.com" }, { "x-admin-key": SECRETS.ADMIN_KEY });
  check("поддержка находит заказ по email", r.data.orders?.length === 1 && r.data.orders[0].status === "joined", r);
  r = await post("/api/admin/resend", { email: "buyer@example.com" });
  check("resend без ключа → 403", r.status === 403, r);

  // Возврат платежа
  clear();
  r = await webhook({ id: "evt_2", type: "charge.refunded", data: { object: { refunded: true, payment_intent: "pi_test_1" } } });
  check("возврат: ссылка погашена, участник удалён", lastTg("revokeChatInviteLink") && lastTg("banChatMember")?.params.user_id === 111 && lastTg("unbanChatMember"), calls);
  r = await api(`/api/access?session_id=${SESSION}`);
  check("после возврата доступ закрыт", r.status === 403, r);
  clear();
  await joinVia(222, "https://t.me/+LINK2");
  check("вступление по ссылке отозванного заказа → удаление", lastTg("banChatMember")?.params.user_id === 222);

  // Страницы
  r = await api("/p/back");
  check("/p/back отдаёт превью с названием программы", typeof r.data === "string" && r.data.includes("<title>Спина и осанка — Liza Kovalova</title>"));
  r = await api("/success");
  check("/success отдаёт приложение", typeof r.data === "string" && r.data.includes('id="app"'));
  const h = await fetch(BASE + "/");
  check("заголовок CSP на страницах", (h.headers.get("content-security-policy") || "").includes("frame-ancestors 'none'"));
} catch (e) {
  failed++;
  console.error(e);
  console.error(devLog.slice(-3000));
} finally {
  dev.kill();
  mock.close();
  rmSync(persist, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} проверок не прошло` : "\nВсе проверки прошли");
process.exit(failed ? 1 : 0);
