export function extractId(input: string): string {
  if (input.startsWith("http")) {
    const hexMatch = input.match(/([0-9a-f]{32})(?:[?#/]|$)/i);
    if (hexMatch) return hexMatch[1];
    const uuidMatch = input.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#/]|$)/i
    );
    if (uuidMatch) return uuidMatch[1];
  }
  return input;
}

export function textToBlocks(content: string) {
  return content
    .split(/\n\n+/)
    .filter(Boolean)
    .map((para) => ({
      type: "paragraph" as const,
      paragraph: {
        rich_text: [{ type: "text" as const, text: { content: para } }],
      },
    }));
}

export function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Notion API error: ${message}` }],
    isError: true as const,
  };
}
