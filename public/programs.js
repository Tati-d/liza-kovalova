// Единственный источник цен: сайт показывает их, сервер берёт их же при создании оплаты.
// price — в центах (2900 = 29,00 €). Тексты — в i18n.js.
export const CURRENCY = "eur";

export const PROGRAMS = [
  { id: "back",    price: 2900, aura: ["#e9c9b8", "#a8705c", "#f4e6dc"] },
  { id: "hips",    price: 2900, aura: ["#ecd3b4", "#b98257", "#f6ebdd"] },
  { id: "splits",  price: 2900, aura: ["#e8c6cf", "#94505f", "#f5e4e8"] },
  { id: "legs",    price: 2900, aura: ["#ddd2c2", "#7d6450", "#efe8de"] },
  { id: "pilates", price: 2900, aura: ["#d6ddd2", "#6f8a72", "#ebefe7"] }
];

export const findProgram = (id) => PROGRAMS.find((p) => p.id === id);
