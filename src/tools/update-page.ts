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
