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
