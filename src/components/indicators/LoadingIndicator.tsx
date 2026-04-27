import React from 'react';
import { Text } from 'ink';
import Spinner from './Spinner.js';
import { COLORS } from '../../theme/colors.js';

const LoadingIndicator: React.FC = () => {
  return (
    <Text color={COLORS.muted}>
      <Spinner color={COLORS.muted} /> Loading panes
    </Text>
  );
};

export default LoadingIndicator;
