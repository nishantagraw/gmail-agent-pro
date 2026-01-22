import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Zap, Check, X, BarChart3 } from 'lucide-react';

const AutoReplySettings = ({ userEmail, accessToken }) => {
    const [config, setConfig] = useState({
        enabled: false,
        categories: ['Business Inquiry', 'Pricing Question', 'Partnership'],
        minConfidence: 0.7,
        maxRepliesPerHour: 20
    });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (userEmail) {
            fetchConfig();
            fetchStats();
        }
    }, [userEmail]);

    const fetchConfig = async () => {
        try {
            const response = await axios.get('/api/auto-reply/config', {
                params: { email: userEmail }
            });
            if (response.data.success) {
                setConfig(response.data.config);
            }
        } catch (error) {
            console.error('Failed to fetch config:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get('/api/auto-reply/stats', {
                params: { email: userEmail }
            });
            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const updateConfig = async (newConfig) => {
        setLoading(true);
        try {
            const response = await axios.post('/api/auto-reply/config', {
                email: userEmail,
                ...newConfig
            });
            if (response.data.success) {
                setConfig(response.data.config);
            }
        } catch (error) {
            console.error('Failed to update config:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEnabled = () => {
        updateConfig({ ...config, enabled: !config.enabled });
    };

    const toggleCategory = (category) => {
        const newCategories = config.categories.includes(category)
            ? config.categories.filter(c => c !== category)
            : [...config.categories, category];
        updateConfig({ ...config, categories: newCategories });
    };

    return (
        <div className="glass-panel p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Zap className={`w-5 h-5 ${config.enabled ? 'text-neon-cyan' : 'text-gray-400'}`} />
                    <h3 className="text-lg font-semibold">Auto-Reply</h3>
                </div>
                <button
                    onClick={toggleEnabled}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${config.enabled
                            ? 'bg-neon-cyan text-space-black shadow-neon-cyan'
                            : 'glass-panel hover:border-neon-cyan'
                        }`}
                >
                    {config.enabled ? 'ON' : 'OFF'}
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="glass-panel p-4 mb-4 border-electric-purple/30">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-electric-purple" />
                        <span className="text-xs text-electric-purple font-medium">STATISTICS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-gray-400">Replies Today:</p>
                            <p className="text-xl font-bold text-neon-cyan">{stats.repliedToday}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Limit:</p>
                            <p className="text-xl font-bold text-white">{stats.maxPerHour}/hr</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Toggle */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full px-4 py-2 rounded-lg glass-panel hover:border-electric-purple transition-all flex items-center justify-between text-sm mb-4"
            >
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configure Settings
                </div>
                <span>{showSettings ? '▼' : '▶'}</span>
            </button>

            {/* Settings Panel */}
            {showSettings && (
                <div className="space-y-4 animate-slide-down">
                    {/* Categories */}
                    <div>
                        <p className="text-sm text-gray-400 mb-2">Auto-reply to:</p>
                        <div className="space-y-2">
                            {[
                                'Business Inquiry',
                                'Pricing Question',
                                'Partnership',
                                'Support Request'
                            ].map((category) => (
                                <label
                                    key={category}
                                    className="flex items-center gap-3 p-3 glass-panel cursor-pointer hover:border-neon-cyan transition-all"
                                >
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={config.categories.includes(category)}
                                            onChange={() => toggleCategory(category)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${config.categories.includes(category)
                                                ? 'bg-neon-cyan border-neon-cyan'
                                                : 'border-gray-600'
                                            }`}>
                                            {config.categories.includes(category) && (
                                                <Check className="w-3 h-3 text-space-black" />
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm">{category}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Confidence Slider */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-400">Minimum Confidence:</p>
                            <span className="text-sm text-neon-cyan font-medium">
                                {Math.round(config.minConfidence * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="95"
                            value={config.minConfidence * 100}
                            onChange={(e) => updateConfig({
                                ...config,
                                minConfidence: parseInt(e.target.value) / 100
                            })}
                            className="w-full accent-neon-cyan"
                        />
                    </div>

                    {/* Rate Limit */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-400">Max Replies/Hour:</p>
                            <span className="text-sm text-neon-cyan font-medium">
                                {config.maxRepliesPerHour}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="50"
                            value={config.maxRepliesPerHour}
                            onChange={(e) => updateConfig({
                                ...config,
                                maxRepliesPerHour: parseInt(e.target.value)
                            })}
                            className="w-full accent-electric-purple"
                        />
                    </div>

                    {/* Info */}
                    <div className="glass-panel p-3 border-cyber-pink/30">
                        <p className="text-xs text-gray-400">
                            ⚡ Auto-reply will only respond to:
                        </p>
                        <ul className="text-xs text-gray-300 mt-2 space-y-1 ml-4">
                            <li>• Business emails about Infinite Club services</li>
                            <li>• Selected categories above</li>
                            <li>• AI confidence ≥ {Math.round(config.minConfidence * 100)}%</li>
                            <li>• Not already replied to</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoReplySettings;
