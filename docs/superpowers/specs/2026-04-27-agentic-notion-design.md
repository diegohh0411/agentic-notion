# Design: agentic-notion MCP Server

## Context

Team members are guests (not members) of the owner's Notion workspace. Notion's official MCP requires workspace membership, making it inaccessible to guests. A paid plan to upgrade guests to members is not feasible. The solution: a custom MCP server published to NPM that each teammate installs locally, configured with their own Notion integration token (created by the workspace owner and connected to the shared workspace).

## Package

- **Name:** `agentic-notion` (npm — verify availability before publishing)
- **Location:** repo root (the package IS the repo, no monorepo nesting)
- **Runtime:** Node.js, TypeScript
- **Transport:** stdio (Claude Code spawns it as a subprocess)

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server + stdio transport
- `@notionhq/client` — Notion REST API
- `zod` — input validation for tool arguments

## Package Structure

```
notion-mcp-proxy/
├── src/
│   ├── index.ts          # entry point: creates server, registers tools, starts stdio transport
│   ├── client.ts         # initializes @notionhq/client from NOTION_API_KEY env var
│   └── tools/
│       ├── search.ts
│       ├── fetch.ts
│       ├── create-pages.ts
│       ├── update-page.ts
│       ├── get-users.ts
│       ├── get-comments.ts
│       └── create-comment.ts
├── package.json           # name: "agentic-notion", bin: dist/index.js
└── tsconfig.json
```

## Authentication

The workspace owner creates one Notion internal integration token per teammate and connects each to the shared workspace. Each teammate sets their token as `NOTION_API_KEY` in their local Claude MCP config. The server reads this env var at startup and fails fast with a clear error if it is missing.

## Tool Set (v1)

Tools mirror the official Notion MCP exactly in name, parameter shapes, and content formats so teammates can reference official docs.

| Tool | Purpose |
|------|---------|
| `notion-search` | Semantic search across pages/databases |
| `notion-fetch` | Read page/database/data source content |
| `notion-create-pages` | Create new tasks or pages |
| `notion-update-page` | Update properties or page content |
| `notion-get-users` | Resolve workspace users by name/email |
| `notion-get-comments` | Read discussions on a page |
| `notion-create-comment` | Add a comment to a page |

Tools deferred for future versions: `notion-create-database`, `notion-create-view`, `notion-update-view`, `notion-update-data-source`, `notion-move-pages`, `notion-duplicate-page`, `notion-get-teams`.

## Patterns (from official MCP)

- **ID formats:** bare UUIDs or full Notion URLs both accepted — passed through to `@notionhq/client` as-is
- **Content format:** Notion-flavored Markdown strings — passed through verbatim
- **Property values:** SQLite-style (strings, numbers, null)
- **Special property formats:** `date:{prop}:start`, `date:{prop}:end`, `__YES__`/`__NO__` for checkboxes
- **Parent types:** discriminated union of `page_id`, `database_id`, `data_source_id`
- **Pagination:** cursor-based with `start_cursor` / `next_cursor`

## Data Flow

```
Claude Code
    │ MCP tool call (stdio)
    ▼
agentic-notion (Node.js process)
    │ reads NOTION_API_KEY from env at startup
    │ validates token present → exits with clear error if missing
    │
    ├─ validates input args with Zod
    │     → returns MCP error if invalid
    │
    ├─ calls @notionhq/client
    │
    └─ maps Notion API response → MCP tool result (string)
Claude Code receives result
```

## Error Handling

| Situation | Behavior |
|-----------|----------|
| `NOTION_API_KEY` missing at startup | Process exits: `"NOTION_API_KEY env var is required"` |
| Invalid tool arguments | Zod validation error returned as MCP error |
| Notion API errors (401, 403, 404, rate limit) | Surfaced as MCP tool error with Notion error code and message |

No retries or fallbacks — errors surface directly for debuggability.

## Teammate Config

Committed to the repo as a template; each person fills in their personal token:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["agentic-notion"],
      "env": { "NOTION_API_KEY": "secret_REPLACE_ME" }
    }
  }
}
```

## Out of Scope (v1)

- OAuth / user-level auth
- Retry logic
- Caching
- Rate limit handling beyond surfacing the error
- Tools beyond the 7 listed above
