import React from 'react';
import { Bot, Sparkles, Zap, Clock } from 'lucide-react';

const AIControlPanel = ({ autoReplyEnabled, onToggle }) => {
    return (
        <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-6">
                <Bot className="w-5 h-5 text-neon-cyan" />
                <h3 className="font-bold text-lg">AI Control Center</h3>
            </div>

            {/* Master Toggle */}
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-neon-cyan/10 to-electric-purple/10 border border-neon-cyan/30">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="font-medium text-white mb-1">
                            Auto-Reply Master
                        </div>
                        <div className="text-xs text-gray-400">
                            AI will auto-respond to business emails
                        </div>
                    </div>

                    <button
                        onClick={() => onToggle(!autoReplyEnabled)}
                        className={`relative w-14 h-7 rounded-full transition-all ${autoReplyEnabled
                                ? 'bg-neon-cyan shadow-neon-cyan'
                                : 'bg-gray-700'
                            }`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${autoReplyEnabled ? 'translate-x-7' : ''
                            }`} />
                    </button>
                </div>

                {autoReplyEnabled && (
                    <div className="mt-3 pt-3 border-t border-neon-cyan/20 flex items-center gap-2 text-xs text-neon-cyan">
                        <Zap className="w-3 h-3" />
                        AI is actively monitoring new emails
                    </div>
                )}
            </div>

            {/* Category Toggles */}
            <div className="space-y-3">
                <div className="text-sm font-medium text-gray-400 mb-3">
                    Auto-Reply Categories:
                </div>

                {[
                    { name: 'Business Inquiry', color: 'neon-cyan', enabled: true },
                    { name: 'Pricing Question', color: 'electric-purple', enabled: true },
                    { name: 'Support Request', color: 'cyber-pink', enabled: true },
                    { name: 'Partnership', color: 'yellow-400', enabled: true }
                ].map((category) => (
                    <div
                        key={category.name}
                        className="flex items-center justify-between p-3 rounded-lg glass-panel"
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full bg-${category.color}`} />
                            <span className="text-sm">{category.name}</span>
                        </div>

                        <div className={`text-xs ${category.enabled ? 'text-neon-cyan' : 'text-gray-500'}`}>
                            {category.enabled ? 'Active' : 'Disabled'}
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Stats */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-2 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                    <span>AI Model:</span>
                    <span className="text-electric-purple font-medium">GPT-4</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Response Time:</span>
                    <span className="text-neon-cyan font-medium">~2-3s</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Confidence:</span>
                    <span className="text-cyber-pink font-medium">95%+</span>
                </div>
            </div>
        </div>
    );
};

export default AIControlPanel;
