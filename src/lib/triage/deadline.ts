const relativeDeadlinePatterns = [
  { pattern: /\btomorrow(?:\s+(?:at|by)\s+([\d:]+\s*(?:am|pm)))?/i, label: "tomorrow" },
  { pattern: /\btoday(?:\s+(?:at|by|between)\s+([^.,]+))?/i, label: "today" },
  { pattern: /\bfriday(?:\s+(?:at|by)\s+([^.,]+))?/i, label: "Friday" },
  { pattern: /\bthursday(?:\s+(?:at|by)\s+([^.,]+))?/i, label: "Thursday" },
  { pattern: /\bsaturday(?:\s+(?:at|by)\s+([^.,]+))?/i, label: "Saturday" },
];

const absoluteDeadlinePattern =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:\s+at\s+[\d:]+\s*(?:am|pm))?/i;

export function detectDeadline(text: string): string | null {
  for (const item of relativeDeadlinePatterns) {
    const match = text.match(item.pattern);

    if (match) {
      return match[1] ? `${item.label} ${match[1].trim()}` : item.label;
    }
  }

  const absolute = text.match(absoluteDeadlinePattern);
  return absolute ? titleCase(absolute[0]) : null;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
