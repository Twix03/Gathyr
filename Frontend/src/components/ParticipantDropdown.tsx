import React, { useState } from 'react';
import { Users, Eye, EyeOff, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../types/Room';

interface ParticipantDropdownProps {
  participants: Participant[];
  visibilityStates: { [id: string]: boolean };
  onToggleVisibility: (id: string) => void;
}

export default function ParticipantDropdown({
  participants,
  visibilityStates,
  onToggleVisibility,
}: ParticipantDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
      >
        <Users className="w-4 h-4" />
        <span>Manage</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#1a1625] border border-white/10 shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-white/10">
                <h3 className="text-sm font-medium">Participants</h3>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {participants.map((participant) => {
                  const isVisible = visibilityStates[participant.id] !== false;

                  return (
                    <div
                      key={participant.id}
                      className="p-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={participant.avatar}
                            alt={participant.name}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {participant.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {!participant.voiceEnabled ? (
                                <div className="flex items-center gap-1 text-xs text-red-400">
                                  <MicOff className="w-3 h-3" />
                                  <span>Muted</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-green-400">
                                  <Mic className="w-3 h-3" />
                                  <span>Active</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onToggleVisibility(participant.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isVisible
                              ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                          title={isVisible ? 'Hide video' : 'Show video'}
                        >
                          {isVisible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
