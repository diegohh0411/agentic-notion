# agentic-notion Implementation Plan

**Goal:** Build and publish an NPM package (`agentic-notion`) that runs as a stdio MCP server, exposing 7 Notion tools so teammates can interact with a shared workspace using their personal Notion integration tokens.

**Architecture:** Each tool file exports an `inputSchema` (Zod shape) and an async `handler` function. `src/index.ts` imports all of them and registers them on an `McpServer` instance, then connects to a `StdioServerTransport`. The `@notionhq/client` singleton is created once in `src/client.ts` and imported by every tool.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@notionhq/client`, `zod`, `vitest`

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Package metadata, bin entry, scripts, dependencies |
| `tsconfig.json` | NodeNext ESM TypeScript config |
| `vitest.config.ts` | Test runner configuration |
| `src/client.ts` | Validates `NOTION_API_KEY`, exports `notion` singleton |
| `src/tools/utils.ts` | `toolResult`, `toolError`, `extractId`, `textToBlocks` |
| `src/tools/search.ts` | `notion-search` tool |
| `src/tools/fetch.ts` | `notion-fetch` tool |
| `src/tools/create-pages.ts` | `notion-create-pages` tool |
| `src/tools/update-page.ts` | `notion-update-page` tool |
| `src/tools/get-users.ts` | `notion-get-users` tool |
| `src/tools/get-comments.ts` | `notion-get-comments` tool |
| `src/tools/create-comment.ts` | `notion-create-comment` tool |
| `src/index.ts` | MCP server entry point — registers all tools, starts stdio |

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agentic-notion",
  "version": "1.0.0",
  "description": "Notion MCP server — lets teammates access a shared Notion workspace via personal integration tokens",
  "type": "module",
  "bin": {
    "agentic-notion": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.0",
    "@notionhq/client": "^2.3.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "feat: scaffold agentic-notion package"
```

---

### Task 2: Notion client & shared utilities

**Files:**
- Create: `src/client.ts`
- Create: `src/tools/utils.ts`
- Test: `src/tools/utils.test.ts`

- [ ] **Step 1: Write the failing test for `extractId` and `textToBlocks`**

Create `src/tools/utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractId, textToBlocks, toolResult, toolError } from "./utils.js";

describe("extractId", () => {
  it("returns bare 32-char hex ID as-is", () => {
    expect(extractId("abc123def456abc123def456abc123de")).toBe(
      "abc123def456abc123def456abc123de"
    );
  });

  it("returns UUID with dashes as-is", () => {
    expect(extractId("abc123de-f456-abc1-23de-f456abc123de")).toBe(
      "abc123de-f456-abc1-23de-f456abc123de"
    );
  });

  it("extracts 32-char ID from a Notion URL", () => {
    expect(
      extractId("https://www.notion.so/workspace/My-Page-abc123def456abc123def456abc123de")
    ).toBe("abc123def456abc123def456abc123de");
  });

  it("extracts UUID from a Notion URL with query string", () => {
    expect(
      extractId(
        "https://www.notion.so/abc123de-f456-abc1-23de-f456abc123de?pvs=4"
      )
    ).toBe("abc123de-f456-abc1-23de-f456abc123de");
  });
});

describe("textToBlocks", () => {
  it("converts a single paragraph to one block", () => {
    const blocks = textToBlocks("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: "Hello world" } }] },
    });
  });

  it("splits on double newlines into multiple blocks", () => {
    const blocks = textToBlocks("First para\n\nSecond para");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].paragraph.rich_text[0].text.content).toBe("First para");
    expect(blocks[1].paragraph.rich_text[0].text.content).toBe("Second para");
  });

  it("ignores empty segments", () => {
    const blocks = textToBlocks("A\n\n\n\nB");
    expect(blocks).toHaveLength(2);
  });
});

describe("toolResult", () => {
  it("wraps data as JSON text content", () => {
    const result = toolResult({ id: "1" });
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(JSON.stringify({ id: "1" }, null, 2));
  });
});

describe("toolError", () => {
  it("returns isError true with message from Error", () => {
    const result = toolError(new Error("bad request"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("bad request");
  });

  it("handles non-Error throws", () => {
    const result = toolError("something broke");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("something broke");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/tools/utils.test.ts
```

Expected: FAIL with "Cannot find module './utils.js'"

- [ ] **Step 3: Create `src/client.ts`**

```typescript
import { Client } from "@notionhq/client";

if (!process.env.NOTION_API_KEY) {
  console.error("NOTION_API_KEY env var is required");
  process.exit(1);
}

export const notion = new Client({ auth: process.env.NOTION_API_KEY });
```

- [ ] **Step 4: Create `src/tools/utils.ts`**

```typescript
export function extractId(input: string): string {
  if (input.startsWith("http")) {
    const hexMatch = input.match(/([0-9a-f]{32})(?:[?#/]|$)/i);
    if (hexMatch) return hexMatch[1];
    const uuidMatch = input.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#/]|$)/i
    );
    if (uuidMatch) return uuidMatch[1];
  }
  return input;
}

export function textToBlocks(content: string) {
  return content
    .split(/\n\n+/)
    .filter(Boolean)
    .map((para) => ({
      type: "paragraph" as const,
      paragraph: {
        rich_text: [{ type: "text" as const, text: { content: para } }],
      },
    }));
}

export function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Notion API error: ${message}` }],
    isError: true as const,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- src/tools/utils.test.ts
```

Expected: PASS (4 describe blocks, all green)

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add notion client and shared tool utilities"
```

---

### Task 3: notion-search tool

**Files:**
- Create: `src/tools/search.ts`
- Test: `src/tools/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/search.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: { search: vi.fn() },
}));

import { handler } from "./search.js";
import { notion } from "../client.js";

const mockSearch = vi.mocked(notion.search);

describe("notion-search handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls notion.search with query and returns JSON", async () => {
    const mockResponse = { results: [{ id: "page-1", object: "page" }], has_more: false };
    mockSearch.mockResolvedValue(mockResponse as any);

    const result = await handler({ query: "sprint tasks", page_size: 10 });

    expect(mockSearch).toHaveBeenCalledWith({
      query: "sprint tasks",
      page_size: 10,
      filter: undefined,
      start_cursor: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  it("passes object filter when provided", async () => {
    mockSearch.mockResolvedValue({ results: [] } as any);

    await handler({ query: "tasks", filter: "page", page_size: 10 });

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { property: "object", value: "page" },
      })
    );
  });

  it("returns isError on Notion API failure", async () => {
    mockSearch.mockRejectedValue(new Error("rate limited"));

    const result = await handler({ query: "x", page_size: 10 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rate limited");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/search.test.ts
```

Expected: FAIL with "Cannot find module './search.js'"

- [ ] **Step 3: Create `src/tools/search.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { toolResult, toolError } from "./utils.js";

export const inputSchema = {
  query: z.string().min(1).describe("Semantic search query over the Notion workspace"),
  filter: z.enum(["page", "database"]).optional().describe("Restrict results to pages or databases only"),
  page_size: z.number().int().min(1).max(25).optional().default(10),
  start_cursor: z.string().optional().describe("Pagination cursor from a previous response"),
};

export async function handler(args: {
  query: string;
  filter?: "page" | "database";
  page_size?: number;
  start_cursor?: string;
}) {
  try {
    const response = await notion.search({
      query: args.query,
      page_size: args.page_size,
      start_cursor: args.start_cursor,
      filter: args.filter
        ? { property: "object", value: args.filter }
        : undefined,
    });
    return toolResult(response);
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/search.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/search.ts src/tools/search.test.ts
git commit -m "feat: add notion-search tool"
```

---

### Task 4: notion-fetch tool

**Files:**
- Create: `src/tools/fetch.ts`
- Test: `src/tools/fetch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/fetch.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    pages: { retrieve: vi.fn() },
    blocks: { children: { list: vi.fn() } },
    databases: { retrieve: vi.fn() },
  },
}));

import { handler } from "./fetch.js";
import { notion } from "../client.js";

const mockPageRetrieve = vi.mocked(notion.pages.retrieve);
const mockBlocksList = vi.mocked(notion.blocks.children.list);
const mockDbRetrieve = vi.mocked(notion.databases.retrieve);

describe("notion-fetch handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches page and its blocks when ID is a page", async () => {
    const mockPage = { id: "page-1", object: "page" };
    const mockBlocks = { results: [{ id: "block-1", type: "paragraph" }] };
    mockPageRetrieve.mockResolvedValue(mockPage as any);
    mockBlocksList.mockResolvedValue(mockBlocks as any);

    const result = await handler({ id: "page-1" });

    expect(mockPageRetrieve).toHaveBeenCalledWith({ page_id: "page-1" });
    expect(mockBlocksList).toHaveBeenCalledWith({ block_id: "page-1" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.page).toEqual(mockPage);
    expect(parsed.blocks).toEqual(mockBlocks);
  });

  it("falls back to database when page retrieval returns a database object", async () => {
    const mockDb = { id: "db-1", object: "database" };
    mockPageRetrieve.mockResolvedValue(mockDb as any);
    mockBlocksList.mockResolvedValue({ results: [] } as any);

    const result = await handler({ id: "db-1" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.page.object).toBe("database");
  });

  it("extracts ID from a Notion URL", async () => {
    mockPageRetrieve.mockResolvedValue({ id: "abc", object: "page" } as any);
    mockBlocksList.mockResolvedValue({ results: [] } as any);

    await handler({
      id: "https://www.notion.so/workspace/My-Page-abc123def456abc123def456abc123de",
    });

    expect(mockPageRetrieve).toHaveBeenCalledWith({
      page_id: "abc123def456abc123def456abc123de",
    });
  });

  it("returns isError on Notion API failure", async () => {
    mockPageRetrieve.mockRejectedValue(new Error("object not found"));

    const result = await handler({ id: "bad-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("object not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/fetch.test.ts
```

Expected: FAIL with "Cannot find module './fetch.js'"

- [ ] **Step 3: Create `src/tools/fetch.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { extractId, toolResult, toolError } from "./utils.js";

export const inputSchema = {
  id: z
    .string()
    .min(1)
    .describe("Page ID, database ID, or full Notion URL"),
};

export async function handler(args: { id: string }) {
  try {
    const pageId = extractId(args.id);
    const page = await notion.pages.retrieve({ page_id: pageId });
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    return toolResult({ page, blocks });
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/fetch.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/fetch.ts src/tools/fetch.test.ts
git commit -m "feat: add notion-fetch tool"
```

---

### Task 5: notion-create-pages tool

**Files:**
- Create: `src/tools/create-pages.ts`
- Test: `src/tools/create-pages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/create-pages.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    pages: { create: vi.fn() },
    blocks: { children: { append: vi.fn() } },
  },
}));

import { handler } from "./create-pages.js";
import { notion } from "../client.js";

const mockCreate = vi.mocked(notion.pages.create);
const mockAppend = vi.mocked(notion.blocks.children.append);

describe("notion-create-pages handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a page under a page_id parent", async () => {
    const mockPage = { id: "new-page-1", object: "page" };
    mockCreate.mockResolvedValue(mockPage as any);

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [{ properties: { title: [{ type: "text", text: { content: "My Task" } }] } }],
    });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "parent-1" },
      properties: { title: [{ type: "text", text: { content: "My Task" } }] },
      icon: undefined,
      cover: undefined,
    });
    expect(mockAppend).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual([mockPage]);
  });

  it("appends content blocks when content is provided", async () => {
    const mockPage = { id: "new-page-2", object: "page" };
    mockCreate.mockResolvedValue(mockPage as any);
    mockAppend.mockResolvedValue({} as any);

    await handler({
      parent: { type: "database_id", database_id: "db-1" },
      pages: [
        {
          properties: { title: [{ type: "text", text: { content: "Task" } }] },
          content: "First paragraph\n\nSecond paragraph",
        },
      ],
    });

    expect(mockAppend).toHaveBeenCalledWith({
      block_id: "new-page-2",
      children: expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
      ]),
    });
  });

  it("creates multiple pages and returns all results", async () => {
    mockCreate
      .mockResolvedValueOnce({ id: "p1", object: "page" } as any)
      .mockResolvedValueOnce({ id: "p2", object: "page" } as any);

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [
        { properties: { title: [] } },
        { properties: { title: [] } },
      ],
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
  });

  it("returns isError on Notion API failure", async () => {
    mockCreate.mockRejectedValue(new Error("validation error"));

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [{ properties: {} }],
    });

    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/create-pages.test.ts
```

Expected: FAIL with "Cannot find module './create-pages.js'"

- [ ] **Step 3: Create `src/tools/create-pages.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { textToBlocks, toolResult, toolError } from "./utils.js";

const parentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page_id"), page_id: z.string() }),
  z.object({ type: z.literal("database_id"), database_id: z.string() }),
]);

const pageInputSchema = z.object({
  properties: z.record(z.unknown()).describe(
    "Page properties in Notion API format. For a title: { title: [{ type: 'text', text: { content: 'My Title' } }] }"
  ),
  content: z.string().optional().describe("Plain text content — split on double newlines into paragraph blocks"),
  icon: z.string().optional().describe("Emoji (e.g. '🚀') or external image URL"),
  cover: z.string().optional().describe("External image URL for the page cover"),
});

export const inputSchema = {
  parent: parentSchema.describe("Parent page or database to create pages under"),
  pages: z.array(pageInputSchema).min(1).max(100),
};

type PageInput = z.infer<typeof pageInputSchema>;
type Parent = z.infer<typeof parentSchema>;

export async function handler(args: {
  parent: Parent;
  pages: PageInput[];
}) {
  try {
    const notionParent =
      args.parent.type === "page_id"
        ? { page_id: args.parent.page_id }
        : { database_id: args.parent.database_id };

    const results = await Promise.all(
      args.pages.map(async (p) => {
        const page = await notion.pages.create({
          parent: notionParent as any,
          properties: p.properties as any,
          icon: p.icon
            ? { type: "emoji" as const, emoji: p.icon as any }
            : undefined,
          cover: p.cover
            ? { type: "external" as const, external: { url: p.cover } }
            : undefined,
        });

        if (p.content) {
          await notion.blocks.children.append({
            block_id: page.id,
            children: textToBlocks(p.content) as any,
          });
        }

        return page;
      })
    );

    return toolResult(results);
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/create-pages.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/create-pages.ts src/tools/create-pages.test.ts
git commit -m "feat: add notion-create-pages tool"
```

---

### Task 6: notion-update-page tool

**Files:**
- Create: `src/tools/update-page.ts`
- Test: `src/tools/update-page.test.ts`

Supports two commands:
- `update_properties`: update page properties via `notion.pages.update`
- `append_content`: append plain text as paragraph blocks via `notion.blocks.children.append`

- [ ] **Step 1: Write the failing test**

Create `src/tools/update-page.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    pages: { update: vi.fn() },
    blocks: { children: { append: vi.fn() } },
  },
}));

import { handler } from "./update-page.js";
import { notion } from "../client.js";

const mockUpdate = vi.mocked(notion.pages.update);
const mockAppend = vi.mocked(notion.blocks.children.append);

describe("notion-update-page handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls pages.update with properties on update_properties command", async () => {
    const mockPage = { id: "page-1", object: "page" };
    mockUpdate.mockResolvedValue(mockPage as any);

    const result = await handler({
      page_id: "page-1",
      command: "update_properties",
      properties: { Status: { select: { name: "Done" } } },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { Status: { select: { name: "Done" } } },
    });
    expect(mockAppend).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockPage);
  });

  it("calls blocks.children.append on append_content command", async () => {
    mockAppend.mockResolvedValue({ results: [] } as any);

    const result = await handler({
      page_id: "page-1",
      command: "append_content",
      content: "New note\n\nSecond paragraph",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAppend).toHaveBeenCalledWith({
      block_id: "page-1",
      children: expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
      ]),
    });
    expect(result.isError).toBeUndefined();
  });

  it("returns isError when update_properties is called without properties", async () => {
    const result = await handler({
      page_id: "page-1",
      command: "update_properties",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("properties");
  });

  it("returns isError when append_content is called without content", async () => {
    const result = await handler({
      page_id: "page-1",
      command: "append_content",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("content");
  });

  it("returns isError on Notion API failure", async () => {
    mockUpdate.mockRejectedValue(new Error("page not found"));

    const result = await handler({
      page_id: "bad-id",
      command: "update_properties",
      properties: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("page not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/update-page.test.ts
```

Expected: FAIL with "Cannot find module './update-page.js'"

- [ ] **Step 3: Create `src/tools/update-page.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { textToBlocks, toolResult, toolError } from "./utils.js";

export const inputSchema = {
  page_id: z.string().describe("ID of the page to update"),
  command: z.enum(["update_properties", "append_content"]).describe(
    "update_properties: set page properties. append_content: add text blocks to end of page."
  ),
  properties: z.record(z.unknown()).optional().describe(
    "Required for update_properties. Notion API property format, e.g. { Status: { select: { name: 'Done' } } }"
  ),
  content: z.string().optional().describe(
    "Required for append_content. Plain text — split on double newlines into paragraph blocks."
  ),
};

export async function handler(args: {
  page_id: string;
  command: "update_properties" | "append_content";
  properties?: Record<string, unknown>;
  content?: string;
}) {
  try {
    if (args.command === "update_properties") {
      if (!args.properties) {
        return toolError(new Error("properties is required for update_properties command"));
      }
      const page = await notion.pages.update({
        page_id: args.page_id,
        properties: args.properties as any,
      });
      return toolResult(page);
    }

    if (args.command === "append_content") {
      if (!args.content) {
        return toolError(new Error("content is required for append_content command"));
      }
      const result = await notion.blocks.children.append({
        block_id: args.page_id,
        children: textToBlocks(args.content) as any,
      });
      return toolResult(result);
    }

    return toolError(new Error(`Unknown command: ${args.command}`));
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/update-page.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/update-page.ts src/tools/update-page.test.ts
git commit -m "feat: add notion-update-page tool"
```

---

### Task 7: notion-get-users tool

**Files:**
- Create: `src/tools/get-users.ts`
- Test: `src/tools/get-users.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/get-users.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    users: { list: vi.fn() },
  },
}));

import { handler } from "./get-users.js";
import { notion } from "../client.js";

const mockList = vi.mocked(notion.users.list);

describe("notion-get-users handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls users.list and returns results", async () => {
    const mockResponse = {
      results: [{ id: "user-1", name: "Alice", object: "user" }],
      has_more: false,
    };
    mockList.mockResolvedValue(mockResponse as any);

    const result = await handler({});

    expect(mockList).toHaveBeenCalledWith({ page_size: 100, start_cursor: undefined });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockResponse);
  });

  it("passes start_cursor for pagination", async () => {
    mockList.mockResolvedValue({ results: [], has_more: false } as any);

    await handler({ start_cursor: "cursor-abc", page_size: 50 });

    expect(mockList).toHaveBeenCalledWith({ page_size: 50, start_cursor: "cursor-abc" });
  });

  it("returns isError on Notion API failure", async () => {
    mockList.mockRejectedValue(new Error("unauthorized"));

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unauthorized");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/get-users.test.ts
```

Expected: FAIL with "Cannot find module './get-users.js'"

- [ ] **Step 3: Create `src/tools/get-users.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { toolResult, toolError } from "./utils.js";

export const inputSchema = {
  page_size: z.number().int().min(1).max(100).optional().default(100).describe("Number of users to return"),
  start_cursor: z.string().optional().describe("Pagination cursor from a previous response"),
};

export async function handler(args: {
  page_size?: number;
  start_cursor?: string;
}) {
  try {
    const response = await notion.users.list({
      page_size: args.page_size ?? 100,
      start_cursor: args.start_cursor,
    });
    return toolResult(response);
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/get-users.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-users.ts src/tools/get-users.test.ts
git commit -m "feat: add notion-get-users tool"
```

---

### Task 8: notion-get-comments tool

**Files:**
- Create: `src/tools/get-comments.ts`
- Test: `src/tools/get-comments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/get-comments.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    comments: { list: vi.fn() },
  },
}));

import { handler } from "./get-comments.js";
import { notion } from "../client.js";

const mockList = vi.mocked(notion.comments.list);

describe("notion-get-comments handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls comments.list with block_id and returns results", async () => {
    const mockResponse = {
      results: [{ id: "comment-1", object: "comment" }],
      has_more: false,
    };
    mockList.mockResolvedValue(mockResponse as any);

    const result = await handler({ page_id: "page-1" });

    expect(mockList).toHaveBeenCalledWith({ block_id: "page-1", page_size: 100 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockResponse);
  });

  it("returns isError on Notion API failure", async () => {
    mockList.mockRejectedValue(new Error("not found"));

    const result = await handler({ page_id: "bad-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/get-comments.test.ts
```

Expected: FAIL with "Cannot find module './get-comments.js'"

- [ ] **Step 3: Create `src/tools/get-comments.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { extractId, toolResult, toolError } from "./utils.js";

export const inputSchema = {
  page_id: z.string().describe("Page ID or Notion URL to retrieve comments from"),
};

export async function handler(args: { page_id: string }) {
  try {
    const response = await notion.comments.list({
      block_id: extractId(args.page_id),
      page_size: 100,
    });
    return toolResult(response);
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/get-comments.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-comments.ts src/tools/get-comments.test.ts
git commit -m "feat: add notion-get-comments tool"
```

---

### Task 9: notion-create-comment tool

**Files:**
- Create: `src/tools/create-comment.ts`
- Test: `src/tools/create-comment.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tools/create-comment.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    comments: { create: vi.fn() },
  },
}));

import { handler } from "./create-comment.js";
import { notion } from "../client.js";

const mockCreate = vi.mocked(notion.comments.create);

describe("notion-create-comment handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a page-level comment", async () => {
    const mockComment = { id: "comment-1", object: "comment" };
    mockCreate.mockResolvedValue(mockComment as any);

    const result = await handler({ page_id: "page-1", text: "Looks good!" });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "page-1" },
      rich_text: [{ type: "text", text: { content: "Looks good!" } }],
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockComment);
  });

  it("includes discussion_id when replying to a thread", async () => {
    mockCreate.mockResolvedValue({ id: "comment-2", object: "comment" } as any);

    await handler({
      page_id: "page-1",
      text: "Agreed",
      discussion_id: "discussion-abc",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "page-1" },
      rich_text: [{ type: "text", text: { content: "Agreed" } }],
      discussion_id: "discussion-abc",
    });
  });

  it("returns isError on Notion API failure", async () => {
    mockCreate.mockRejectedValue(new Error("forbidden"));

    const result = await handler({ page_id: "page-1", text: "Hi" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("forbidden");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tools/create-comment.test.ts
```

Expected: FAIL with "Cannot find module './create-comment.js'"

- [ ] **Step 3: Create `src/tools/create-comment.ts`**

```typescript
import { z } from "zod";
import { notion } from "../client.js";
import { toolResult, toolError } from "./utils.js";

export const inputSchema = {
  page_id: z.string().describe("ID of the page to comment on"),
  text: z.string().min(1).describe("Comment text content"),
  discussion_id: z.string().optional().describe("Discussion ID to reply to an existing thread"),
};

export async function handler(args: {
  page_id: string;
  text: string;
  discussion_id?: string;
}) {
  try {
    const comment = await notion.comments.create({
      parent: { page_id: args.page_id },
      rich_text: [{ type: "text", text: { content: args.text } }],
      ...(args.discussion_id ? { discussion_id: args.discussion_id } : {}),
    } as any);
    return toolResult(comment);
  } catch (error) {
    return toolError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tools/create-comment.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/create-comment.ts src/tools/create-comment.test.ts
git commit -m "feat: add notion-create-comment tool"
```

---

### Task 10: Server entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Run the full test suite to confirm all tools pass before wiring**

```bash
npm test
```

Expected: All tests pass (no failures). If any test fails, fix it before continuing.

- [ ] **Step 2: Create `src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { inputSchema as searchSchema, handler as searchHandler } from "./tools/search.js";
import { inputSchema as fetchSchema, handler as fetchHandler } from "./tools/fetch.js";
import { inputSchema as createPagesSchema, handler as createPagesHandler } from "./tools/create-pages.js";
import { inputSchema as updatePageSchema, handler as updatePageHandler } from "./tools/update-page.js";
import { inputSchema as getUsersSchema, handler as getUsersHandler } from "./tools/get-users.js";
import { inputSchema as getCommentsSchema, handler as getCommentsHandler } from "./tools/get-comments.js";
import { inputSchema as createCommentSchema, handler as createCommentHandler } from "./tools/create-comment.js";

const server = new McpServer({
  name: "agentic-notion",
  version: "1.0.0",
});

server.tool(
  "notion-search",
  "Search pages and databases in the Notion workspace",
  searchSchema,
  searchHandler
);

server.tool(
  "notion-fetch",
  "Fetch full content of a Notion page or database by ID or URL",
  fetchSchema,
  fetchHandler
);

server.tool(
  "notion-create-pages",
  "Create one or more pages in a Notion page or database",
  createPagesSchema,
  createPagesHandler
);

server.tool(
  "notion-update-page",
  "Update a Notion page's properties or append content blocks. Commands: update_properties | append_content",
  updatePageSchema,
  updatePageHandler
);

server.tool(
  "notion-get-users",
  "List users in the Notion workspace",
  getUsersSchema,
  getUsersHandler
);

server.tool(
  "notion-get-comments",
  "Retrieve comments on a Notion page",
  getCommentsSchema,
  getCommentsHandler
);

server.tool(
  "notion-create-comment",
  "Add a comment to a Notion page, optionally replying to an existing discussion thread",
  createCommentSchema,
  createCommentHandler
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire all tools into MCP server entry point"
```

---

### Task 11: Build and verify

**Files:**
- No new files — build verification only

- [ ] **Step 1: Build the TypeScript project**

```bash
npm run build
```

Expected: `dist/` directory created with `index.js` and all tool files. No TypeScript errors.

If errors appear, fix them before continuing. Common issues:
- Missing `.js` extension in an import → add it
- Type mismatch with `@notionhq/client` → add `as any` cast on the offending argument

- [ ] **Step 2: Make the binary executable**

```bash
chmod +x dist/index.js
```

- [ ] **Step 3: Smoke test — verify server starts and exits cleanly on missing token**

```bash
node dist/index.js
```

Expected output: `NOTION_API_KEY env var is required` then process exits with non-zero code.

- [ ] **Step 4: Smoke test — verify server starts with a dummy token**

```bash
NOTION_API_KEY=secret_dummy node dist/index.js &
SERVER_PID=$!
sleep 1
kill $SERVER_PID 2>/dev/null
echo "Server started OK"
```

Expected: Server starts (no crash on startup), gets killed cleanly.

- [ ] **Step 5: Commit**

```bash
git add dist/ .gitignore
git commit -m "build: add compiled dist for initial release"
```

Note: Normally `dist/` is gitignored for libraries, but for a CLI tool published to npm it's conventional to commit the build or ensure `prepublishOnly` runs. The `files` field in `package.json` already limits what gets published to `dist/`.

---

### Task 12: Claude MCP config template

**Files:**
- Create: `mcp-config.example.json`

- [ ] **Step 1: Create the config template**

Create `mcp-config.example.json`:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["agentic-notion"],
      "env": {
        "NOTION_API_KEY": "secret_REPLACE_WITH_YOUR_TOKEN"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-config.example.json
git commit -m "docs: add MCP config template for teammates"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Standalone NPM package at repo root → Task 1
- ✅ `@modelcontextprotocol/sdk` as MCP base → Task 10
- ✅ `NOTION_API_KEY` env var per teammate → Task 2 (client.ts)
- ✅ Fails fast with clear message on missing token → Task 2 (client.ts)
- ✅ `notion-search` → Task 3
- ✅ `notion-fetch` → Task 4
- ✅ `notion-create-pages` → Task 5
- ✅ `notion-update-page` → Task 6
- ✅ `notion-get-users` → Task 7
- ✅ `notion-get-comments` → Task 8
- ✅ `notion-create-comment` → Task 9
- ✅ stdio transport → Task 10
- ✅ Zod validation → all tool tasks
- ✅ Errors surface as MCP tool errors (not crashes) → all tool tasks via `toolError`
- ✅ MCP config template → Task 12

**Type consistency check:**
- `toolResult` / `toolError` / `extractId` / `textToBlocks` defined in Task 2, used identically in Tasks 3–9 ✅
- `handler` and `inputSchema` are the export names used consistently in all tool files and imported the same way in Task 10 ✅
- `notion.pages`, `notion.blocks`, `notion.users`, `notion.comments` referenced the same way in mocks and implementations ✅
