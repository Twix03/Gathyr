import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send } from 'lucide-react';
import { Participant } from '../types/Room';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { websocketService, useChatHandlers } from '../services/websocket';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentUser: Participant;
}

export default function ChatPanel({ isOpen, onClose, participants, currentUser }: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    sender: Participant;
    content: string;
    timestamp: Date;
  }>>([]);
  const [inputValue, setInputValue] = useState('');

  // Use the chat handler hook
  useChatHandlers({
    participants,
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
  });

  const handleSend = () => {
    if (inputValue.trim() && websocketService.isConnected()) {
      websocketService.sendChatMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 w-80 bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col z-40"
        >
          {/* Header */}
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
            <h3>Chat</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isCurrentUser = message.sender.id === currentUser.id;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                >
                  <img
                    src={message.sender.avatar}
                    alt={message.sender.name}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className={`flex-1 ${isCurrentUser ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-sm ${
                          isCurrentUser ? 'text-purple-400' : 'text-gray-400'
                        }`}
                      >
                        {isCurrentUser ? 'You' : message.sender.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div
                      className={`inline-block px-3 py-2 rounded-2xl ${
                        isCurrentUser
                          ? 'bg-gradient-to-r from-purple-500 to-teal-500 text-white'
                          : 'bg-white/10 text-gray-200'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="bg-white/5 border-white/10"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}