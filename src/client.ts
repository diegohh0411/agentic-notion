import { Client } from "@notionhq/client";

if (!process.env.NOTION_API_KEY) {
  console.error("NOTION_API_KEY env var is required");
  process.exit(1);
}

export const notion = new Client({ auth: process.env.NOTION_API_KEY });
