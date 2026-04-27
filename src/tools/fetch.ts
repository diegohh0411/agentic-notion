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
