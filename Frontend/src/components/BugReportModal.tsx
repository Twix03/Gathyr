import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bug, Lightbulb, Loader2 } from 'lucide-react';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomCode?: string;
    userId?: string;
}

type FeedbackType = 'bug' | 'suggestion';

export function BugReportModal({ isOpen, onClose, roomCode, userId }: BugReportModalProps) {
    const [type, setType] = useState<FeedbackType>('suggestion');
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [didSubmit, setDidSubmit] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        setIsSubmitting(true);

        try {
            // Connect to the new backend endpoint
            const baseUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL || '';
            const response = await fetch(`${baseUrl}/api/rooms/suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    text,
                    user_id: userId,
                    room_code: roomCode
                })
            });

            if (!response.ok) throw new Error('Submission failed');

            setDidSubmit(true);
            setTimeout(() => {
                onClose();
                // Reset state after animation
                setTimeout(() => {
                    setDidSubmit(false);
                    setText('');
                    setType('suggestion');
                }, 300);
            }, 2000);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="feedback-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal Card */}
                    <motion.div
                        key="feedback-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,90vw)] rounded-2xl bg-[#1a1625] border border-white/10 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <h2 className="text-base font-semibold text-white">Send Feedback</h2>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                disabled={isSubmitting || didSubmit}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            {didSubmit ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-8 text-center"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-4">
                                        <Send size={32} />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2">Thank you!</h3>
                                    <p className="text-sm text-gray-400">Your feedback has been sent directly to the developers.</p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    {/* Type Selector */}
                                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setType('suggestion')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${type === 'suggestion'
                                                ? 'bg-purple-500 text-white shadow-md'
                                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Lightbulb size={16} />
                                            Suggestion
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setType('bug')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${type === 'bug'
                                                ? 'bg-red-500 text-white shadow-md'
                                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Bug size={16} />
                                            Bug Report
                                        </button>
                                    </div>

                                    {/* Text Area */}
                                    <div className="mb-6">
                                        <textarea
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            placeholder={type === 'suggestion' ? "I'd love to see a feature where..." : "I encountered a bug when..."}
                                            className="w-full h-32 px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                                            required
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!text.trim() || isSubmitting}
                                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500 to-teal-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={16} />
                                                    Submit
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
