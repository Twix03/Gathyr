import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Gamepad2, Mic, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { apiService } from '../services/api';
import { useSearchParams } from "react-router-dom";

interface LandingPageProps {
  onCreateRoom: (userName: string) => void;
  onJoinRoom: (roomCode: string, userName: string) => void;
}

export default function LandingPage({ onCreateRoom, onJoinRoom }: LandingPageProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [searchParams] = useSearchParams();

  // Check URL for room code parameter
  useEffect(() => {
    const roomParam = searchParams.get('room');
    console.log("roomParam = ", roomParam);
    if (roomParam) {
      let participantStr = localStorage.getItem("participant");
      if (participantStr){
        let participant = JSON.parse(participantStr);
        setUserName(participant.name);
      }
      setRoomCode(roomParam.toUpperCase());
      setShowJoinDialog(true);
    }
  }, []);
  

  const handleCreate = () => {
    if (userName.trim()) {
      onCreateRoom(userName.trim());
    }
  };

  const handleJoin = () => {
    if (userName.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), userName.trim());
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#1a1625] via-[#211934] to-[#2d1b3d]">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -40, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-coral-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Logo/Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 mb-8 rounded-3xl bg-gradient-to-br from-purple-500 to-teal-500"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 bg-gradient-to-r from-purple-400 via-teal-300 to-coral-400 bg-clip-text text-transparent"
            style={{ fontSize: '4rem', fontWeight: 700, lineHeight: 1.1 }}
          >
            Hang out. Talk. Play.
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-4 text-gray-300 max-w-2xl mx-auto"
            style={{ fontSize: '1.25rem', lineHeight: 1.6 }}
          >
            Your group call, but actually fun.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-12 text-gray-400 max-w-xl mx-auto"
          >
            Join a room • Talk over voice/video • Play casual games together • No ads, no signups
          </motion.div>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto"
          >
            <div className="flex flex-col items-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 mb-3 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="mb-2 text-white">Easy Rooms</h3>
              <p className="text-sm text-gray-400 text-center">Share a link, friends join instantly</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 mb-3 rounded-xl bg-teal-500/20 flex items-center justify-center">
                <Mic className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="mb-2 text-white">Voice & Video</h3>
              <p className="text-sm text-gray-400 text-center">Crystal clear communication</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 mb-3 rounded-xl bg-coral-500/20 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-coral-400" />
              </div>
              <h3 className="mb-2 text-white">Casual Games</h3>
              <p className="text-sm text-gray-400 text-center">Fun games built right in</p>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={() => setShowCreateDialog(true)}
              className="px-8 py-6 rounded-2xl bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105"
            >
              Create Room
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowJoinDialog(true)}
              className="px-8 py-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white border-white/20 backdrop-blur-sm transition-all hover:scale-105"
            >
              Join Room
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#1a1625] border-white/10">
          <DialogHeader>
            <DialogTitle>Create a Room</DialogTitle>
            <DialogDescription>Enter your name to get started</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="bg-white/5 border-white/10"
            />
            <Button
              onClick={handleCreate}
              disabled={!userName.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
            >
              Create Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-[#1a1625] border-white/10">
          <DialogHeader>
            <DialogTitle>Join a Room</DialogTitle>
            <DialogDescription>Enter the room code and your name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="bg-white/5 border-white/10"
            />
            <Input
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="bg-white/5 border-white/10"
            />
            <Button
              onClick={handleJoin}
              disabled={!userName.trim() || !roomCode.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
            >
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
