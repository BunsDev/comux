import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import { COLORS } from '../../theme/colors.js';

interface InlineNameEditorProps {
  value: string;
  cursor: number;
  maxWidth: number;
  color?: string;
}

function clipToWidth(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (stringWidth(value) <= maxWidth) return value;

  let clipped = '';
  let width = 0;
  for (const char of value) {
    const charWidth = stringWidth(char);
    if (width + charWidth > maxWidth) {
      break;
    }
    clipped += char;
    width += charWidth;
  }
  return clipped;
}

function findVisibleStart(value: string, cursor: number, maxBeforeWidth: number): number {
  let start = 0;
  while (
    start < cursor
    && stringWidth(value.slice(start, cursor)) > maxBeforeWidth
  ) {
    start += 1;
  }
  return start;
}

const InlineNameEditor: React.FC<InlineNameEditorProps> = ({
  value,
  cursor,
  maxWidth,
  color = COLORS.accent,
}) => {
  const boundedCursor = Math.max(0, Math.min(cursor, value.length));
  const width = Math.max(1, maxWidth);
  const maxBeforeWidth = Math.max(0, width - 2);
  const start = findVisibleStart(value, boundedCursor, maxBeforeWidth);
  const prefix = start > 0 ? '…' : '';
  const before = `${prefix}${value.slice(start, boundedCursor)}`;
  const at = value[boundedCursor] || ' ';
  const afterWidth = Math.max(0, width - stringWidth(before) - stringWidth(at));
  const after = clipToWidth(value.slice(boundedCursor + 1), afterWidth);

  return (
    <>
      {before && <Text color={color} bold>{before}</Text>}
      <Text inverse color={color} bold>{at}</Text>
      {after && <Text color={color} bold>{after}</Text>}
    </>
  );
};

export default InlineNameEditor;
