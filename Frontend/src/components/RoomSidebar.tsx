import React from 'react';
import { House, Gamepad2, MessageCircle, Settings, LogOut, Bug } from 'lucide-react';
import { motion } from 'motion/react';

interface RoomSidebarProps {
  currentView: 'home' | 'games';
  onViewChange: (view: 'home' | 'games') => void;
  onLeaveRoom: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
}

export default function RoomSidebar({
  currentView,
  onViewChange,
  onLeaveRoom,
  isChatOpen,
  onToggleChat,
  onOpenSettings,
  onOpenFeedback,
}: RoomSidebarProps) {
  const navItems = [
    { id: 'home', icon: House, label: 'Room' },
    { id: 'games', icon: Gamepad2, label: 'Games' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-20 bg-black/30 backdrop-blur-sm border-r border-white/10 flex-col items-center py-6">
        {/* Logo */}
        <div className="w-12 h-12 mb-8 rounded-2xl bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center">
          <Gamepad2 className="w-6 h-6 text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as 'home' | 'games')}
              className="relative group"
            >
              <motion.div
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${isActive
                  ? 'bg-gradient-to-br from-purple-500/20 to-teal-500/20 border border-purple-500/30'
                  : 'hover:bg-white/5'
                  }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-300'
                    }`}
                />
                <span
                  className={`text-[10px] transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'
                    }`}
                >
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}

        {/* Chat Toggle */}
        <button onClick={onToggleChat} className="relative group">
          <motion.div
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${isChatOpen
              ? 'bg-gradient-to-br from-purple-500/20 to-teal-500/20 border border-purple-500/30'
              : 'hover:bg-white/5'
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle
              className={`w-5 h-5 transition-colors ${isChatOpen ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-300'
                }`}
            />
            <span
              className={`text-[10px] transition-colors ${isChatOpen ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'
                }`}
            >
              Chat
            </span>
          </motion.div>
        </button>
      </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2">
          <button onClick={onOpenFeedback} className="group" title="Send Feedback">
            <motion.div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-white/5 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative">
                <Bug className="w-5 h-5 text-gray-400 group-hover:text-amber-400 transition-colors" />
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <span className="text-[10px] text-gray-500 group-hover:text-amber-400 transition-colors">
                Feedback
              </span>
            </motion.div>
          </button>

          <button onClick={onOpenSettings} className="group">
            <motion.div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-white/5 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
              <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                Settings
              </span>
            </motion.div>
          </button>

          <button onClick={onLeaveRoom} className="group">
            <motion.div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-red-500/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400 transition-colors" />
              <span className="text-[10px] text-gray-500 group-hover:text-red-400 transition-colors">
                Leave
              </span>
            </motion.div>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-black/30 backdrop-blur-sm border-t border-white/10 flex items-center justify-around px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as 'home' | 'games')}
              className="relative group"
            >
              <motion.div
                className={`flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive ? 'text-purple-400' : 'text-gray-400'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px]">{item.label}</span>
              </motion.div>
            </button>
          );
        })}

        <button onClick={onToggleChat} className="relative group">
          <motion.div
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              isChatOpen ? 'text-purple-400' : 'text-gray-400'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-[10px]">Chat</span>
          </motion.div>
        </button>

        <button onClick={onOpenSettings} className="group">
          <motion.div
            className="flex flex-col items-center justify-center gap-1 text-gray-400 transition-all"
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px]">Settings</span>
          </motion.div>
        </button>
      </div>
    </>
  );
}