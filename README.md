<p align="center">
  <img src="public/logo.svg" alt="mcp-backend" width="120" height="120" />
</p>

<h1 align="center">mcp-backend</h1>
<p align="center"><strong>MCP server with full backend access — PostgreSQL, Supabase Storage, Iceberg and seeds</strong></p>

<p align="center">
  <a href="https://github.com/natuleadan/mcp-backend/releases"><img src="https://img.shields.io/github/v/release/natuleadan/mcp-backend?include_prereleases&style=for-the-badge" alt="GitHub release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/PostgreSQL-direct-blue?style=for-the-badge" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Supabase-storage-green?style=for-the-badge" alt="Supabase" />
  <img src="https://img.shields.io/badge/Status-In%20Development-orange?style=for-the-badge" alt="In Development" />
  <img src="https://img.shields.io/badge/Tools-31-blue?style=for-the-badge" alt="31 Tools" />
</p>

> ⚠️ **Active Development** — APIs and tools may change without prior notice. Use tagged releases (`vX.Y.Z`) for stability.

---

Local MCP server compatible with any studio-based AI client. Provides direct PostgreSQL access, Supabase Storage operations, Iceberg catalog queries and SQL seed management for the nla-fullstack backend.

## Stack

- **Database**: PostgreSQL via `pg` (direct connection)
- **Storage**: Supabase Storage (buckets + signed URLs)
- **Data Lake**: Apache Iceberg REST Catalog
- **Protocol**: MCP over stdio

---

## Tools (31 Total)

### Database (5)

| Tool | Description |
|------|-------------|
| `query_db` | Run SELECT queries on PostgreSQL |
| `execute_sql` | Execute arbitrary SQL (INSERT/UPDATE/DELETE) with transaction support |
| `execute_sql_file` | Execute SQL file content (PL/pgSQL blocks, multi-statement scripts) with transaction support |
| `execute_rls_sql` | Execute SQL with RLS context (impersonate user role) |
| `list_tables` | List all public tables |

### Seeds (4)

| Tool | Description |
|------|-------------|
| `list_seed_files` | List available SQL seed files in `base/` and `data/` |
| `run_base_seed` | Run base seed files (languages, countries, settings, navigation) |
| `run_data_seed` | Run data seed files (users, products, courses, articles) |
| `run_all_seeds` | Run base + data seeds in order |

### Storage (10)

| Tool | Description |
|------|-------------|
| `list_buckets` | List all Supabase storage buckets |
| `list_files` | List files in a bucket with pagination |
| `get_signed_url` | Generate a signed URL for a file (private buckets) |
| `get_public_url` | Get the public URL for a file (public buckets) |
| `upload_file` | Upload a file to a bucket with MIME type detection |
| `delete_file` | Delete a file from a bucket |
| `download_bucket` | Download files from Supabase storage to local buckets/ folder (all buckets, one bucket, specific folder, or single file) |
| `bulk_upload_files` | Upload multiple files or entire folder with selective file extension filtering (e.g., ignore `.sql`, `.tmp`) and optional storage prefix |
| `generate_and_update_signed_url` | Generate signed URL and atomically update DB table with URL + expiration timestamp |

### Iceberg (3)

| Tool | Description |
|------|-------------|
| `list_iceberg_tables` | List foreign tables in the `iceberg` schema (via FDW) |
| `query_iceberg` | SELECT from an Iceberg foreign table via Postgres FDW with filters |
| `list_iceberg_catalog_tables` | List tables from the Iceberg REST Catalog directly |

### RPC (1)

| Tool | Description |
|------|-------------|
| `call_rpc` | Call a PostgreSQL RPC function with named arguments |

### Bootstrap (1)

| Tool | Description |
|------|-------------|
| `bootstrap_iceberg` | Bootstrap Iceberg schema and foreign data wrapper |

### Schema & Query Analysis (4)

| Tool | Description |
|------|-------------|
| `table_info` | Describe table schema (columns, types, constraints, indexes) |
| `column_stats` | Get column statistics (cardinality, NULL%, data distribution) |
| `validate_sql` | Parse SQL without executing to catch syntax errors |
| `query_with_explain` | Run query with EXPLAIN ANALYZE for performance debugging |

### Observability (3)

| Tool | Description |
|------|-------------|
| `active_queries` | List long-running queries with duration and state |
| `database_stats` | Table sizes, row counts, and growth metrics |
| `index_info` | List indexes with size, scan count, and usage stats |

---

## Setup

See [INSTALL.md](./INSTALL.md) for full setup instructions.

```bash
cp .env.example .env   # fill in your credentials
pnpm install
pnpm start             # start MCP server
```

---

## Seed structure

Seeds are organized in two directories (not committed — client-specific):

```
base/   ← company info, languages, countries, currencies, navigation, SEO
data/   ← users, products, courses, articles, pages
```

Run order: `base/` always before `data/`.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `CATALOG_URI` | Iceberg REST Catalog URI |
| `ICEBERG_TOKEN` | Bearer token for Iceberg catalog |
| `ICEBERG_WAREHOUSE` | Iceberg warehouse name |
| `ICEBERG_NAMESPACE` | Iceberg namespace (default: `audit`) |
| `AWS_ACCESS_KEY_ID` | S3-compatible access key |
| `AWS_SECRET_ACCESS_KEY` | S3-compatible secret key |
| `S3_ENDPOINT` | S3-compatible endpoint URL |

---

## Community

Contributions are subject to [natuleadan](https://github.com/natuleadan) review policies and terms.

Thanks to all contributors:

<p align="left">
  <a href="https://github.com/natuleadan"><img src="https://avatars.githubusercontent.com/u/210283438?v=4&s=48" width="48" height="48" alt="natuleadan" title="natuleadan"/></a>
  <a href="https://github.com/leojara95"><img src="https://avatars.githubusercontent.com/u/268038834?v=4&s=48" width="48" height="48" alt="leojara95" title="leojara95"/></a>
</p>

---

## Star History

<a href="https://www.star-history.com/?repos=natuleadan%2Fmcp-backend&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=natuleadan/mcp-backend&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=natuleadan/mcp-backend&type=date&theme=light&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=natuleadan/mcp-backend&type=date&legend=top-left" />
  </picture>
</a>

---

## License

MIT © [Leonardo Jara](https://github.com/leojara95)
