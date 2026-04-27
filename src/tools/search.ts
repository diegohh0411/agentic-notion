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
