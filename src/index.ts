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
