import { emailTextToParagraphs } from "@/lib/email/clean-email-text";
import { cn } from "@/lib/utils";

type ThreadMessageBlock = {
  id: string;
  kind: "latest" | "earlier";
  sender: string;
  timestamp: string;
  paragraphs: string[];
};

type ThreadBodyViewProps = {
  text: string;
  emptyText?: string;
  className?: string;
  maxHeightClassName?: string;
};

export function ThreadBodyView({
  text,
  emptyText = "No readable email body was available.",
  className,
  maxHeightClassName = "max-h-[360px]",
}: ThreadBodyViewProps) {
  const blocks = parseThreadMessageBlocks(text);

  return (
    <div
      className={cn(
        "overflow-auto rounded-lg bg-[#f1f0ea] p-4 text-sm leading-7 text-[#25332f]",
        maxHeightClassName,
        className,
      )}
    >
      {blocks.length > 0 ? (
        <div className="space-y-5">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={cn(
                "space-y-2",
                block.kind === "earlier" && "text-[#6c5485]",
              )}
            >
              {block.paragraphs.map((paragraph, index) => (
                <p key={`${block.id}-${index}-${paragraph.slice(0, 18)}`}>
                  {block.kind === "earlier" && index === 0
                    ? `On ${block.timestamp}, ${block.sender}: ${paragraph}`
                    : paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function parseThreadMessageBlocks(text: string): ThreadMessageBlock[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const markerMatches = [...cleaned.matchAll(/\b(?:Latest message|Earlier message) from\b/g)];
  if (markerMatches.length > 0) {
    return markerMatches
      .map((match, index) => {
        const start = match.index ?? 0;
        const end = markerMatches[index + 1]?.index ?? cleaned.length;
        return parseMarkedThreadBlock(cleaned.slice(start, end), index);
      })
      .filter(
        (block): block is ThreadMessageBlock =>
          Boolean(block && block.paragraphs.length > 0),
      );
  }

  const fallbackBlocks: ThreadMessageBlock[] = [
    {
      id: "single-message",
      kind: "latest",
      sender: "",
      timestamp: "",
      paragraphs: emailTextToParagraphs(cleaned, 18),
    },
  ];

  return fallbackBlocks.filter((block) => block.paragraphs.length > 0);
}

function parseMarkedThreadBlock(block: string, index: number): ThreadMessageBlock | null {
  const normalized = block.replace(/\n{2,}---\n{2,}/g, "\n").trim();
  const kind = normalized.startsWith("Earlier message") ? "earlier" : "latest";
  const headingMatch = normalized.match(
    /^(Latest message|Earlier message) from\s+(.+?)\s+on\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{1,2}:\d{2}\s+[AP]M)\s*/i,
  );
  const body = headingMatch
    ? normalized.slice(headingMatch[0].length).trim()
    : normalized.replace(/^(Latest message|Earlier message) from\s+/i, "").trim();

  return {
    id: `${kind}-${index}`,
    kind,
    sender: headingMatch?.[2]?.trim() || "sender",
    timestamp: headingMatch?.[3]?.trim() || "earlier",
    paragraphs: emailTextToParagraphs(stripEmbeddedQuotedThreadTail(body), 10),
  };
}

function stripEmbeddedQuotedThreadTail(value: string) {
  return value
    .replace(
      /\s+(?:On\s+)?(?:[A-Z][a-z]{2},\s+)?[A-Z][a-z]{2}\s+\d{1,2},(?:\s+\d{4})?,?\s+(?:at\s+)?\d{1,2}:\d{2}(?:\s|\u202f)?[AP]M\b[\s\S]*$/i,
      "",
    )
    .trim();
}
