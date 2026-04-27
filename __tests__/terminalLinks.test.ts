import { describe, expect, it } from 'vitest';
import { splitTerminalTextByUrl } from '../frontend/src/utils/terminalLinks';

describe('terminal link detection', () => {
  it('splits terminal text into plain and URL segments', () => {
    expect(splitTerminalTextByUrl('Open https://example.com/path now')).toEqual([
      { text: 'Open ' },
      { text: 'https://example.com/path', url: 'https://example.com/path' },
      { text: ' now' },
    ]);
  });

  it('keeps trailing sentence punctuation out of the URL', () => {
    expect(splitTerminalTextByUrl('Visit https://example.com/docs.')).toEqual([
      { text: 'Visit ' },
      { text: 'https://example.com/docs', url: 'https://example.com/docs' },
      { text: '.' },
    ]);
  });

  it('detects multiple http and https URLs', () => {
    expect(splitTerminalTextByUrl('A http://localhost:3000 B https://example.dev')).toEqual([
      { text: 'A ' },
      { text: 'http://localhost:3000', url: 'http://localhost:3000' },
      { text: ' B ' },
      { text: 'https://example.dev', url: 'https://example.dev' },
    ]);
  });

  it('returns one plain segment when there are no URLs', () => {
    expect(splitTerminalTextByUrl('nothing to open')).toEqual([{ text: 'nothing to open' }]);
  });
});
