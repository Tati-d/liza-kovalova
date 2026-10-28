// Единственный источник цен: сайт показывает их, сервер берёт их же при создании оплаты.
// price — в центах (999 = 9,99 €). accessDays — срок доступа к каналу с момента оплаты
// (null — без ограничения). contact — вместо оплаты кнопка ведёт в личные сообщения;
// listPrice — цена только для показа (такой курс через сайт не продаётся).
// photo — фото для карточки на главной (pos — какую часть кадра показывать в узкой карточке);
// media — фото или видео на странице курса (sound: true — видео с голосом, запускается по нажатию).
// media — фото или видео из тренировки (горизонтальное, 16:9): { type: "video", src: "/media/back.mp4", poster: "/media/back.jpg" }
// или { type: "image", src: "/media/back.jpg" }; файлы кладутся в public/media/. Тексты — в i18n.js.
export const CURRENCY = "eur";

export const PROGRAMS = [
  { id: "back",    price: 999,  accessDays: null, aura: ["#e9c9b8", "#a8705c", "#f4e6dc"],
    photo: { src: "/media/back.jpg", pos: "48% 50%" },
    media: { type: "video", src: "/media/back.mp4", poster: "/media/back-poster.jpg", sound: true } },
  { id: "splits",  price: 999,  accessDays: 30,   aura: ["#e8c6cf", "#94505f", "#f5e4e8"],
    photo: { src: "/media/splits.jpg", pos: "46% 50%" },
    media: { type: "image", src: "/media/splits.jpg" } },
  { id: "pilates", price: 1499, accessDays: 30,   aura: ["#d6ddd2", "#6f8a72", "#ebefe7"],
    photo: { src: "/media/pilates.jpg", pos: "44% 50%" },
    media: { type: "image", src: "/media/pilates.jpg" } },
  { id: "personal", price: null, listPrice: 5000, contact: "https://wa.me/4915560740296", aura: ["#e6c3b0", "#7a4a3c", "#f2e2d8"] }
];

export const findProgram = (id) => PROGRAMS.find((p) => p.id === id);
