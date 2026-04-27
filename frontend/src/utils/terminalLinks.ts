export interface TerminalTextSegment {
  text: string;
  url?: string;
}

const TERMINAL_URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.;:!?\]}]+$/;

export function splitTerminalTextByUrl(text: string): TerminalTextSegment[] {
  const segments: TerminalTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TERMINAL_URL_PATTERN)) {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;
    const url = rawUrl.replace(TRAILING_URL_PUNCTUATION_PATTERN, '');

    if (!url) {
      continue;
    }

    const urlEnd = matchIndex + url.length;
    const rawEnd = matchIndex + rawUrl.length;

    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex) });
    }

    segments.push({ text: url, url });

    if (urlEnd < rawEnd) {
      segments.push({ text: text.slice(urlEnd, rawEnd) });
    }

    lastIndex = rawEnd;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ text }];
}
