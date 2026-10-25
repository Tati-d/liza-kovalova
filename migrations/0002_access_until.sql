-- Срок доступа к каналу (unix-время). NULL — без ограничения.
ALTER TABLE orders ADD COLUMN access_until INTEGER;
CREATE INDEX orders_access_until ON orders (status, access_until);
