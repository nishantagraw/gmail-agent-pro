import React, { useState, useEffect, useRef } from 'react';
import { X, Minus, Activity, Mail, Send, Sparkles, Clock, CheckCircle, AlertCircle, Trash2, Lock, Unlock } from 'lucide-react';

const ProcessWindow = ({ activities = [], analytics, onClear, onDelete, onClose, isOpen }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef(null);

    // Auto-scroll to BOTTOM of activity log (newest at bottom)
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activities, autoScroll]);

    if (!isOpen) return null;

    if (isMinimized) {
        return (
            <div
                className="fixed bottom-6 right-6 z-50 animate-fade-in cursor-pointer group"
                onClick={() => setIsMinimized(false)}
            >
                <div className="bg-black/80 backdrop-blur-xl border border-neon-cyan/50 p-4 rounded-2xl shadow-neon-cyan flex items-center gap-3 hover:scale-105 transition-all">
                    <div className="relative">
                        <img
                            src="/infinite-club-logo.png"
                            alt="Agent"
                            className="w-8 h-8 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }}
                        />
                        <Activity className="w-6 h-6 text-neon-cyan animate-pulse hidden" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-ping" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white" style={{ textShadow: '0 0 10px rgba(0, 213, 224, 0.6)' }}>Monitor Active</div>
                        <div className="text-xs text-neon-cyan">{activities.length} processes</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 z-50 animate-slide-up font-sans">
            {/* Main Window */}
            <div className="bg-[#0A0F1C]/95 backdrop-blur-2xl border border-neon-cyan/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[600px]">

                {/* Header - Chatbot Agent Style */}
                <div className="bg-black/40 backdrop-blur-md p-4 flex items-center justify-between border-b border-white/10 select-none cursor-move">
                    <div className="flex items-center gap-3">
                        {/* Logo */}
                        <img
                            src="/infinite-club-logo.png"
                            alt="Agent"
                            className="w-8 h-8 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                        />
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-electric-purple flex items-center justify-center hidden">
                            <Activity className="w-4 h-4 text-white" />
                        </div>

                        <div>
                            <span className="text-sm font-bold text-white flex items-center gap-2" style={{ textShadow: '0 0 10px rgba(0,217,255,0.4)' }}>
                                Live Monitor
                            </span>
                            <span className="text-[10px] text-neon-cyan flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="bg-black/40 p-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Custom Icon for System Online */}
                        <img
                            src="/monitor-icon.ico"
                            alt="Online"
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'block';
                            }}
                        />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse hidden" />
                        <span className="text-xs text-green-400 font-medium">System Online</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {analytics?.total || 0}
                        </span>
                        <span className="flex items-center gap-1">
                            <Send className="w-3 h-3" /> {analytics?.replied || 0}
                        </span>
                    </div>
                </div>

                {/* Activity Feed */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gradient-to-b from-transparent to-black/20"
                    style={{ minHeight: '300px', maxHeight: '400px' }}
                >
                    {activities.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 opacity-50">
                            <Activity className="w-12 h-12" />
                            <p className="text-sm">Waiting for incoming emails...</p>
                        </div>
                    ) : (
                        activities.map((activity, index) => (
                            <div
                                key={activity.id || index}
                                className="group relative pl-4 border-l-2 border-white/10 hover:border-neon-cyan transition-colors py-1 pr-6"
                            >
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[5px] top-3 w-2 h-2 rounded-full transition-all group-hover:scale-125 ${activity.type === 'error' ? 'bg-red-500 shadow-red-500/50' :
                                    activity.type === 'success' ? 'bg-green-500 shadow-green-500/50' :
                                        activity.type === 'auto-reply' ? 'bg-neon-cyan shadow-neon-cyan/50' :
                                            'bg-gray-500'
                                    } shadow-lg`} />

                                {/* Delete Button (Absolute Right) */}
                                <button
                                    onClick={() => onDelete && onDelete(activity.id)}
                                    className="absolute right-0 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-500"
                                    title="Delete log"
                                >
                                    <X className="w-3 h-3" />
                                </button>

                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1 w-full">
                                        <p className={`text-sm font-medium ${activity.type === 'error' ? 'text-red-400' :
                                            activity.type === 'success' ? 'text-green-400' :
                                                'text-gray-200'
                                            }`}>
                                            {activity.message}
                                        </p>
                                        {activity.details && (
                                            <div className="text-xs text-gray-500 bg-white/5 p-2 rounded border border-white/5 mt-1">
                                                {activity.details.subject && (
                                                    <div className="truncate max-w-[200px]">
                                                        <span className="text-gray-600">Subject:</span> {activity.details.subject}
                                                    </div>
                                                )}
                                                {activity.details.from && (
                                                    <div className="truncate max-w-[200px]">
                                                        <span className="text-gray-600">From:</span> {activity.details.from}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-600 whitespace-nowrap font-mono">
                                        {activity.timestamp?.split(' ')[0]}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-white/5 border-t border-white/10 flex justify-between items-center">
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`text-xs transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg border ${autoScroll
                            ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan'
                            : 'bg-transparent border-white/10 text-gray-500 hover:text-white'
                            }`}
                        title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                    >
                        {autoScroll ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {autoScroll ? 'Auto-scroll' : 'Manual Scroll'}
                    </button>

                    <button
                        onClick={onClear}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
                    >
                        <Trash2 className="w-3 h-3" />
                        Clear All
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProcessWindow;
