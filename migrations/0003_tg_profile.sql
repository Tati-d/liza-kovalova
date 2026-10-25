-- Профиль покупателя в Telegram на момент вступления: для поддержки (ID остаётся главным, username можно сменить)
ALTER TABLE orders ADD COLUMN tg_username TEXT;
ALTER TABLE orders ADD COLUMN tg_name TEXT;
