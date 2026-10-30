# MCP SQL Query

[English](#english) | [Español](#español)

---

## English

### Description

MCP SQL Query is a [Model Context Protocol](https://modelcontextprotocol.io) server that runs raw SQL on MySQL, MariaDB, and PostgreSQL. A `readOnly` connection runs only read queries; otherwise any SQL runs.

### Requirements

- **Node.js 26.13.0+**
- **pnpm**
- A MySQL, MariaDB, or PostgreSQL user

### Installation

```bash
git clone <repository-url>
cd MCP-SQL-Query
pnpm install
pnpm build
```

### Configuration

Copy `connections.example.json` to `connections.json` in the project root. The server loads that file from the parent of `src/` or `dist/`. Each entry is one user and the databases that user can access. Exactly one connection must match the requested `serverType` and database.

```json
{
  "maxTimeoutMs": 15000,
  "excludedColumns": ["password", "email"],
  "connections": [
    {
      "serverType": "mysql",
      "ip": "127.0.0.1",
      "port": 3306,
      "user": "readonly",
      "password": "change-me",
      "databases": ["app", "analytics"],
      "readOnly": true
    }
  ]
}
```

`serverType` is `mysql`, `mariadb`, or `postgres`. `ip` is an IPv4 address, an IPv6 address, or a hostname.

`excludedColumns` names columns a read-only connection must not read, such as `password` or `email`. A read that refers to one of them is rejected, in the select list, a `WHERE` clause, or anywhere else. The error names the column, or the columns. `SELECT *` and `table.*` are rejected too. `COUNT(*)` does not count. A write is not checked against the list. A read-write connection ignores it. Omit the field, or use `[]`, to allow every column.

> [!CAUTION]
> `readOnly` is enforced by this server. To be certain a connection can only read, limit that database user to read privileges (`SELECT`, and anything else it needs that does not write). A user that can write can still write if `readOnly` is off or mis-set.

Cursor (or another MCP client) starts the compiled server:

```json
{
  "mcpServers": {
    "MCP-SQL-Query": {
      "command": "node",
      "args": ["C:\\Proyectos\\MCP-SQL-Query\\dist\\index.js"]
    }
  }
}
```

### Tool

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `list_connections` | — | `excludedColumns`, then each connection's server type, databases, and whether it is read-only or read-write. No hosts, users, or passwords |
| `execute_query` | `sql`, `serverType`, `database` | Run raw SQL. `readOnly` decides whether a write is allowed. On a read-only connection, a read that refers to `excludedColumns` is rejected |

The result is a JSON text block. A rejected query comes back as an MCP tool error.

The server instructions tell the client not to open `connections.json`. That file holds hosts, users, and passwords. `list_connections` is how to see the engine, the databases, the access level, and `excludedColumns` before `execute_query`.

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run the compiled server |
| `pnpm test` | Run the suite. Database tests need the engines from Docker and `connections.json` |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:docker` | Build the test image and run the suite against MySQL 8.4, MariaDB 11.4, and PostgreSQL 17 |
| `pnpm test:docker:down` | Stop the containers and delete their volumes |

`docker-compose.yml` creates the database `app` on all three engines, plus `analytics` from the shared MySQL/MariaDB script. Both have an `accounts` table (`ada`, `grace`). Users are `readonly` (`SELECT`) and `app` (writes), password `password`. Host ports are `53306`, `53307`, and `55432`. `docker/Dockerfile` builds the container that runs the tests, using `docker/connections.json`.

GitHub Actions runs the same suite on `ubuntu-latest`. MySQL 8.4, MariaDB 11.4, and PostgreSQL 17 start as service containers. The job loads `docker/db`, writes `connections.json` from `docker/connections.json` using `127.0.0.1`, and runs `pnpm test`.

---

## Español

### Descripción

MCP SQL Query es un servidor [Model Context Protocol](https://modelcontextprotocol.io) que ejecuta SQL tal cual en MySQL, MariaDB y PostgreSQL. Una conexión `readOnly` solo ejecuta lecturas; si no, ejecuta cualquier SQL.

### Requisitos

- **Node.js 26.13.0+**
- **pnpm**
- Un usuario de MySQL, MariaDB o PostgreSQL

### Instalación

```bash
git clone <url-del-repositorio>
cd MCP-SQL-Query
pnpm install
pnpm build
```

### Configuración

Copia `connections.example.json` a `connections.json` en la raíz del proyecto. El servidor lo carga desde el directorio padre de `src/` o `dist/`. Cada entrada es un usuario y las bases a las que puede acceder. Tiene que haber exactamente una conexión para el `serverType` y la base pedidos.

```json
{
  "maxTimeoutMs": 15000,
  "excludedColumns": ["password", "email"],
  "connections": [
    {
      "serverType": "mysql",
      "ip": "127.0.0.1",
      "port": 3306,
      "user": "readonly",
      "password": "change-me",
      "databases": ["app", "analytics"],
      "readOnly": true
    }
  ]
}
```

`serverType` es `mysql`, `mariadb` o `postgres`. `ip` es una IPv4, una IPv6 o un hostname.

`excludedColumns` nombra columnas que una conexión de solo lectura no debe leer, como `password` o `email`. Una lectura que se refiera a una de ellas se rechaza, en el `SELECT`, en un `WHERE` o en cualquier otro sitio. El error nombra la columna, o las columnas. `SELECT *` y `tabla.*` también se rechazan. `COUNT(*)` no cuenta. Una escritura no se comprueba contra la lista. Una conexión de lectura y escritura la ignora. Omitir el campo, o poner `[]`, permite todas.

> [!CAUTION]
> `readOnly` lo aplica este servidor. Para estar seguro de que una conexión solo lee, limita ese usuario de la base a permisos de lectura (`SELECT` y lo que necesite que no escriba). Un usuario que pueda escribir seguirá pudiendo escribir si `readOnly` está desactivado o mal puesto.

Cursor (u otro cliente MCP) arranca el servidor compilado:

```json
{
  "mcpServers": {
    "MCP-SQL-Query": {
      "command": "node",
      "args": ["C:\\Proyectos\\MCP-SQL-Query\\dist\\index.js"]
    }
  }
}
```

### Herramienta

| Herramienta | Argumentos | Uso |
|-------------|------------|-----|
| `list_connections` | — | `excludedColumns`, y de cada conexión el motor, las bases y si es de solo lectura o de lectura y escritura. Sin hosts, usuarios ni contraseñas |
| `execute_query` | `sql`, `serverType`, `database` | Ejecuta SQL. `readOnly` decide si se admite una escritura. En una conexión de solo lectura, una lectura que se refiera a `excludedColumns` se rechaza |

El resultado es un bloque de texto JSON. Una consulta rechazada vuelve como error de la herramienta.

Las instrucciones del servidor piden al cliente que no abra `connections.json`. Ese archivo tiene hosts, usuarios y contraseñas. `list_connections` es la forma de ver el motor, las bases, el nivel de acceso y `excludedColumns` antes de `execute_query`.

### Desarrollo

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Modo observación |
| `pnpm build` | Compila a `dist/` |
| `pnpm start` | Arranca el servidor compilado |
| `pnpm test` | Lanza la suite. Los tests de base necesitan los motores de Docker y `connections.json` |
| `pnpm test:watch` | Vitest en observación |
| `pnpm test:docker` | Construye la imagen de tests y lanza la suite contra MySQL 8.4, MariaDB 11.4 y PostgreSQL 17 |
| `pnpm test:docker:down` | Para los contenedores y borra sus volúmenes |

`docker-compose.yml` crea la base `app` en los tres motores, y `analytics` con el script compartido de MySQL y MariaDB. Las dos tienen la tabla `accounts` (`ada`, `grace`). Los usuarios son `readonly` (`SELECT`) y `app` (escritura), contraseña `password`. Los puertos del host son `53306`, `53307` y `55432`. `docker/Dockerfile` construye el contenedor que ejecuta los tests con `docker/connections.json`.

GitHub Actions lanza la misma suite en `ubuntu-latest`. MySQL 8.4, MariaDB 11.4 y PostgreSQL 17 arrancan como servicios. El job carga `docker/db`, escribe `connections.json` a partir de `docker/connections.json` con `127.0.0.1` y ejecuta `pnpm test`.
