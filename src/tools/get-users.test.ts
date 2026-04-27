import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    users: { list: vi.fn() },
  },
}));

import { handler } from "./get-users.js";
import { notion } from "../client.js";

const mockList = vi.mocked(notion.users.list);

describe("notion-get-users handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls users.list and returns results", async () => {
    const mockResponse = {
      results: [{ id: "user-1", name: "Alice", object: "user" }],
      has_more: false,
    };
    mockList.mockResolvedValue(mockResponse as any);

    const result = await handler({});

    expect(mockList).toHaveBeenCalledWith({ page_size: 100, start_cursor: undefined });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockResponse);
  });

  it("passes start_cursor for pagination", async () => {
    mockList.mockResolvedValue({ results: [], has_more: false } as any);

    await handler({ start_cursor: "cursor-abc", page_size: 50 });

    expect(mockList).toHaveBeenCalledWith({ page_size: 50, start_cursor: "cursor-abc" });
  });

  it("returns isError on Notion API failure", async () => {
    mockList.mockRejectedValue(new Error("unauthorized"));

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unauthorized");
  });
});
