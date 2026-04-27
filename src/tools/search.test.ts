import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: { search: vi.fn() },
}));

import { handler } from "./search.js";
import { notion } from "../client.js";

const mockSearch = vi.mocked(notion.search);

describe("notion-search handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls notion.search with query and returns JSON", async () => {
    const mockResponse = { results: [{ id: "page-1", object: "page" }], has_more: false };
    mockSearch.mockResolvedValue(mockResponse as any);

    const result = await handler({ query: "sprint tasks", page_size: 10 });

    expect(mockSearch).toHaveBeenCalledWith({
      query: "sprint tasks",
      page_size: 10,
      filter: undefined,
      start_cursor: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  it("passes object filter when provided", async () => {
    mockSearch.mockResolvedValue({ results: [] } as any);

    await handler({ query: "tasks", filter: "page", page_size: 10 });

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { property: "object", value: "page" },
      })
    );
  });

  it("returns isError on Notion API failure", async () => {
    mockSearch.mockRejectedValue(new Error("rate limited"));

    const result = await handler({ query: "x", page_size: 10 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rate limited");
  });
});
