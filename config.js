// Настройки, которые меняет владелец: цены, ссылки Stripe и Telegram.
// stripeLink — Stripe Payment Link (https://buy.stripe.com/...). Пока пусто — кнопка ведёт в демо-режим.
// telegram — инвайт-ссылка в закрытый канал программы (https://t.me/+...).
window.CONFIG = {
  instagram: "https://www.instagram.com/liza_kovalova_/",
  currency: "€",
  programs: [
    { id: "back",    price: 29, stripeLink: "", telegram: "https://t.me/+REPLACE_BACK" },
    { id: "hips",    price: 29, stripeLink: "", telegram: "https://t.me/+REPLACE_HIPS" },
    { id: "splits",  price: 29, stripeLink: "", telegram: "https://t.me/+REPLACE_SPLITS" },
    { id: "legs",    price: 29, stripeLink: "", telegram: "https://t.me/+REPLACE_LEGS" },
    { id: "pilates", price: 29, stripeLink: "", telegram: "https://t.me/+REPLACE_PILATES" }
  ]
};
