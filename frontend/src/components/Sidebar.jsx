import React from 'react';
import {
    Inbox, Star, Clock, Send, File, Trash2,
    Briefcase, DollarSign, Users, LifeBuoy, Mail, Bot, AlertTriangle
} from 'lucide-react';

const Sidebar = ({ selectedCategory, onSelectCategory, unreadCounts = {}, userProfile, isDarkMode = true }) => {
    const mainItems = [
        { id: 'INBOX', label: 'Inbox', icon: Inbox },
        { id: 'STARRED', label: 'Starred', icon: Star },
        { id: 'SNOOZED', label: 'Snoozed', icon: Clock },
        { id: 'SENT', label: 'Sent Mail', icon: Send },
        { id: 'AUTO_REPLIES', label: 'Auto Replies', icon: Bot },
        { id: 'URGENT', label: 'Urgent', icon: AlertTriangle },
        { id: 'DRAFT', label: 'Drafts', icon: File },
        { id: 'TRASH', label: 'Trash', icon: Trash2 },
    ];

    const businessItems = [
        { id: 'Business Inquiry', label: 'Business Inquiries', icon: Briefcase },
        { id: 'Pricing Question', label: 'Pricing Questions', icon: DollarSign },
        { id: 'Partnership', label: 'Partnerships', icon: Users },
        { id: 'Support Request', label: 'Support Requests', icon: LifeBuoy },
    ];

    return (
        <div className={`w-64 flex-shrink-0 h-screen border-r flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200 shadow-lg'
            }`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    {/* Logo - 48px (Larger) */}
                    <img
                        src="/infinite-club-logo.png"
                        alt="Infinite Club"
                        className="w-12 h-12 object-contain flex-shrink-0"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                        }}
                    />
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-cyan to-electric-purple flex items-center justify-center hidden">
                        <Mail className="w-6 h-6 text-white" />
                    </div>

                    <div>
                        <h1 className="text-lg font-bold leading-tight"
                            style={{
                                color: isDarkMode ? '#00d9ff' : '#00a0b0',
                                textShadow: isDarkMode
                                    ? '0 0 15px rgba(0,217,255,0.6), 0 0 5px rgba(0,217,255,0.8)'
                                    : '0 0 1px rgba(0,160,176,0.5)'
                            }}>
                            Gmail Agent
                        </h1>
                        {/* "by Infinite Club" with sky blue glow */}
                        <p className="text-[11px] font-semibold"
                            style={{
                                color: '#00D5E0',
                                textShadow: isDarkMode
                                    ? '0 0 8px rgba(0, 213, 224, 0.5)'
                                    : '0 0 1px rgba(0, 213, 224, 0.5)'
                            }}>
                            by Infinite Club
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-4">
                {/* Mail Section */}
                <div>
                    <h3 className={`px-3 text-xs font-bold mb-2 tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>MAIL</h3>
                    <div className="space-y-0.5">
                        {mainItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSelectCategory(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${selectedCategory === item.id
                                    ? 'bg-neon-cyan/20 text-neon-cyan font-medium'
                                    : isDarkMode
                                        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                </div>
                                {unreadCounts[item.id] > 0 && (
                                    <span className="text-xs font-bold bg-neon-cyan/20 px-2 py-0.5 rounded-full">{unreadCounts[item.id]}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Business Section */}
                <div>
                    <h3 className={`px-3 text-xs font-bold mb-2 tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>BUSINESS</h3>
                    <div className="space-y-0.5">
                        {businessItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSelectCategory(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${selectedCategory === item.id
                                    ? 'bg-electric-purple/20 text-electric-purple font-medium'
                                    : isDarkMode
                                        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* User Profile Footer */}
            {userProfile && (
                <div className={`p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                        {userProfile.picture ? (
                            <img src={userProfile.picture} alt={userProfile.name} className="w-9 h-9 rounded-full" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-cyan to-electric-purple flex items-center justify-center text-white font-bold text-sm">
                                {(userProfile.name || userProfile.email || '?').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{userProfile.name || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">{userProfile.email}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
