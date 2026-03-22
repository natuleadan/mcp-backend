# mcp-backend — Installation Guide

How to connect `mcp-backend` to different AI clients as an MCP server.

---

## 1. Prerequisites

- **Node.js 18+** and **pnpm**
- A running **PostgreSQL** instance (or Supabase project)
- **Supabase** project with storage enabled (for storage tools)

### macOS
```bash
brew install node
npm install -g pnpm
```

### Linux
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

### Windows (PowerShell as Administrator)
```powershell
winget install OpenJS.NodeJS
npm install -g pnpm
```

---

## 2. Install mcp-backend

```bash
git clone https://github.com/natuleadan/mcp-backend
cd mcp-backend
pnpm install
```

---

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
POSTGRES_URL=postgres://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Optional — only needed for Iceberg tools
CATALOG_URI=https://your-project.storage.supabase.co/storage/v1/iceberg
ICEBERG_TOKEN=your-service-role-jwt
ICEBERG_WAREHOUSE=your-warehouse-name
ICEBERG_NAMESPACE=audit
AWS_ACCESS_KEY_ID=your-s3-access-key
AWS_SECRET_ACCESS_KEY=your-s3-secret-key
S3_ENDPOINT=https://your-project.storage.supabase.co/storage/v1/s3
```

> All credentials must match your Supabase project. `POSTGRES_URL` is required for all DB tools.

---

## 4. Add seed files (optional)

Place client-specific SQL files in:

```
base/   ← ordered SQL files for base data (languages, settings, navigation)
data/   ← ordered SQL files for application data (users, products, courses)
```

These directories are excluded from git — they are per-client and must be added manually.

---

## 5. Connect to your AI client

Copy `.mcp.json` and replace `/absolute/path/to/mcp-backend` with your actual path:

```json
{
  "mcpServers": {
    "mcp-backend": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-backend", "start"],
      "env": {}
    }
  }
}
```

> The `env` block is empty — variables are loaded from `.env` via `dotenv`.

---

## Client-specific setup

### Claude Code

Place `.mcp.json` at the **root of your workspace** (where you run `claude`):

```bash
cp .mcp.json /your/workspace/.mcp.json
# edit the path inside the file
```

Verify the connection:
```
/mcp
```
You should see `mcp-backend` listed with all tools available.

---

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mcp-backend": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-backend", "start"]
    }
  }
}
```

Restart Claude Desktop. Check **Settings → Developer → MCP Servers** to confirm.

---

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-level):

```json
{
  "mcpServers": {
    "mcp-backend": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-backend", "start"],
      "env": {}
    }
  }
}
```

---

### Windsurf (Codeium)

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mcp-backend": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-backend", "start"],
      "env": {}
    }
  }
}
```

---

### Kilo Code (VS Code extension)

Open VS Code → Command Palette → `Kilo Code: Open Settings` → **MCP Servers** → **Add Server**:

```json
{
  "name": "mcp-backend",
  "transport": "stdio",
  "command": "pnpm",
  "args": ["--dir", "/absolute/path/to/mcp-backend", "start"]
}
```

---

### Zed

Edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "mcp-backend": {
      "command": {
        "path": "pnpm",
        "args": ["--dir", "/absolute/path/to/mcp-backend", "start"]
      }
    }
  }
}
```

---

### Any stdio-compatible MCP client

```
command:  pnpm
args:     ["--dir", "/absolute/path/to/mcp-backend", "start"]
```

The server communicates over stdin/stdout using MCP JSON-RPC. No network port needed.

---

## Troubleshooting

**`POSTGRES_URL not set` error:**
Make sure `.env` exists and has a valid `POSTGRES_URL`.

**`pnpm` not found in PATH:**
```bash
which pnpm   # use the full path as the command value
```

**Iceberg queries time out:**
The FDW scan can be slow on first access. Default timeout is 30s. If your data lake is cold, retry after a few seconds.

**Storage tools return 401:**
Check that `SUPABASE_SECRET_KEY` (service role) is correct and the bucket exists in your Supabase project.
