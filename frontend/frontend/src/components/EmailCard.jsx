import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Star, Loader2, Clock, CheckSquare, Square } from 'lucide-react';

const extractSenderName = (from) => {
    if (!from) return 'Unknown';
    const match = from.match(/^([^<]+)/);
    return match ? match[1].replace(/"/g, '').trim() : from.split('@')[0];
};

const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours} hr`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const EmailCard = ({ email, accessToken, onClick, isDarkMode = true, selectionMode = false, isSelected = false, onToggleSelect }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(email.aiAnalysis || null);
    const [isStarred, setIsStarred] = useState(email.isStarred || false);

    const handleCardClick = () => {
        if (selectionMode && onToggleSelect) {
            onToggleSelect(email.id);
        } else {
            onClick();
        }
    };

    const handleToggleStar = async (e) => {
        e.stopPropagation();
        const newStatus = !isStarred;
        setIsStarred(newStatus);

        try {
            await axios.post(`/api/emails/${email.id}/${newStatus ? 'star' : 'unstar'}`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
        } catch (error) {
            setIsStarred(!newStatus);
        }
    };

    const handleAnalyzeEmail = async (e) => {
        e.stopPropagation();
        setIsAnalyzing(true);
        try {
            const response = await axios.post('/api/emails/analyze', { emailId: email.id },
                { headers: { Authorization: `Bearer ${accessToken}` } });
            setAnalysis(response.data.analysis);
            email.aiAnalysis = response.data.analysis;
            email.hasAnalysis = true;
        } catch (error) {
            console.error('Failed to analyze:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const previewText = email.snippet || '';

    // Theme Variables
    const containerClass = isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50 bg-white';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-200' : 'text-gray-700';
    const textMuted = isDarkMode ? 'text-gray-500' : 'text-gray-500';

    return (
        <div
            className={`flex items-start gap-4 px-4 py-3 cursor-pointer transition-all border-b ${containerClass} ${isSelected ? (isDarkMode ? 'bg-neon-cyan/10 border-neon-cyan/30' : 'bg-blue-50 border-blue-200') : ''}`}
            onClick={handleCardClick}
        >
            {/* Selection Checkbox - only show in selection mode */}
            {selectionMode ? (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(email.id); }}
                    className={`mt-1 flex-shrink-0 ${isSelected ? 'text-neon-cyan' : isDarkMode ? 'text-gray-500 hover:text-neon-cyan' : 'text-gray-400 hover:text-blue-500'}`}
                >
                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
            ) : (
                <button
                    onClick={handleToggleStar}
                    className={`mt-1 flex-shrink-0 ${isStarred ? 'text-yellow-400' : isDarkMode ? 'text-gray-500 hover:text-yellow-400' : 'text-gray-400 hover:text-yellow-500'}`}
                >
                    <Star className={`w-5 h-5 ${isStarred ? 'fill-yellow-400' : ''}`} />
                </button>
            )}

            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-sm uppercase ${isDarkMode ? 'bg-gradient-to-br from-neon-cyan/50 to-electric-purple/50 text-white' : 'bg-gradient-to-br from-blue-100 to-purple-100 text-purple-700'
                }`}>
                {extractSenderName(email.from).charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-semibold text-sm truncate ${textPrimary}`}>
                        {extractSenderName(email.from)}
                    </span>
                    <span className={`flex items-center gap-1 text-xs flex-shrink-0 ml-2 ${textMuted}`}>
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(email.date)}
                    </span>
                </div>

                <div className={`text-sm font-medium truncate mb-0.5 ${textSecondary}`}>
                    {email.subject || '(No Subject)'}
                </div>

                <div className={`text-xs truncate ${textMuted}`}>
                    {previewText}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {analysis ? (
                        <>
                            {analysis.isBusiness && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDarkMode ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-cyan-50 text-cyan-700'}`}>Business</span>
                            )}
                            {analysis.category && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDarkMode ? 'bg-electric-purple/15 text-electric-purple' : 'bg-purple-50 text-purple-700'}`}>{analysis.category}</span>
                            )}
                            {analysis.urgency && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDarkMode ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>Urgent</span>
                            )}
                        </>
                    ) : !email.hasAnalysis && (
                        // "AI Analyze" button - slightly bigger with sky blue (#00D5E0) light effect
                        <button
                            onClick={handleAnalyzeEmail}
                            disabled={isAnalyzing}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${isDarkMode
                                ? 'bg-[#00D5E0]/15 text-[#00D5E0] border-[#00D5E0]/30 shadow-[#00D5E0]/30'
                                : 'bg-cyan-50 text-[#00a8b1] border-cyan-100 hover:bg-cyan-100'
                                }`}
                            style={isDarkMode ? {
                                boxShadow: '0 0 8px rgba(0, 213, 224, 0.3)',
                                border: '1px solid rgba(0, 213, 224, 0.3)'
                            } : {}}
                        >
                            {isAnalyzing ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                            ) : (
                                <><Sparkles className="w-3.5 h-3.5" /> AI Analyze</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


export default EmailCard;
