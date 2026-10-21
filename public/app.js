import { PROGRAMS, CURRENCY, findProgram } from "./programs.js";
import { I18N } from "./i18n.js";

const app = document.getElementById("app");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

function detectLang() {
  const saved = store.get("lang");
  if (saved === "ru" || saved === "uk") return saved;
  return (navigator.languages || [navigator.language]).some((l) => /^uk/i.test(l)) ? "uk" : "ru";
}
let lang = detectLang();
const T = () => I18N[lang];

// Метки из ссылок в соцсетях (utm_*) — сохраняем до оплаты, чтобы видеть в Stripe, откуда покупки
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];
(() => {
  const q = new URLSearchParams(location.search);
  if (UTM_KEYS.some((k) => q.has(k))) {
    try { sessionStorage.setItem("utm", JSON.stringify(Object.fromEntries(UTM_KEYS.map((k) => [k, q.get(k)])))); } catch {}
  }
})();
const utm = () => { try { return JSON.parse(sessionStorage.getItem("utm") || "{}"); } catch { return {}; } };

const inAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview/i.test(navigator.userAgent);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Всегда «29 €»: uk-UA в Intl пишет «29 EUR»
const SYMBOL = { eur: "€", usd: "$", gbp: "£" };
const money = (cents) =>
  `${new Intl.NumberFormat(T().locale, { minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)}\u00a0${SYMBOL[CURRENCY] || CURRENCY.toUpperCase()}`;
const ARROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const BACK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`;
const TG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 3.6 2.9 10.8c-1.1.4-1.1 1.9 0 2.2l4.6 1.4 1.8 5.5c.3.9 1.4 1.1 2 .5l2.6-2.5 4.8 3.5c.8.6 2 .2 2.2-.8l3.1-15.6c.2-1-.8-1.8-1.6-1.4ZM9.8 14.6l-.4 3.6-1.3-4 9.4-6.9-7.7 7.3Z"/></svg>`;
const aura = (id) => `<div class="aura" data-aura="${id || ""}"><i></i><i></i><i></i></div>`;

// ---------- Страницы ----------

function homeView() {
  const t = T();
  const words = [...t.marquee, ...t.marquee];
  return `
  <section class="hero">
    ${aura()}
    <span class="kicker" data-reveal>${esc(t.kicker)}</span>
    <h1 data-reveal data-d="1">${t.heroTitle}</h1>
    <p data-reveal data-d="2">${esc(t.heroSub)}</p>
    <div data-reveal data-d="3"><a class="btn" href="#programs" data-scroll>${esc(t.heroCta)}<span class="ic">${ARROW}</span></a></div>
    <div class="stats" data-reveal data-d="4">
      ${t.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}
    </div>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-track">${words.map((w) => `<span>${esc(w)}</span>`).join("")}</div></div>

  <section class="section" id="programs">
    <span class="eyebrow" data-reveal>${esc(t.tariff)}</span>
    <h2 data-reveal data-d="1">${esc(t.programsTitle)}</h2>
    <p class="lead" data-reveal data-d="2">${esc(t.programsSub)}</p>
    <div class="programs">
      ${PROGRAMS.map((p, i) => {
        const P = t.programs[p.id];
        return `<a class="card" href="/p/${p.id}" data-link data-reveal data-d="${i % 2}">
          <div class="cover" data-vt="cover-${p.id}">
            ${aura(p.id)}
            <span class="num">0${i + 1}</span>
            <h3 class="cover-title" data-vt="title-${p.id}">${esc(P.title)}</h3>
          </div>
          <div class="card-body">
            <div><p>${esc(P.short)}</p><span class="price">${money(p.price)}</span></div>
            <span class="go">${ARROW}</span>
          </div>
        </a>`;
      }).join("")}
    </div>
  </section>

  <section class="section two">
    <div>
      <h2 data-reveal>${esc(t.howTitle)}</h2>
    </div>
    <ol class="steps">${t.how.map(([b, s], i) => `<li data-reveal data-d="${i}"><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join("")}</ol>
  </section>

  <section class="section two">
    <h2 data-reveal>${esc(t.includedTitle)}</h2>
    <div class="panel" data-reveal data-d="1"><ul class="checks">${t.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
  </section>

  <section class="section faq">
    <h2 data-reveal>${esc(t.faqTitle)}</h2>
    <div data-reveal data-d="1">
      ${t.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
    </div>
  </section>
  ${footer()}`;
}

function programView(p) {
  const t = T();
  const P = t.programs[p.id];
  const i = PROGRAMS.indexOf(p);
  return `
  <section class="p-hero" data-vt="cover-${p.id}">
    ${aura(p.id)}
    <a class="back" href="/" data-link>${BACK}${esc(t.back)}</a>
    <div class="p-hero-in">
      <span class="kicker">0${i + 1} · ${esc(t.tariff)}</span>
      <h1 data-vt="title-${p.id}">${esc(P.title)}</h1>
      <p data-reveal data-d="2">${esc(P.short)}</p>
    </div>
  </section>
  <div class="p-body">
    <section>
      <h3 data-reveal>${esc(t.goalsTitle)}</h3>
      <ol class="goals">${P.goals.map((g, k) => `<li data-reveal data-d="${k}">${esc(g)}</li>`).join("")}</ol>
    </section>
    <section>
      <h3 data-reveal>${esc(t.includedTitle)}</h3>
      <div class="panel" data-reveal data-d="1"><ul class="checks">${t.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
    </section>
    <section>
      <h3 data-reveal>${esc(t.howTitle)}</h3>
      <ol class="steps">${t.how.map(([b, s], k) => `<li data-reveal data-d="${k}"><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join("")}</ol>
    </section>
    <div class="trust" data-reveal>
      <span>🔒 ${esc(t.secure)}</span>
      <span class="pay"><span>Visa</span><span>Mastercard</span><span>Apple Pay</span><span>Google Pay</span></span>
    </div>
    ${inAppBrowser ? `<div class="hint" data-reveal>${esc(t.inApp)}</div>` : ""}
  </div>
  <div class="buybar">
    <div><small>${esc(t.access)}</small><span class="price">${money(p.price)}</span></div>
    <button class="btn" id="buy" data-program="${p.id}">${esc(t.buy)}<span class="ic">${ARROW}</span></button>
  </div>
  ${footer()}`;
}

function footer() {
  const t = T();
  return `<footer class="foot">
    <p class="big">Liza<br><em>Kovalova</em></p>
    <nav>
      <a href="https://www.instagram.com/liza_kovalova_/" target="_blank" rel="noopener">Instagram</a>
      <a href="https://www.instagram.com/liza_kovalova_/" target="_blank" rel="noopener">${esc(t.support)}</a>
    </nav>
    <small>© ${new Date().getFullYear()} · ${esc(t.footer)}</small>
  </footer>`;
}

function doneCard(inner) {
  return `<section class="done">${aura()}<div class="done-card">${inner}<a class="link" href="/" data-link>${esc(T().back)}</a></div></section>`;
}
const CHECK = `<svg class="check" viewBox="0 0 84 84"><circle cx="42" cy="42" r="38"/><path d="M27 43l10 10 20-22"/></svg>`;

function successView(state) {
  const t = T();
  if (state.kind === "loading") return doneCard(`<div class="ring"></div><h1>${esc(t.checking)}</h1>`);
  if (state.kind === "pending") return doneCard(`<div class="ring"></div><h1>${esc(t.checking)}</h1><p>${esc(t.pendingText)}</p>`);
  if (state.kind === "demo") return doneCard(`${CHECK}<h1>${esc(t.demoTitle)}</h1><p>${esc(t.demoText)}</p>`);
  if (state.kind === "error") return doneCard(`<h1>${esc(t.errorTitle)}</h1><p>${esc(t.errorText)}</p>
    <a class="btn wide" href="https://www.instagram.com/liza_kovalova_/" target="_blank" rel="noopener">${esc(t.support)}<span class="ic">${ARROW}</span></a>`);
  const P = t.programs[state.program];
  const joined = state.kind === "joined";
  return doneCard(`${CHECK}
    ${P ? `<span class="tag">${esc(P.title)}</span>` : ""}
    <h1>${esc(joined ? t.boundTitle : t.readyTitle)}</h1>
    <p>${esc(joined ? t.boundText : t.readyText)}</p>
    ${joined ? "" : `<a class="btn wide" href="${esc(state.link)}" rel="noopener noreferrer">${esc(t.openTg)}<span class="ic">${TG}</span></a>`}`);
}

// ---------- Оплата и доступ ----------

let successState = { kind: "loading" };

async function loadAccess() {
  const q = new URLSearchParams(location.search);
  if (q.get("demo")) { successState = { kind: "demo" }; return draw(); }
  let sessionId = q.get("session_id");
  // Убираем id сессии из адресной строки, но помним его на случай обновления страницы
  if (sessionId) {
    try { sessionStorage.setItem("session_id", sessionId); } catch {}
    history.replaceState(null, "", "/success");
  } else {
    try { sessionId = sessionStorage.getItem("session_id"); } catch {}
  }
  if (!sessionId) { successState = { kind: "error" }; return draw(); }

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch(`/api/access?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 202) {
        if (successState.kind !== "pending") { successState = { kind: "pending" }; draw(); }
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      successState = res.ok ? { kind: data.status, program: data.program, link: data.link } : { kind: "error" };
    } catch {
      successState = { kind: "error" };
    }
    return draw();
  }
  successState = { kind: "error" };
  draw();
}

async function buy(btn) {
  btn.classList.add("loading");
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ program: btn.dataset.program, lang, utm: utm() })
    });
    const data = await res.json();
    if (data.url) { location.href = data.url; return; }
    if (data.demo) { navigate(`/success?demo=1`); return; }
    throw new Error(data.error);
  } catch {
    toast(T().payError);
  }
  btn.classList.remove("loading");
}

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
}

// ---------- Роутер ----------

function currentView() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const m = path.match(/^\/p\/([a-z]+)$/);
  const p = m && findProgram(m[1]);
  if (p) return { html: programView(p), title: `${T().programs[p.id].title} — Liza Kovalova` };
  if (path === "/success") return { html: successView(successState), title: "Liza Kovalova" };
  return { html: homeView(), title: "Liza Kovalova" };
}

function draw() {
  const { html, title } = currentView();
  document.documentElement.lang = lang;
  document.title = title;
  app.innerHTML = html;
  document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  // Стили задаём через CSSOM: CSP запрещает inline-атрибуты style
  app.querySelectorAll("[data-aura]").forEach((el) => {
    const p = findProgram(el.dataset.aura);
    if (p) p.aura.forEach((c, k) => el.style.setProperty(`--a${k + 1}`, c));
  });
  app.querySelectorAll("[data-d]").forEach((el) => el.style.setProperty("--d", el.dataset.d));
  app.querySelectorAll("[data-vt]").forEach((el) => (el.style.viewTransitionName = el.dataset.vt));
  observeReveal();
}

function transition(update) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  document.startViewTransition(update);
}

function navigate(href) {
  const url = new URL(href, location.origin);
  const samePage = url.pathname === location.pathname;
  history.pushState(null, "", url.pathname + url.search + url.hash);
  if (url.pathname === "/success") { successState = { kind: "loading" }; loadAccess(); }
  transition(() => {
    draw();
    if (!samePage) window.scrollTo({ top: 0, behavior: "instant" });
  });
}

let io;
function observeReveal() {
  io?.disconnect();
  io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  app.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
}

document.addEventListener("click", (e) => {
  const buyBtn = e.target.closest("#buy");
  if (buyBtn) return buy(buyBtn);
  const langBtn = e.target.closest(".lang button");
  if (langBtn) {
    lang = langBtn.dataset.lang;
    store.set("lang", lang);
    return transition(draw);
  }
  const scroll = e.target.closest("[data-scroll]");
  if (scroll) {
    e.preventDefault();
    document.querySelector(scroll.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const link = e.target.closest("a[data-link]");
  if (link && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    navigate(link.getAttribute("href"));
  }
});
window.addEventListener("popstate", () => transition(draw));

const bar = document.getElementById("bar");
const onScroll = () => bar.classList.toggle("solid", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

draw();
if (location.pathname.startsWith("/success")) loadAccess();
