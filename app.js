// Общая логика: язык, список программ, страница программы, страница успеха.
const ICONS = { back: "🧘‍♀️", hips: "🦋", splits: "🤸‍♀️", legs: "🦵", pilates: "🌿" };

function getLang() {
  try { return localStorage.getItem("lang") || "ru"; } catch { return "ru"; }
}
function setLang(l) {
  try { localStorage.setItem("lang", l); } catch {}
  render();
}
const t = () => window.I18N[getLang()];
const prog = (id) => window.CONFIG.programs.find((p) => p.id === id);
const money = (p) => `${p.price} ${window.CONFIG.currency}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderLang() {
  document.documentElement.lang = getLang();
  document.querySelectorAll(".lang button").forEach((b) => {
    b.classList.toggle("on", b.dataset.lang === getLang());
    b.onclick = () => setLang(b.dataset.lang);
  });
  const f = document.getElementById("footer");
  if (f) f.textContent = `© ${new Date().getFullYear()} · ${t().footer}`;
}

let filter = "all";

function listView() {
  const T = t();
  const chips = [["all", T.all], ...window.CONFIG.programs.map((p) => [p.id, T.programs[p.id].title])]
    .map(([id, label]) => `<button class="chip ${filter === id ? "on" : ""}" data-f="${id}">${esc(label)}</button>`)
    .join("");
  const cards = window.CONFIG.programs
    .filter((p) => filter === "all" || p.id === filter)
    .map((p) => {
      const P = T.programs[p.id];
      return `<a class="card" href="#/${p.id}">
        <div class="cover ${p.id}">${ICONS[p.id]}</div>
        <div class="card-body">
          <span class="tag">${esc(T.from)}</span>
          <h3>${esc(P.title)}</h3>
          <p>${esc(P.short)}</p>
          <div class="price">${money(p)}</div>
        </div></a>`;
    })
    .join("");
  return `<section class="profile">
      <div class="avatar">LK</div>
      <h1>Liza Kovalova</h1>
      <p>${esc(T.bio)}</p>
      <a class="ig" href="${window.CONFIG.instagram}" target="_blank" rel="noopener">Instagram @liza_kovalova_</a>
    </section>
    <nav class="chips">${chips}</nav>
    <section class="grid">${cards}</section>`;
}

function payUrl(p) {
  if (p.stripeLink) {
    // client_reference_id помогает сопоставить оплату в кабинете Stripe
    const u = new URL(p.stripeLink);
    u.searchParams.set("client_reference_id", p.id);
    return u.toString();
  }
  return `success.html?p=${p.id}&demo=1`;
}

function detailView(p) {
  const T = t();
  const P = T.programs[p.id];
  return `<a class="link-back" href="#/">${esc(T.back)}</a>
    <article class="detail">
      <div class="cover ${p.id}">${ICONS[p.id]}</div>
      <div class="detail-body">
        <span class="tag">${esc(T.from)}</span>
        <h2>${esc(P.title)}</h2>
        <ul class="goals">${P.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
        <h4>${esc(T.included)}</h4>
        <ul class="features">${T.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="buy">
          <div class="price">${money(p)}</div>
          <a class="btn" href="${payUrl(p)}">${esc(T.pay)}</a>
          <p class="note">${esc(T.payNote)}</p>
        </div>
      </div>
    </article>`;
}

function successView() {
  const T = t();
  const q = new URLSearchParams(location.search);
  const p = prog(q.get("p"));
  const P = p && T.programs[p.id];
  return `<section class="detail success">
      <div class="big">🎉</div>
      <h2>${esc(T.successTitle)}</h2>
      ${P ? `<p><b>${esc(P.title)}</b></p>` : ""}
      <p>${esc(T.successText)}</p>
      ${p ? `<a class="btn tg" href="${p.telegram}" target="_blank" rel="noopener">${esc(T.openTg)}</a>` : ""}
      ${q.get("demo") ? `<div class="demo">${esc(T.demo)}</div>` : ""}
      <p><a class="link-back" href="./">${esc(T.back)}</a></p>
    </section>`;
}

function render() {
  renderLang();
  const app = document.getElementById("app");
  if (document.body.dataset.page === "success") {
    app.innerHTML = successView();
    return;
  }
  const id = location.hash.replace(/^#\/?/, "");
  const p = prog(id);
  app.innerHTML = p ? detailView(p) : listView();
  app.querySelectorAll(".chip").forEach((c) => (c.onclick = () => { filter = c.dataset.f; render(); }));
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
render();
