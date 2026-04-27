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
