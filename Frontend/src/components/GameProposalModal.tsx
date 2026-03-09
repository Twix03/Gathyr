import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThumbsUp, ThumbsDown, Clock, Check } from 'lucide-react';
import { GameProposal } from '../types/Room';
import { websocketService } from '../services/websocket';

interface GameProposalModalProps {
    proposal: GameProposal;
    currentUserId: string;
    gameName?: string; // Optional friendly name
}

export function GameProposalModal({ proposal, currentUserId, gameName }: GameProposalModalProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [myVote, setMyVote] = useState<boolean | null>(null);

    useEffect(() => {
        const updateTime = () => {
            const now = Date.now() / 1000; // seconds
            const remaining = Math.max(0, Math.ceil(proposal.expires_at - now));
            setTimeLeft(remaining);

            // Auto-finalize if time is up
            // Any client can trigger this to ensure it happens
            if (remaining === 0) {
                websocketService.finalizeProposal();
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [proposal.expires_at, proposal.proposer_id, currentUserId]);

    useEffect(() => {
        if (proposal.votes[currentUserId] !== undefined) {
            setMyVote(proposal.votes[currentUserId]);
        } else {
            setMyVote(null); // Reset if new proposal or state weirdness
        }
    }, [proposal.votes, currentUserId]);


    const handleVote = (vote: boolean) => {
        websocketService.voteGame(vote);
        setMyVote(vote);
    };

    const yesVotes = Object.values(proposal.votes).filter(v => v).length;
    const noVotes = Object.values(proposal.votes).filter(v => !v).length;
    const totalVotes = Object.keys(proposal.votes).length;

    const isEndGame = proposal.type === 'END';
    const title = isEndGame ? "End Game?" : "Game Proposed!";
    const description = isEndGame
        ? <span>Someone wants to <span className="text-red-400 font-medium">END</span> the current game</span>
        : <span>Someone wants to play <span className="text-purple-400 font-medium">{gameName || proposal.game_id}</span></span>;

    const yesText = isEndGame ? "End It" : "Play";
    const noText = isEndGame ? "Keep Playing" : "Veto";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-8 right-8 z-50 w-96 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Progress Bar */}
                <div className="h-1 bg-white/10 w-full">
                    <motion.div
                        className="h-full bg-purple-500"
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 15, ease: "linear" }}
                    />
                </div>

                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-1">
                                {title}
                            </h3>
                            <p className="text-sm text-zinc-400">
                                {description}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 bg-white/5 px-2 py-1 rounded-lg">
                            <Clock size={14} />
                            <span className="font-mono text-sm">{timeLeft}s</span>
                        </div>
                    </div>

                    {/* Voting Status */}
                    <div className="flex gap-2 mb-6 text-sm">
                        <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 flex items-center justify-between text-green-400">
                            <div className="flex items-center gap-1"><ThumbsUp size={14} /> <span>Yes</span></div>
                            <span className="font-bold">{yesVotes}</span>
                        </div>
                        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center justify-between text-red-400">
                            <div className="flex items-center gap-1"><ThumbsDown size={14} /> <span>No</span></div>
                            <span className="font-bold">{noVotes}</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleVote(true)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-medium
                ${myVote === true
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10'
                                }`}
                        >
                            {myVote === true && <Check size={16} />}
                            {yesText}
                        </button>

                        <button
                            onClick={() => handleVote(false)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-medium
                ${myVote === false
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10'
                                }`}
                        >
                            {myVote === false && <Check size={16} />}
                            {noText}
                        </button>
                    </div>

                    <p className="text-xs text-center text-zinc-500 mt-4">
                        Passing unless &gt;50% vote no
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
