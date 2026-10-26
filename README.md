# MCP SQL Query

[English](#english) | [Español](#español)

---

## English

### Description

MCP SQL Query is a [Model Context Protocol](https://modelcontextprotocol.io) server that runs raw SQL on MySQL, MariaDB, and PostgreSQL. A `readOnly` connection runs only read queries; otherwise any SQL runs.

### Requirements

- **Node.js 24.22.1+**
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

> **Warning.** `readOnly` is enforced by this server. To be certain a connection can only read, limit that database user to read privileges (`SELECT`, and anything else it needs that does not write). A user that can write can still write if `readOnly` is off or mis-set.

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
| `list_connections` | — | Server type, databases, and whether each connection is read-only or read-write. No hosts, users, or passwords |
| `execute_query` | `sql`, `serverType`, `database` | Run raw SQL. `readOnly` on the matching connection decides whether a write is allowed |

The result is a JSON text block. A rejected query comes back as an MCP tool error.

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

---

## Español

### Descripción

MCP SQL Query es un servidor [Model Context Protocol](https://modelcontextprotocol.io) que ejecuta SQL en MySQL, MariaDB y PostgreSQL. Una conexión `readOnly` solo ejecuta lecturas; si no, ejecuta cualquier SQL.

### Requisitos

- **Node.js 24.22.1+**
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

> **Aviso.** `readOnly` lo aplica este servidor. Para estar seguro de que una conexión solo lee, limita ese usuario de la base a permisos de lectura (`SELECT` y lo que necesite que no escriba). Un usuario que pueda escribir seguirá pudiendo escribir si `readOnly` está desactivado o mal puesto.

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
| `list_connections` | — | Motor, bases y si cada conexión es de solo lectura o de lectura y escritura. Sin hosts, usuarios ni contraseñas |
| `execute_query` | `sql`, `serverType`, `database` | Ejecuta SQL. `readOnly` de la conexión que coincide decide si se admite una escritura |

El resultado es un bloque de texto JSON. Una consulta rechazada vuelve como error de la herramienta.

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
