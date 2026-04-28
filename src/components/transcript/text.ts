export const BULLET_LIST_LINE_REGEX = /^[-*•]\s+/;
export const MARKDOWN_TABLE_LINE_REGEX = /^\|.*\|\s*$/;
export const PIPE_SEPARATED_ROW_LINE_REGEX = /^(?:\|?\s*[^|]+\s*\|){2,}\s*[^|]+\|?\s*$/;

export function splitParagraphs(text: string) {
  const byBlankLine = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) {
    return byBlankLine;
  }

  return text
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function stripRedundantStructuredListText(text: string) {
  const sanitized = text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmedLine = line.trim();
      return (
        !BULLET_LIST_LINE_REGEX.test(trimmedLine) &&
        !MARKDOWN_TABLE_LINE_REGEX.test(trimmedLine) &&
        !PIPE_SEPARATED_ROW_LINE_REGEX.test(trimmedLine)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return sanitized;
}

export const FOLLOW_UP_LINE_START_REGEX =
  /^(which|what|would|do|does|did|is|are|can|could|shall|should|let me know|feel free|if you need|if you'd like|i will|next|please let me know)\b/i;
export const FOLLOW_UP_LINE_CONTAINS_REGEX =
  /\b(let me know|if you need|if you'd like|anything else|next page|would you like|please specify)\b/i;

export function isLikelyFollowUpParagraph(paragraph: string) {
  const normalizedParagraph = paragraph.trim();

  if (normalizedParagraph.length === 0) {
    return false;
  }

  return (
    normalizedParagraph.endsWith("?") ||
    FOLLOW_UP_LINE_START_REGEX.test(normalizedParagraph) ||
    FOLLOW_UP_LINE_CONTAINS_REGEX.test(normalizedParagraph)
  );
}

export const TABLE_LEAD_IN_PARAGRAPH_REGEX =
  /\b(here\s+(?:is|are)|i\s+(?:found|pulled|listed)|below|following)\b/i;
export const TABLE_POST_NOTE_PARAGRAPH_REGEX =
  /\b(please\s+review|take\s+(?:appropriate|any\s+necessary)\s+action|let\s+me\s+know|if\s+you\s+need|if\s+you'?d\s+like|anything\s+else|next\s+step)\b/i;

export function isLikelyTableLeadInParagraph(paragraph: string) {
  const normalized = paragraph.trim();
  if (!normalized) return false;

  return (
    normalized.endsWith(":") ||
    TABLE_LEAD_IN_PARAGRAPH_REGEX.test(normalized)
  );
}

export function isLikelyPostTableParagraph(paragraph: string) {
  const normalized = paragraph.trim();
  if (!normalized) return false;

  return (
    isLikelyFollowUpParagraph(normalized) ||
    TABLE_POST_NOTE_PARAGRAPH_REGEX.test(normalized)
  );
}

export type TableTextPlacement = {
  beforeTables: string;
  afterTables: string | null;
};

// Removes paragraphs that look like table lead-ins from text that appears
// after tables — they are orphaned because no table follows them in the UI.
function dropOrphanedLeadIns(text: string): string | null {
  const filtered = splitParagraphs(text).filter(
    (p) => !TABLE_LEAD_IN_PARAGRAPH_REGEX.test(p.trim()),
  );
  const result = filtered.join("\n\n").trim();
  return result || null;
}

export function splitTextBeforeAndAfterTables(text: string): TableTextPlacement {
  if (!text.trim()) {
    return { beforeTables: "", afterTables: null };
  }

  const paragraphs = splitParagraphs(text);

  if (paragraphs.length < 2) {
    return { beforeTables: text, afterTables: null };
  }

  const [firstParagraph, ...remainingParagraphs] = paragraphs;
  const shouldPlaceAfterFirstParagraph =
    isLikelyTableLeadInParagraph(firstParagraph) &&
    remainingParagraphs.some((paragraph) =>
      isLikelyPostTableParagraph(paragraph),
    );

  if (shouldPlaceAfterFirstParagraph) {
    return {
      beforeTables: firstParagraph,
      afterTables: dropOrphanedLeadIns(remainingParagraphs.join("\n\n")),
    };
  }

  // Find the last table lead-in paragraph anywhere (handles lead-ins that are
  // not the first paragraph, e.g. when preceded by a mutation confirmation).
  let lastLeadInIndex = -1;
  for (let i = 0; i < paragraphs.length - 1; i++) {
    if (isLikelyTableLeadInParagraph(paragraphs[i])) {
      lastLeadInIndex = i;
    }
  }

  if (lastLeadInIndex >= 0) {
    const afterText = paragraphs.slice(lastLeadInIndex + 1).join("\n\n");
    return {
      beforeTables: paragraphs.slice(0, lastLeadInIndex + 1).join("\n\n"),
      afterTables: dropOrphanedLeadIns(afterText),
    };
  }

  const trailingFollowUpParagraphs: string[] = [];
  const leadingParagraphs = [...paragraphs];

  while (leadingParagraphs.length > 1) {
    const candidate = leadingParagraphs.at(-1);

    if (!candidate || !isLikelyFollowUpParagraph(candidate)) {
      break;
    }

    trailingFollowUpParagraphs.unshift(candidate);
    leadingParagraphs.pop();
  }

  if (trailingFollowUpParagraphs.length === 0) {
    return { beforeTables: text, afterTables: null };
  }

  return {
    beforeTables: leadingParagraphs.join("\n\n"),
    afterTables: trailingFollowUpParagraphs.join("\n\n"),
  };
}

export function shouldUseTableLeadInLayout(tableIds: string[]) {
  const idSet = new Set(tableIds);

  const hasBalancePair =
    idSet.has("my-time-off-balance") && idSet.has("my-upcoming-requests");
  const hasUpdatedBalancePair =
    idSet.has("updated-time-off-balance") &&
    idSet.has("updated-upcoming-requests");

  return hasBalancePair || hasUpdatedBalancePair;
}

export function getTableLeadInText(tableId: string, tableIds: string[]): string | null {
  const idSet = new Set(tableIds);

  const hasBalancePair =
    idSet.has("my-time-off-balance") && idSet.has("my-upcoming-requests");

  if (hasBalancePair) {
    if (tableId === "my-time-off-balance") {
      return "You have the following remaining leave days:";
    }

    if (tableId === "my-upcoming-requests") {
      return "Here is your upcoming request:";
    }
  }

  const hasUpdatedBalancePair =
    idSet.has("updated-time-off-balance") &&
    idSet.has("updated-upcoming-requests");

  if (hasUpdatedBalancePair) {
    if (tableId === "updated-time-off-balance") {
      return "Your remaining leave days are now:";
    }

    if (tableId === "updated-upcoming-requests") {
      return "Here is your upcoming request:";
    }
  }

  return null;
}

export function normalizeComparableLine(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[:.]\s*$/g, "");
}

export function getRenderedTableLeadIns(tableIds: string[]) {
  return tableIds
    .map((tableId) => getTableLeadInText(tableId, tableIds))
    .filter((line): line is string => Boolean(line));
}

export function extractTableLeadInFollowUp(text: string, renderedLeadIns: string[]) {
  if (!text.trim()) return null;

  const suppressedLines = new Set(renderedLeadIns.map(normalizeComparableLine));

  const remainingLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !suppressedLines.has(normalizeComparableLine(line)),
    );

  const nonLeadInLines = remainingLines.filter(
    (line) => !line.endsWith(":") && !TABLE_LEAD_IN_PARAGRAPH_REGEX.test(line),
  );
  return nonLeadInLines.at(-1) ?? null;
}
