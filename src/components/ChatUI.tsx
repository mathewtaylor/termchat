import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Message } from './Message';
import type { ChatManager } from '../chat';
import type { AppConfig, Theme } from '../types';
import type { CommandHandler } from '../commands';

export interface MessageData {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface ChatUIProps {
  chatManager: ChatManager;
  config: AppConfig;
  theme?: Theme;
  commandHandler: CommandHandler;
  welcomeMessage: string;
}

export const ChatUI: React.FC<ChatUIProps> = ({
  chatManager,
  config,
  theme,
  commandHandler,
  welcomeMessage,
}) => {
  const [messages, setMessages] = useState<MessageData[]>([
    { role: 'system', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [sessionCost, setSessionCost] = useState<number | null>(null);
  const { exit } = useApp();

  // Handle global keyboard shortcuts
  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
      process.exit(0);
    }
  });

  /**
   * Format token count for display
   */
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  /**
   * Get status bar model info with tokens and cost
   */
  const getModelInfo = (): string => {
    let info = config.config.activeModel.display_name;

    if (totalTokens > 0) {
      info += ` • ${formatTokens(totalTokens)} tokens`;
    }

    if (sessionCost !== null) {
      info += ` • $${sessionCost.toFixed(4)}`;
    }

    return info;
  };

  /**
   * Handle message submission
   */
  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();

    if (!trimmed || isProcessing) return;

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed);
      return;
    }

    // Regular message
    setIsProcessing(true);
    setIsLoading(true);

    // Add user message
    const userMessage: MessageData = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add empty assistant message (will be updated as we stream)
    const assistantMessage: MessageData = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    let assistantContent = '';
    let firstChunk = true;

    try {
      await chatManager.sendMessage(trimmed, (chunk) => {
        // On first chunk, hide loading spinner
        if (firstChunk) {
          setIsLoading(false);
          firstChunk = false;
        }

        assistantContent += chunk;

        // Update the last message (assistant) with new content
        setMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex] && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: assistantContent,
            };
          }
          return updated;
        });
      });

      setIsProcessing(false);
      setIsLoading(false);

      // Update token and cost tracking
      const inputTokens = chatManager.getTotalInputTokens();
      const outputTokens = chatManager.getTotalOutputTokens();
      setTotalTokens(inputTokens + outputTokens);

      const cost = chatManager.getSessionCost(config.config.activeModel.pricing);
      setSessionCost(cost);
    } catch (error) {
      setIsProcessing(false);
      setIsLoading(false);

      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    }
  };

  /**
   * Handle command execution
   */
  const handleCommand = async (command: string) => {
    try {
      const result = await commandHandler.execute(command);

      // Handle clear screen
      if (result.shouldClearScreen) {
        setMessages([]);
        setTotalTokens(0);
        setSessionCost(null);
      }

      // Display command result
      if (result.message) {
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            content: result.message,
          },
        ]);
      }

      // Handle exit
      if (result.shouldExit) {
        exit();
        process.exit(0);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `❌ Error: ${error instanceof Error ? error.message : 'Command failed'}`,
        },
      ]);
    }
  };

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Chat History */}
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderBottom={false} borderColor="gray" paddingX={1} paddingY={1}>
        {messages.map((msg, i) => (
          <React.Fragment key={i}>
            <Message {...msg} theme={theme} />
            {i === 0 && msg.role === 'system' && (
              <Box
                width="100%"
                borderStyle="single"
                borderTop={false}
                borderBottom={true}
                borderLeft={false}
                borderRight={false}
                borderColor="gray"
                marginBottom={1}
              />
            )}
          </React.Fragment>
        ))}
        {isLoading && (
          <Box>
            <Text color="green">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
      </Box>

      {/* Input Box */}
      <Box borderStyle="single" borderTop={true} borderBottom={true} borderColor="gray" paddingX={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(value) => {
            handleSubmit(value);
            setInput('');
          }}
          placeholder="Enter message..."
        />
      </Box>

      {/* Status Bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Text dimColor>[Enter] Send  [Esc] Clear  [↑↓] Scroll  [/exit] Exit</Text>
        <Text dimColor>{getModelInfo()}</Text>
      </Box>
    </Box>
  );
};