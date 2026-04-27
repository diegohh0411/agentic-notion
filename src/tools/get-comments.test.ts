import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    comments: { list: vi.fn() },
  },
}));

import { handler } from "./get-comments.js";
import { notion } from "../client.js";

const mockList = vi.mocked(notion.comments.list);

describe("notion-get-comments handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls comments.list with block_id and returns results", async () => {
    const mockResponse = {
      results: [{ id: "comment-1", object: "comment" }],
      has_more: false,
    };
    mockList.mockResolvedValue(mockResponse as any);

    const result = await handler({ page_id: "page-1" });

    expect(mockList).toHaveBeenCalledWith({ block_id: "page-1", page_size: 100 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockResponse);
  });

  it("returns isError on Notion API failure", async () => {
    mockList.mockRejectedValue(new Error("not found"));

    const result = await handler({ page_id: "bad-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
