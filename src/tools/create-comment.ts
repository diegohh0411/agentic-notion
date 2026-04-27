import { z } from "zod";
import { notion } from "../client.js";
import { toolResult, toolError } from "./utils.js";

export const inputSchema = {
  page_id: z.string().describe("ID of the page to comment on"),
  text: z.string().min(1).describe("Comment text content"),
  discussion_id: z
    .string()
    .optional()
    .describe("Discussion ID to reply to an existing thread"),
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
