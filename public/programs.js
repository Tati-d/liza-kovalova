// Единственный источник цен: сайт показывает их, сервер берёт их же при создании оплаты.
// price — в центах (999 = 9,99 €). accessDays — срок доступа к каналу с момента оплаты
// (null — без ограничения). Тексты — в i18n.js.
export const CURRENCY = "eur";

export const PROGRAMS = [
  { id: "back",    price: 999,  accessDays: null, aura: ["#e9c9b8", "#a8705c", "#f4e6dc"] },
  { id: "splits",  price: 999,  accessDays: 30,   aura: ["#e8c6cf", "#94505f", "#f5e4e8"] },
  { id: "pilates", price: 1499, accessDays: 30,   aura: ["#d6ddd2", "#6f8a72", "#ebefe7"] }
];

export const findProgram = (id) => PROGRAMS.find((p) => p.id === id);
