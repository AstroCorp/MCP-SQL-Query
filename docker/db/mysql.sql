-- app y analytics, con el mismo esquema y los dos usuarios.
CREATE DATABASE IF NOT EXISTS analytics;

USE app;

CREATE TABLE accounts (
	id INT NOT NULL PRIMARY KEY,
	name VARCHAR(64) NOT NULL
);

INSERT INTO accounts (id, name) VALUES
	(1, 'ada'),
	(2, 'grace');

USE analytics;

CREATE TABLE accounts (
	id INT NOT NULL PRIMARY KEY,
	name VARCHAR(64) NOT NULL
);

INSERT INTO accounts (id, name) VALUES
	(1, 'ada'),
	(2, 'grace');

CREATE USER 'readonly'@'%' IDENTIFIED BY 'password';
GRANT SELECT ON app.* TO 'readonly'@'%';
GRANT SELECT ON analytics.* TO 'readonly'@'%';

CREATE USER 'app'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON app.* TO 'app'@'%';
GRANT ALL PRIVILEGES ON analytics.* TO 'app'@'%';

FLUSH PRIVILEGES;
