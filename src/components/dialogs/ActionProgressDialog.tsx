/**
 * Action Progress Dialog
 *
 * Renders a progress/loading indicator from the action system
 */

import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '../../theme/colors.js';

interface ActionProgressDialogProps {
  message: string;
  percent?: number;
}

const ActionProgressDialog: React.FC<ActionProgressDialogProps> = ({
  message,
  percent
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={COLORS.accent}
      paddingX={1}
      marginTop={1}
    >
      <Box marginBottom={1}>
        <Text bold color={COLORS.accent}>⏳ {message}</Text>
      </Box>

      {percent !== undefined && (
        <Box marginBottom={1}>
          <Text>{`Progress: ${Math.round(percent)}%`}</Text>
        </Box>
      )}

      <Box>
        <Text dimColor>Please wait...</Text>
      </Box>
    </Box>
  );
};

export default ActionProgressDialog;
