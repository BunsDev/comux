import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '../../theme/colors.js';

interface CreatingIndicatorProps {
  message?: string;
}

const CreatingIndicator: React.FC<CreatingIndicatorProps> = ({ message }) => {
  return (
    <Box borderStyle="single" borderColor={COLORS.accent} paddingX={1} marginTop={1}>
      <Text color={COLORS.accent}>
        <Text bold>⏳ Creating new pane... </Text>
        {message}
      </Text>
    </Box>
  );
};

export default CreatingIndicator;
