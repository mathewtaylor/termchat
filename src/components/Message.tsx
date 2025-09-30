import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../types';

export interface MessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  theme?: Theme;
}

export const Message: React.FC<MessageProps> = ({ role, content, timestamp, theme }) => {
  let color = 'white';
  let label = '';

  if (role === 'user') {
    label = 'You';
    // Use theme color if available, otherwise default to cyan
    color = theme?.fontColours.user.value ? extractColorFromAnsi(theme.fontColours.user.value) : 'cyan';
  } else if (role === 'assistant') {
    label = 'AI';
    color = theme?.fontColours.ai.value ? extractColorFromAnsi(theme.fontColours.ai.value) : 'green';
  } else {
    // System messages - simple display without vertical bar structure
    return (
      <Box marginBottom={1}>
        <Text color="whiteBright">{content}</Text>
      </Box>
    );
  }

  const timeStr = timestamp ? timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : '';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Main message line */}
      <Box>
        <Text color={color} bold>
          {label}
        </Text>
        <Box marginLeft={2}>
          <Text color={color}>{content}</Text>
        </Box>
      </Box>
      {/* Timestamp line */}
      {timestamp && (
        <Box justifyContent="flex-end">
          <Text color="gray" dimColor>{timeStr}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Extract Ink color name from ANSI escape code
 */
function extractColorFromAnsi(ansiCode: string): string {
  // Map ANSI codes to Ink color names
  const colorMap: { [key: string]: string } = {
    '\x1b[36m': 'cyan',
    '\x1b[32m': 'green',
    '\x1b[35m': 'magenta',
    '\x1b[33m': 'yellow',
    '\x1b[94m': 'blueBright',
    '\x1b[92m': 'greenBright',
    '\x1b[93m': 'yellowBright',
    '\x1b[95m': 'magentaBright',
    '\x1b[96m': 'cyanBright',
    '\x1b[97m': 'whiteBright',
  };

  return colorMap[ansiCode] || 'white';
}