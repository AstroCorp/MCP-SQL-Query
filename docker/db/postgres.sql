-- Misma base que en MySQL y MariaDB: app, accounts y los dos usuarios.
CREATE TABLE accounts (
	id INT NOT NULL PRIMARY KEY,
	name VARCHAR(64) NOT NULL
);

INSERT INTO accounts (id, name) VALUES
	(1, 'ada'),
	(2, 'grace');

CREATE USER readonly WITH PASSWORD 'password';
GRANT CONNECT ON DATABASE app TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON accounts TO readonly;

CREATE USER app WITH PASSWORD 'password';
GRANT CONNECT ON DATABASE app TO app;
GRANT USAGE, CREATE ON SCHEMA public TO app;
GRANT ALL PRIVILEGES ON accounts TO app;
GRANT ALL PRIVILEGES ON DATABASE app TO app;
