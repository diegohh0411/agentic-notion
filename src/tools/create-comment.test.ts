import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  notion: {
    comments: { create: vi.fn() },
  },
}));

import { handler } from "./create-comment.js";
import { notion } from "../client.js";

const mockCreate = vi.mocked(notion.comments.create);

describe("notion-create-comment handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a page-level comment", async () => {
    const mockComment = { id: "comment-1", object: "comment" };
    mockCreate.mockResolvedValue(mockComment as any);

    const result = await handler({ page_id: "page-1", text: "Looks good!" });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "page-1" },
      rich_text: [{ type: "text", text: { content: "Looks good!" } }],
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(mockComment);
  });

  it("includes discussion_id when replying to a thread", async () => {
    mockCreate.mockResolvedValue({ id: "comment-2", object: "comment" } as any);

    await handler({
      page_id: "page-1",
      text: "Agreed",
      discussion_id: "discussion-abc",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      parent: { page_id: "page-1" },
      rich_text: [{ type: "text", text: { content: "Agreed" } }],
      discussion_id: "discussion-abc",
    });
  });

  it("returns isError on Notion API failure", async () => {
    mockCreate.mockRejectedValue(new Error("forbidden"));

    const result = await handler({ page_id: "page-1", text: "Hi" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("forbidden");
  });
});
