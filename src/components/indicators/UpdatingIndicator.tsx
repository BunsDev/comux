import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '../../theme/colors.js';

const UpdatingIndicator: React.FC = () => {
  return (
    <Box borderStyle="single" borderColor={COLORS.accent} paddingX={1} marginTop={1}>
      <Text color={COLORS.accent}>
        <Text bold>⬇ Updating comux...</Text>
      </Text>
    </Box>
  );
};

export default UpdatingIndicator;
