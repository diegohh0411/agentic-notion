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
