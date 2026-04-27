import React from 'react';
import { Box, Text } from 'ink';
import type { Toast } from '../../services/ToastService.js';
import { COLORS } from '../../theme/colors.js';

interface ToastNotificationProps {
  toast: Toast;
  queuePosition?: number | null;
  totalInQueue?: number;
}

const SEVERITY_CONFIG = {
  success: { icon: '✓', color: COLORS.success },
  error: { icon: '✗', color: COLORS.error },
  warning: { icon: '⚠', color: COLORS.warning },
  info: { icon: 'ℹ', color: COLORS.info },
} as const;

/**
 * ToastNotification - Displays a toast message with severity styling
 */
const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  queuePosition,
  totalInQueue,
}) => {
  const config = SEVERITY_CONFIG[toast.severity];

  return (
    <Box>
      <Text>
        <Text color={config.color} bold>
          {config.icon}{' '}
        </Text>
        <Text color={config.color}>{toast.message}</Text>
      </Text>
    </Box>
  );
};

export default ToastNotification;
