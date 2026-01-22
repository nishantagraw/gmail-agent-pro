import React from 'react';
import { Activity, Zap, Mail, Send, Sparkles } from 'lucide-react';

const ActivityFeed = ({ activities }) => {
    const getIcon = (message) => {
        if (message.includes('Connected') || message.includes('✅')) return <Sparkles className="w-4 h-4 text-green-500" />;
        if (message.includes('Fetching') || message.includes('🔄')) return <Zap className="w-4 h-4 text-neon-cyan" />;
        if (message.includes('Reply') || message.includes('✉️')) return <Send className="w-4 h-4 text-electric-purple" />;
        if (message.includes('Failed') || message.includes('❌')) return <Mail className="w-4 h-4 text-red-500" />;
        return <Activity className="w-4 h-4 text-gray-500" />;
    };

    return (
        <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-electric-purple" />
                <h3 className="font-bold text-lg">Activity Feed</h3>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No activity yet
                    </div>
                ) : (
                    activities.map((activity) => (
                        <div
                            key={activity.id}
                            className="glass-panel p-3 animate-slide-up"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">{getIcon(activity.message)}</div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-300">
                                        {activity.message}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(activity.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActivityFeed;
