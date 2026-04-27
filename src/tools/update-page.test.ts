import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    pages: { update: vi.fn() },
    blocks: { children: { append: vi.fn() } },
  },
}));

import { handler } from "./update-page.js";
import { notion } from "../client.js";

const mockUpdate = vi.mocked(notion.pages.update);
const mockAppend = vi.mocked(notion.blocks.children.append);

describe("notion-update-page handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls pages.update with properties on update_properties command", async () => {
    const mockPage = { id: "page-1", object: "page" };
    mockUpdate.mockResolvedValue(mockPage as any);

    const result = await handler({
      page_id: "page-1",
      command: "update_properties",
      properties: { Status: { select: { name: "Done" } } },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { Status: { select: { name: "Done" } } },
    });
    expect(mockAppend).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockPage);
  });

  it("calls blocks.children.append on append_content command", async () => {
    mockAppend.mockResolvedValue({ results: [] } as any);

    const result = await handler({
      page_id: "page-1",
      command: "append_content",
      content: "New note\n\nSecond paragraph",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAppend).toHaveBeenCalledWith({
      block_id: "page-1",
      children: expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
      ]),
    });
    expect(result.isError).toBeUndefined();
  });

  it("returns isError when update_properties is called without properties", async () => {
    const result = await handler({
      page_id: "page-1",
      command: "update_properties",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("properties");
  });

  it("returns isError when append_content is called without content", async () => {
    const result = await handler({
      page_id: "page-1",
      command: "append_content",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("content");
  });

  it("returns isError on Notion API failure", async () => {
    mockUpdate.mockRejectedValue(new Error("page not found"));

    const result = await handler({
      page_id: "bad-id",
      command: "update_properties",
      properties: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("page not found");
  });
});
