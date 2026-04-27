import { describe, it, expect } from "vitest";
import { extractId, textToBlocks, toolResult, toolError } from "./utils.js";

describe("extractId", () => {
  it("returns bare 32-char hex ID as-is", () => {
    expect(extractId("abc123def456abc123def456abc123de")).toBe(
      "abc123def456abc123def456abc123de"
    );
  });

  it("returns UUID with dashes as-is", () => {
    expect(extractId("abc123de-f456-abc1-23de-f456abc123de")).toBe(
      "abc123de-f456-abc1-23de-f456abc123de"
    );
  });

  it("extracts 32-char ID from a Notion URL", () => {
    expect(
      extractId("https://www.notion.so/workspace/My-Page-abc123def456abc123def456abc123de")
    ).toBe("abc123def456abc123def456abc123de");
  });

  it("extracts UUID from a Notion URL with query string", () => {
    expect(
      extractId(
        "https://www.notion.so/abc123de-f456-abc1-23de-f456abc123de?pvs=4"
      )
    ).toBe("abc123de-f456-abc1-23de-f456abc123de");
  });
});

describe("textToBlocks", () => {
  it("converts a single paragraph to one block", () => {
    const blocks = textToBlocks("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: "Hello world" } }] },
    });
  });

  it("splits on double newlines into multiple blocks", () => {
    const blocks = textToBlocks("First para\n\nSecond para");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].paragraph.rich_text[0].text.content).toBe("First para");
    expect(blocks[1].paragraph.rich_text[0].text.content).toBe("Second para");
  });

  it("ignores empty segments", () => {
    const blocks = textToBlocks("A\n\n\n\nB");
    expect(blocks).toHaveLength(2);
  });
});

describe("toolResult", () => {
  it("wraps data as JSON text content", () => {
    const result = toolResult({ id: "1" });
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(JSON.stringify({ id: "1" }, null, 2));
  });
});

describe("toolError", () => {
  it("returns isError true with message from Error", () => {
    const result = toolError(new Error("bad request"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("bad request");
  });

  it("handles non-Error throws", () => {
    const result = toolError("something broke");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("something broke");
  });
});
