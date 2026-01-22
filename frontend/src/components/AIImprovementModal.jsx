import React, { useState } from 'react';
import { X, Sparkles, Loader2, Zap } from 'lucide-react';
import axios from 'axios';

const AIImprovementModal = ({
    isOpen,
    onClose,
    currentReply,
    emailContext,
    accessToken,
    onImproved
}) => {
    const [instruction, setInstruction] = useState('');
    const [isImproving, setIsImproving] = useState(false);

    const quickInstructions = [
        'Make more professional',
        'Make more casual and friendly',
        'Add pricing details',
        'Make shorter',
        'Add contact information',
        'Make more formal'
    ];

    const handleImprove = async (customInstruction) => {
        const instructionToUse = customInstruction || instruction;
        if (!instructionToUse) return;

        setIsImproving(true);
        try {
            const response = await axios.post('/api/ai/improve', {
                currentReply,
                instruction: instructionToUse,
                emailContext
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            onImproved(response.data.improvedReply);
            setInstruction('');
            onClose();
        } catch (error) {
            console.error('Failed to improve:', error);
            alert('Failed to improve reply. Please try again.');
        } finally {
            setIsImproving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel max-w-2xl w-full p-6 animate-slide-up border-electric-purple/30">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-electric-purple" />
                        <h3 className="text-xl font-bold neon-text-purple">Improve with AI</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImproving}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Current Reply Preview */}
                <div className="mb-4 p-3 glass-panel border-neon-cyan/20 rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">Current Reply:</p>
                    <p className="text-sm text-gray-300 max-h-32 overflow-y-auto">
                        {currentReply.substring(0, 200)}
                        {currentReply.length > 200 && '...'}
                    </p>
                </div>

                {/* Instruction Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-2 text-gray-400">
                        How do you want to improve this reply?
                    </label>
                    <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="E.g., Make it more professional, add pricing details, etc."
                        className="w-full glass-panel p-4 min-h-[100px] resize-none focus:border-electric-purple transition-all"
                        disabled={isImproving}
                    />
                </div>

                {/* Quick Instructions */}
                <div className="mb-6">
                    <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-neon-cyan" />
                        Quick improvements:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {quickInstructions.map((quick) => (
                            <button
                                key={quick}
                                onClick={() => handleImprove(quick)}
                                disabled={isImproving}
                                className="px-3 py-2 rounded-lg glass-panel hover:border-neon-cyan hover:shadow-neon-cyan transition-all text-sm disabled:opacity-50"
                            >
                                {quick}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleImprove()}
                        disabled={!instruction || isImproving}
                        className="flex-1 cyber-button disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isImproving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                AI is improving...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Improve Reply
                            </>
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        disabled={isImproving}
                        className="px-6 py-3 rounded-lg glass-panel hover:border-red-500 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIImprovementModal;
