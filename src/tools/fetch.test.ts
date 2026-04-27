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
