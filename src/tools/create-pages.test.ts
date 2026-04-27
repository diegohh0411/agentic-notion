import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    pages: { create: vi.fn() },
    blocks: { children: { append: vi.fn() } },
  },
}));

import { handler } from "./create-pages.js";
import { notion } from "../client.js";

const mockCreate = vi.mocked(notion.pages.create);
const mockAppend = vi.mocked(notion.blocks.children.append);

describe("notion-create-pages handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a page under a page_id parent", async () => {
    const mockPage = { id: "new-page-1", object: "page" };
    mockCreate.mockResolvedValue(mockPage as any);

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [{ properties: { title: [{ type: "text", text: { content: "My Task" } }] } }],
    });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "parent-1" },
      properties: { title: [{ type: "text", text: { content: "My Task" } }] },
      icon: undefined,
      cover: undefined,
    });
    expect(mockAppend).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual([mockPage]);
  });

  it("appends content blocks when content is provided", async () => {
    const mockPage = { id: "new-page-2", object: "page" };
    mockCreate.mockResolvedValue(mockPage as any);
    mockAppend.mockResolvedValue({} as any);

    await handler({
      parent: { type: "database_id", database_id: "db-1" },
      pages: [
        {
          properties: { title: [{ type: "text", text: { content: "Task" } }] },
          content: "First paragraph\n\nSecond paragraph",
        },
      ],
    });

    expect(mockAppend).toHaveBeenCalledWith({
      block_id: "new-page-2",
      children: expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
      ]),
    });
  });

  it("creates multiple pages and returns all results", async () => {
    mockCreate
      .mockResolvedValueOnce({ id: "p1", object: "page" } as any)
      .mockResolvedValueOnce({ id: "p2", object: "page" } as any);

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [
        { properties: { title: [] } },
        { properties: { title: [] } },
      ],
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
  });

  it("returns isError on Notion API failure", async () => {
    mockCreate.mockRejectedValue(new Error("validation error"));

    const result = await handler({
      parent: { type: "page_id", page_id: "parent-1" },
      pages: [{ properties: {} }],
    });

    expect(result.isError).toBe(true);
  });
});
