// Работа с закрытыми каналами через Telegram Bot API. Бот только технический админ канала:
// покупатель с ним не общается, он лишь создаёт персональные ссылки и убирает участников при возврате.
import { now, safeEqual, json } from "./util.js";

const LINK_TTL = 7 * 24 * 3600; // неиспользованная ссылка живёт 7 дней, потом выдаётся новая

const channels = (env) => JSON.parse(env.CHANNELS || "{}");

export async function tg(env, method, params = {}) {
  const res = await fetch(`${env.TG_API || "https://api.telegram.org"}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

// Оплачен, не возвращён и срок доступа не истёк
export const isActive = (order) => order.status === "paid" && !(order.access_until && order.access_until <= now());

// Персональная ссылка: по ней может вступить ровно один человек.
// В канале одновременно может быть только один участник на одну покупку.
export async function inviteFor(env, order) {
  if (!isActive(order)) return { status: order.status === "paid" ? "expired" : order.status };
  const chatId = channels(env)[order.program];
  if (!chatId) throw new Error(`no channel for program ${order.program}`);
  if (order.tg_user_id) {
    const member = await tg(env, "getChatMember", { chat_id: chatId, user_id: order.tg_user_id }).catch(() => null);
    // Покупатель уже в канале — новая ссылка не нужна. Если вышел — выдадим новую, чтобы мог вернуться.
    if (!member || !["left", "kicked"].includes(member.status)) return { status: "joined" };
  } else if (order.invite_link && order.invite_expires > now() + 60) {
    return { status: "ready", link: order.invite_link };
  }

  // Ссылка не должна пережить срок доступа
  const expires = Math.min(now() + LINK_TTL, order.access_until || Infinity);
  const link = await tg(env, "createChatInviteLink", {
    chat_id: chatId,
    name: `order ${order.id.slice(-12)}`,
    member_limit: 1,
    expire_date: expires
  });
  // Сохраняем, только если ссылку никто не поменял параллельно; иначе гасим свою и берём сохранённую
  const res = await env.DB.prepare("UPDATE orders SET invite_link = ?, invite_expires = ? WHERE id = ? AND invite_link IS ?")
    .bind(link.invite_link, expires, order.id, order.invite_link ?? null).run();
  if (!res.meta.changes) {
    await tg(env, "revokeChatInviteLink", { chat_id: chatId, invite_link: link.invite_link }).catch(() => {});
    const fresh = await env.DB.prepare("SELECT invite_link FROM orders WHERE id = ?").bind(order.id).first();
    return { status: "ready", link: fresh.invite_link };
  }
  if (order.invite_link) {
    await tg(env, "revokeChatInviteLink", { chat_id: chatId, invite_link: order.invite_link }).catch(() => {});
  }
  return { status: "ready", link: link.invite_link };
}

// POST /tg/webhook — Telegram сообщает, кто вступил в канал и по какой ссылке.
export async function telegramWebhook(request, env) {
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token") || "", env.TG_WEBHOOK_SECRET || "-")) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await request.json();
  const cm = update.chat_member;
  const joined = cm && ["member", "restricted"].includes(cm.new_chat_member?.status) && cm.invite_link?.invite_link;
  if (joined) {
    const order = await env.DB.prepare("SELECT * FROM orders WHERE invite_link = ?").bind(cm.invite_link.invite_link).first();
    if (order && isActive(order)) {
      const u = cm.new_chat_member.user;
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").slice(0, 128) || null;
      await env.DB.prepare("UPDATE orders SET tg_user_id = ?, tg_username = ?, tg_name = ?, joined_at = ? WHERE id = ?")
        .bind(u.id, u.username ? String(u.username).slice(0, 64) : null, name, now(), order.id).run();
    } else if (order) {
      // Вступил по ссылке отозванного или истёкшего заказа — убираем
      await kick(env, cm.chat.id, cm.new_chat_member.user.id);
    }
  }
  return json({ ok: true });
}

async function kick(env, chatId, userId) {
  await tg(env, "banChatMember", { chat_id: chatId, user_id: userId });
  // Сразу разбаниваем, чтобы человек мог купить снова
  await tg(env, "unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
}

// Возврат, спор или конец срока: гасим ссылку и убираем участника,
// если у него нет другого действующего доступа к этому каналу.
export async function revokeAccess(env, order) {
  const chatId = channels(env)[order.program];
  if (!chatId) return;
  if (order.invite_link) {
    await tg(env, "revokeChatInviteLink", { chat_id: chatId, invite_link: order.invite_link }).catch(() => {});
  }
  if (!order.tg_user_id) return;
  const programs = Object.entries(channels(env)).filter(([, c]) => String(c) === String(chatId)).map(([p]) => p);
  const other = await env.DB.prepare(
    `SELECT 1 FROM orders WHERE tg_user_id = ? AND status = 'paid' AND (access_until IS NULL OR access_until > ?)
     AND id != ? AND program IN (${programs.map(() => "?").join(",")}) LIMIT 1`
  ).bind(order.tg_user_id, now(), order.id, ...programs).first();
  if (!other) await kick(env, chatId, order.tg_user_id);
}

// Cron: закрываем доступ, у которого истёк срок
export async function expireAccess(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders WHERE status = 'paid' AND access_until IS NOT NULL AND access_until <= ? LIMIT 200"
  ).bind(now()).all();
  for (const order of results) {
    await env.DB.prepare("UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'paid'").bind(order.id).run();
    try {
      await revokeAccess(env, order);
    } catch (e) {
      console.error(`expire ${order.id}: ${e.message}`);
    }
  }
  return results.length;
}

// POST /api/admin/setup: подписка на обновления участников каналов
// force: перезаписать вебхук, даже если бот уже отправляет обновления в другую систему
export async function setupTelegram(env, force = false) {
  const me = await tg(env, "getMe");
  const ours = `${env.APP_URL}/tg/webhook`;
  // У бота может быть только один вебхук. Если он уже занят другой системой (например, бронированием),
  // не трогаем его — иначе та система перестанет получать сообщения.
  const info = await tg(env, "getWebhookInfo");
  if (info?.url && info.url !== ours && !force) {
    return { bot: me.username, error: "webhook_in_use", current_webhook: info.url };
  }
  await tg(env, "setWebhook", {
    url: `${env.APP_URL}/tg/webhook`,
    secret_token: env.TG_WEBHOOK_SECRET,
    allowed_updates: ["chat_member"],
    drop_pending_updates: true
  });
  const report = { bot: me.username, channels: {} };
  for (const [program, chatId] of Object.entries(channels(env))) {
    try {
      const member = await tg(env, "getChatMember", { chat_id: chatId, user_id: me.id });
      const ok = member.status === "administrator" && member.can_invite_users && member.can_restrict_members;
      report.channels[program] = ok ? "ok" : "bot must be admin with 'invite users' and 'ban users' rights";
    } catch (e) {
      report.channels[program] = e.message;
    }
  }
  return report;
}
