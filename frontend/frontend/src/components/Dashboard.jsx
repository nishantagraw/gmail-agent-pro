import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Mail, Sparkles, Zap, TrendingUp, Bot, Power, Star,
    RefreshCw, LogOut, Search, Filter, Send, Briefcase, AlertTriangle, Loader2, Activity,
    Calendar, BarChart3, Clock, ChevronDown, Sun, Moon, Menu, PanelLeftClose, PanelLeft,
    Trash2, RotateCcw, CheckSquare, Square
} from 'lucide-react';
import EmailCard from './EmailCard';
import ProcessWindow from './ProcessWindow';
import EmailDetailView from './EmailDetailView';
import Sidebar from './Sidebar';

const Dashboard = () => {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState(null);
    const [userEmail, setUserEmail] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('INBOX');
    const [activities, setActivities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({ INBOX: 0, Business: 0 });
    const [userProfile, setUserProfile] = useState(null);
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [isMonitorOpen, setIsMonitorOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme_mode');
        return saved ? saved === 'dark' : true; // Default dark
    });
    const [autoReplyStats, setAutoReplyStats] = useState({
        today: 0,
        yesterday: 0,
        thisWeek: 0,
        thisMonth: 0,
        total: 0
    });
    const [selectedTimeFilter, setSelectedTimeFilter] = useState('today');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar toggle state
    const [selectedEmails, setSelectedEmails] = useState([]); // Multi-select emails
    const [selectionMode, setSelectionMode] = useState(false); // Toggle selection mode

    // Get auto-reply count based on selected filter
    const getFilteredAutoReplyCount = () => {
        switch (selectedTimeFilter) {
            case 'today': return autoReplyStats?.today || 0;
            case 'yesterday': return autoReplyStats?.yesterday || 0;
            case 'week': return autoReplyStats?.thisWeek || 0;
            case 'month': return autoReplyStats?.thisMonth || 0;
            default: return autoReplyStats?.today || 0;
        }
    };

    // Group emails by time period for Auto Replies display
    const groupEmailsByTime = (emailList) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const groups = {
            today: [],
            yesterday: [],
            thisWeek: [],
            earlier: []
        };

        emailList.forEach(email => {
            const emailDate = new Date(email.date);
            if (emailDate >= today) {
                groups.today.push(email);
            } else if (emailDate >= yesterday) {
                groups.yesterday.push(email);
            } else if (emailDate >= weekAgo) {
                groups.thisWeek.push(email);
            } else {
                groups.earlier.push(email);
            }
        });

        return groups;
    };

    // Check for auth tokens in URL or LocalStorage on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const refreshToken = params.get('refresh_token');
        const email = params.get('email');

        if (token && refreshToken && email) {
            localStorage.setItem('gmail_access_token', token);
            localStorage.setItem('gmail_refresh_token', refreshToken);
            localStorage.setItem('gmail_user_email', email);

            setAccessToken(token);
            setUserEmail(email);
            setIsAuthenticated(true);

            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            const storedToken = localStorage.getItem('gmail_access_token');
            const storedEmail = localStorage.getItem('gmail_user_email');

            if (storedToken && storedEmail) {
                setAccessToken(storedToken);
                setUserEmail(storedEmail);
                setIsAuthenticated(true);
            }
        }
        setLoading(false);
    }, []);

    // Load auto-reply setting and sync with backend
    useEffect(() => {
        const savedSetting = localStorage.getItem('auto_reply_enabled');
        if (savedSetting !== null) {
            const isEnabled = savedSetting === 'true';
            setAutoReplyEnabled(isEnabled);

            if (accessToken) {
                axios.post('/api/auto-reply/toggle', {
                    enabled: isEnabled
                }, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }).then(() => {
                    console.log(`🔄 Synced auto-reply state: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
                }).catch(err => console.error('Failed to sync auto-reply state:', err));
            }
        }
    }, [accessToken]);

    // Theme toggle effect
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            document.body.style.background = '#000000';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.background = '#f3f4f6';
        }
        localStorage.setItem('theme_mode', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Toggle theme
    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    // Toggle auto-reply
    const handleAutoReplyToggle = async () => {
        const newState = !autoReplyEnabled;
        setAutoReplyEnabled(newState);
        localStorage.setItem('auto_reply_enabled', newState.toString());

        try {
            await axios.post('/api/auto-reply/toggle', {
                enabled: newState
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`Auto-reply ${newState ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Failed to update auto-reply setting:', error);
        }
    };

    // Setup axios interceptor for auto token refresh
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const refreshToken = localStorage.getItem('gmail_refresh_token');
                        const email = localStorage.getItem('gmail_user_email');

                        if (!refreshToken) {
                            handleLogout();
                            return Promise.reject(error);
                        }

                        console.log('🔄 Access token expired, refreshing...');

                        const response = await axios.post('/auth/refresh', {
                            refreshToken,
                            email
                        });

                        const { accessToken: newAccessToken } = response.data;

                        localStorage.setItem('gmail_access_token', newAccessToken);
                        setAccessToken(newAccessToken);

                        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                        console.log('✅ Token refreshed successfully');

                        return axios(originalRequest);

                    } catch (refreshError) {
                        console.error('❌ Token refresh failed:', refreshError);
                        handleLogout();
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    // Fetch emails when category changes
    useEffect(() => {
        if (isAuthenticated && accessToken) {
            fetchEmails();
        }
    }, [isAuthenticated, accessToken, selectedCategory]);

    // Poll for activity, analytics, and unread counts
    useEffect(() => {
        if (isAuthenticated && accessToken) {
            fetchActivityLog();
            fetchAnalytics();
            fetchUnreadCounts();
            fetchUserProfile();
            fetchAutoReplyStats();

            const interval = setInterval(() => {
                fetchActivityLog();
                fetchUnreadCounts();
                fetchAnalytics();
                fetchAutoReplyStats();
            }, 30000);

            const activityInterval = setInterval(() => {
                fetchActivityLog();
            }, 5000);

            return () => {
                clearInterval(interval);
                clearInterval(activityInterval);
            };
        }
    }, [isAuthenticated, accessToken]);

    const fetchActivityLog = async () => {
        try {
            const response = await axios.get('/api/activity', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.data.activity) {
                setActivities(response.data.activity.reverse());
            }
        } catch (error) {
            console.error('Failed to fetch activity:', error);
        }
    };

    const fetchEmails = async () => {
        setLoading(true);
        try {
            // Handle AUTO_REPLIES category separately
            if (selectedCategory === 'AUTO_REPLIES') {
                const response = await axios.get('/api/auto-replies/history', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setEmails(response.data.emails || []);
                setLoading(false);
                return;
            }

            let label = 'INBOX';
            if (selectedCategory === 'SENT') label = 'SENT';
            else if (selectedCategory === 'TRASH') label = 'TRASH';
            else if (selectedCategory === 'DRAFT') label = 'DRAFT';
            else if (selectedCategory === 'STARRED') label = 'STARRED';
            else if (selectedCategory === 'SNOOZED') label = 'SNOOZED';

            // Check if this is a category that needs AI analysis filtering
            const aiFilterCategories = ['Business Inquiry', 'Pricing Question', 'Partnership', 'Support Request', 'URGENT'];
            const isAICategory = aiFilterCategories.includes(selectedCategory);
            const isSystemLabel = ['INBOX', 'SENT', 'TRASH', 'DRAFT', 'STARRED', 'SNOOZED'].includes(selectedCategory);

            const response = await axios.get(`/api/emails?label=${isSystemLabel ? label : 'INBOX'}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            let fetchedEmails = response.data.emails || [];

            // Filter by AI category if needed
            if (isAICategory) {
                const categoryName = selectedCategory === 'URGENT' ? 'Urgent' : selectedCategory;
                fetchedEmails = fetchedEmails.filter(email =>
                    email.aiAnalysis?.category === categoryName ||
                    email.aiAnalysis?.priority === 'urgent' ||
                    (selectedCategory === 'URGENT' && email.aiAnalysis?.priority?.toLowerCase() === 'high')
                );
            } else if (!isSystemLabel && selectedCategory !== 'all') {
                fetchedEmails = fetchedEmails.filter(email => email.aiAnalysis?.category === selectedCategory);
            }

            setEmails(fetchedEmails);
        } catch (error) {
            console.error('Failed to fetch emails:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            // Try realtime endpoint first
            const response = await axios.get('/api/analytics/realtime', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.data.success) {
                setAnalytics(response.data.analytics);
            }
        } catch (error) {
            // Fallback to regular analytics
            try {
                const fallbackResponse = await axios.get('/api/analytics', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setAnalytics(fallbackResponse.data.analytics);
            } catch (fallbackError) {
                console.error('Failed to fetch analytics:', fallbackError);
            }
        }
    };

    const fetchAutoReplyStats = async () => {
        try {
            const response = await axios.get(`/api/auto-reply/analytics`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.data.success) {
                setAutoReplyStats(response.data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch auto-reply stats:', error);
        }
    };

    const fetchUnreadCounts = async () => {
        try {
            const response = await axios.get('/api/labels/counts', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setUnreadCounts(response.data);
        } catch (error) {
            console.error('Failed to fetch unread counts:', error);
        }
    };

    const fetchUserProfile = async () => {
        try {
            const response = await axios.get('/api/user/profile', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.data.success) {
                setUserProfile(response.data.profile);
            }
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        }
    };

    const handleLogin = async () => {
        try {
            const response = await axios.get('/auth/url');
            window.location.href = response.data.url;
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    // Reset auto-reply history
    const handleResetAutoReplies = async () => {
        if (!confirm('Are you sure you want to reset all auto-reply history? This cannot be undone.')) return;
        try {
            await axios.post('/api/auto-replies/reset', {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setAutoReplyStats({ today: 0, yesterday: 0, thisWeek: 0, thisMonth: 0, total: 0 });
            if (selectedCategory === 'AUTO_REPLIES') {
                setEmails([]);
            }
            alert('Auto-reply history has been reset!');
        } catch (error) {
            console.error('Failed to reset:', error);
            alert('Failed to reset auto-reply history');
        }
    };

    // Toggle email selection
    const toggleEmailSelection = (emailId) => {
        setSelectedEmails(prev =>
            prev.includes(emailId)
                ? prev.filter(id => id !== emailId)
                : [...prev, emailId]
        );
    };

    // Select all visible emails
    const selectAllEmails = () => {
        const allIds = filteredEmails.map(e => e.id);
        setSelectedEmails(allIds);
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedEmails([]);
        setSelectionMode(false);
    };

    // Bulk delete selected emails
    const handleBulkDelete = async () => {
        if (selectedEmails.length === 0) return;
        if (!confirm(`Delete ${selectedEmails.length} emails? This will move them to Trash in Gmail.`)) return;

        try {
            const response = await axios.post('/api/emails/bulk-delete',
                { emailIds: selectedEmails },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            alert(response.data.message);
            clearSelection();
            fetchEmails();
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert('Failed to delete emails');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('gmail_access_token');
        localStorage.removeItem('gmail_refresh_token');
        localStorage.removeItem('gmail_user_email');
        setIsAuthenticated(false);
        setAccessToken(null);
        setUserEmail(null);
        setEmails([]);
    };

    const handleDeleteActivity = async (id) => {
        try {
            await axios.delete(`/api/activity/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setActivities(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Failed to delete activity:', error);
        }
    };

    const handleClearActivity = async () => {
        try {
            await axios.delete('/api/activity', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setActivities([]);
        } catch (error) {
            console.error('Failed to clear activity:', error);
        }
    };

    const filteredEmails = emails.filter(email => {
        const matchesSearch = searchQuery === '' ||
            email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.from?.toLowerCase().includes(searchQuery.toLowerCase());

        // Time filter
        if (selectedTimeFilter === 'all') {
            return matchesSearch;
        }

        const emailDate = new Date(email.date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const weekAgo = new Date(today.getTime() - 7 * 86400000);
        const monthAgo = new Date(today.getTime() - 30 * 86400000);

        let matchesTime = true;
        switch (selectedTimeFilter) {
            case 'today':
                matchesTime = emailDate >= today;
                break;
            case 'yesterday':
                matchesTime = emailDate >= yesterday && emailDate < today;
                break;
            case 'week':
                matchesTime = emailDate >= weekAgo;
                break;
            case 'month':
                matchesTime = emailDate >= monthAgo;
                break;
            default:
                matchesTime = true;
        }

        return matchesSearch && matchesTime;
    });

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md glass-panel p-12 animate-slide-up">
                    {/* Infinite Club Logo */}
                    <div className="mb-6">
                        <img
                            src="/infinite-club-logo.png"
                            alt="Infinite Club"
                            className="w-24 h-24 mx-auto object-contain"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                            }}
                        />
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-neon-cyan to-electric-purple rounded-2xl items-center justify-center shadow-neon-cyan hidden">
                            <Mail className="w-12 h-12" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold mb-1 neon-text-cyan">
                        Gmail Agent
                    </h1>
                    <p className="text-lg text-electric-purple mb-2 font-medium">
                        by Infinite Club
                    </p>

                    <p className="text-gray-400 mb-2">
                        Professional Email Automation
                    </p>

                    <p className="text-sm text-gray-500 mb-8 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4 text-electric-purple" />
                        Powered by Gemini AI
                    </p>

                    <button
                        onClick={handleLogin}
                        className="cyber-button w-full"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Bot className="w-5 h-5" />
                            Connect Gmail with AI
                        </div>
                    </button>

                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-3">All Features Enabled:</p>
                        <div className="text-left space-y-2 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-neon-cyan" />
                                Selective AI analysis (10x faster!)
                            </div>
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-electric-purple" />
                                Smart auto-reply generation
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-cyber-pink" />
                                Auto token refresh (never logout!)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main Dashboard
    return (
        <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'}`}>

            {/* Sidebar Navigation - Collapsible */}
            <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-0'} overflow-hidden flex-shrink-0`}>
                <Sidebar
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    unreadCounts={unreadCounts}
                    userProfile={userProfile}
                    isDarkMode={isDarkMode}
                />
            </div>

            {/* Sidebar Toggle Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`fixed top-4 z-50 p-2 rounded-lg transition-all duration-300 ${isSidebarOpen ? 'left-[15.5rem]' : 'left-4'
                    } ${isDarkMode
                        ? 'bg-black/60 hover:bg-black/80 border border-white/10 text-white'
                        : 'bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 shadow-md'
                    }`}
                title={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            >
                {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>

            {/* Main Content Area - SCROLLABLE CONTAINER */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">

                {/* Background Watermark Logo (Center of Screen) */}
                <div className="fixed top-1/2 left-[calc(50%+8rem)] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-[0.04] select-none">
                    <img
                        src="/infinite-club-logo.png"
                        alt="Background"
                        className={`w-[500px] h-[500px] object-contain ${isDarkMode ? 'brightness-100' : 'brightness-0 contrast-50'}`}
                    />
                </div>

                {/* Header - Scrolls with content */}
                <header className={`p-6 border-b sticky top-0 z-10 backdrop-blur-xl transition-colors ${isDarkMode
                    ? 'border-white/10 bg-black/40'
                    : 'border-gray-200 bg-white/80'
                    }`}>

                    <div className="flex items-center justify-between mb-4 h-10 overflow-visible">
                        {/* Logo - replaces Inbox title, overflows the row */}
                        <img
                            src="/infinite club gmail.png"
                            alt="Infinite Club Gmail"
                            className="h-32 object-contain"
                        />

                        <div className="flex items-center gap-3">

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search mail..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`border rounded-lg pl-9 pr-4 py-2 text-sm transition-all w-64 ${isDarkMode
                                        ? 'bg-white/5 border-white/10 focus:border-neon-cyan text-white'
                                        : 'bg-white border-gray-200 focus:border-blue-500 text-gray-900'
                                        }`}
                                />
                            </div>

                            {/* Auto-Reply Toggle - ORIGINAL DESIGN */}
                            <button
                                onClick={handleAutoReplyToggle}
                                className={`relative group overflow-hidden px-6 py-2.5 rounded-xl border transition-all duration-300 ${autoReplyEnabled
                                    ? isDarkMode
                                        ? 'bg-black/40 border-neon-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.3)]'
                                        : 'bg-green-50 border-green-400 shadow-lg'
                                    : isDarkMode
                                        ? 'bg-black/40 border-white/10 hover:border-white/30'
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                                <div className="flex items-center gap-3 relative z-10">
                                    <div className={`p-1.5 rounded-lg transition-colors ${autoReplyEnabled
                                        ? isDarkMode ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-green-100 text-green-600'
                                        : isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        <Bot className="w-5 h-5" />
                                    </div>

                                    <div className="flex flex-col items-start">
                                        <span className={`text-[10px] font-bold tracking-wider ${autoReplyEnabled
                                            ? isDarkMode ? 'text-neon-cyan' : 'text-green-600'
                                            : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                            }`}>
                                            AUTO-REPLY SYSTEM
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full animate-pulse ${autoReplyEnabled ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'
                                                }`} />
                                            <span className={`text-xs font-medium ${autoReplyEnabled
                                                ? isDarkMode ? 'text-white' : 'text-green-700'
                                                : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                                }`}>
                                                {autoReplyEnabled ? 'ACTIVE' : 'DISABLED'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className={`p-2 rounded-lg transition-colors ${isDarkMode
                                    ? 'hover:bg-white/10 text-yellow-400'
                                    : 'hover:bg-gray-200 text-gray-600'
                                    }`}
                                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            <button
                                onClick={fetchEmails}
                                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'
                                    }`}
                                title="Refresh"
                            >
                                <RefreshCw className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={handleLogout}
                                className={`p-2 rounded-lg transition-colors group ${isDarkMode ? 'hover:bg-red-500/20' : 'hover:bg-red-50'
                                    }`}
                                title="Logout"
                            >
                                <LogOut className={`w-5 h-5 group-hover:text-red-500 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Analytics Summary with Global Time Filter */}
                    <div className="flex gap-3 overflow-x-auto pb-2 items-center">
                        {/* Global Time Filter */}
                        <select
                            value={selectedTimeFilter}
                            onChange={(e) => setSelectedTimeFilter(e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none cursor-pointer ${isDarkMode
                                ? 'bg-black/40 border-neon-cyan/30 text-neon-cyan focus:border-neon-cyan'
                                : 'bg-white border-blue-200 text-blue-600 focus:border-blue-500 shadow-sm'
                                }`}
                        >
                            <option value="today">📅 Today</option>
                            <option value="yesterday">📆 Yesterday</option>
                            <option value="week">📊 This Week</option>
                            <option value="month">📈 This Month</option>
                            <option value="all">🗂️ All Time</option>
                        </select>

                        {/* Loaded / Total - Clickable */}
                        <button
                            onClick={() => setSelectedCategory('INBOX')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-3 min-w-[130px] cursor-pointer hover:scale-105 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-neon-cyan/50' : 'bg-white border-gray-200 shadow-sm hover:border-blue-300'}`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-neon-cyan/20' : 'bg-blue-100'}`}>
                                <Mail className={`w-4 h-4 ${isDarkMode ? 'text-neon-cyan' : 'text-blue-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {filteredEmails.length || 0}
                                    <span className="text-[10px] text-gray-500 font-normal ml-1">/ {analytics?.total?.toLocaleString() || '...'}</span>
                                </div>
                                <div className="text-[10px] text-gray-400">Emails</div>
                            </div>
                        </button>

                        {/* Unread - Clickable */}
                        <button
                            onClick={() => setSelectedCategory('INBOX')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-3 min-w-[100px] cursor-pointer hover:scale-105 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-electric-purple/50' : 'bg-white border-gray-200 shadow-sm hover:border-purple-300'}`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-electric-purple/20' : 'bg-purple-100'}`}>
                                <Mail className={`w-4 h-4 ${isDarkMode ? 'text-electric-purple' : 'text-purple-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{unreadCounts?.INBOX || 0}</div>
                                <div className="text-[10px] text-gray-400">Unread</div>
                            </div>
                        </button>

                        {/* Starred - Clickable */}
                        <button
                            onClick={() => setSelectedCategory('STARRED')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-3 min-w-[100px] cursor-pointer hover:scale-105 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-yellow-500/50' : 'bg-white border-gray-200 shadow-sm hover:border-yellow-300'}`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
                                <Star className={`w-4 h-4 ${isDarkMode ? 'text-yellow-500' : 'text-yellow-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{unreadCounts?.STARRED || 0}</div>
                                <div className="text-[10px] text-gray-400">Starred</div>
                            </div>
                        </button>

                        {/* Urgent - Clickable */}
                        <button
                            onClick={() => setSelectedCategory('URGENT')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-3 min-w-[100px] cursor-pointer hover:scale-105 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-red-500/50' : 'bg-white border-gray-200 shadow-sm hover:border-red-300'}`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                <AlertTriangle className={`w-4 h-4 ${isDarkMode ? 'text-red-500' : 'text-red-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{analytics?.urgent || 0}</div>
                                <div className="text-[10px] text-gray-400">Urgent</div>
                            </div>
                        </button>

                        {/* Auto-Replies - Clickable */}
                        <button
                            onClick={() => setSelectedCategory('AUTO_REPLIES')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-3 min-w-[120px] cursor-pointer hover:scale-105 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-green-500/50' : 'bg-white border-gray-200 shadow-sm hover:border-green-300'}`}
                        >
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                                <Send className={`w-4 h-4 ${isDarkMode ? 'text-green-500' : 'text-green-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getFilteredAutoReplyCount()}</div>
                                <div className="text-[10px] text-gray-400">Auto-Replies</div>
                            </div>
                        </button>

                        {/* Reset Auto-Replies Button */}
                        <button
                            onClick={handleResetAutoReplies}
                            className={`p-2 rounded-lg transition-colors ${isDarkMode
                                ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400'
                                : 'hover:bg-red-100 text-gray-400 hover:text-red-500'}`}
                            title="Reset Auto-Reply History"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Selection Mode Toolbar - Compact */}
                    <div className={`flex items-center gap-2 mt-1 -mb-1 pt-2 border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                        <button
                            onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) clearSelection(); }}
                            className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-all ${selectionMode
                                ? isDarkMode ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-blue-100 text-blue-600'
                                : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {selectionMode ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                            {selectionMode ? 'ON' : 'Select'}
                        </button>

                        {selectionMode && (
                            <>
                                <button
                                    onClick={selectAllEmails}
                                    className={`px-2 py-1 rounded text-[10px] font-medium ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    All ({filteredEmails.length})
                                </button>
                                <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {selectedEmails.length} sel
                                </span>
                                {selectedEmails.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-0.5"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        {selectedEmails.length}
                                    </button>
                                )}
                                <button
                                    onClick={clearSelection}
                                    className={`px-1 py-1 text-[10px] ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    ✕
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {/* Email List - Part of scrollable area */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-neon-cyan' : 'text-blue-600'}`} />
                        </div>
                    ) : filteredEmails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Mail className="w-12 h-12 mb-4 opacity-20" />
                            <p>No emails found in {selectedCategory === 'AUTO_REPLIES' ? 'Auto Replies' : selectedCategory}</p>
                        </div>
                    ) : selectedCategory === 'AUTO_REPLIES' ? (
                        // Grouped display for Auto Replies
                        <div className="space-y-6">
                            {(() => {
                                const groups = groupEmailsByTime(filteredEmails);
                                return (
                                    <>
                                        {groups.today.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neon-cyan' : 'text-blue-600'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Today ({groups.today.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.today.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.yesterday.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                    Yesterday ({groups.yesterday.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.yesterday.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.thisWeek.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    This Week ({groups.thisWeek.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.thisWeek.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.earlier.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                    Earlier ({groups.earlier.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.earlier.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        // Grouped display for ALL mailboxes
                        <div className="space-y-6">
                            {(() => {
                                const groups = groupEmailsByTime(filteredEmails);
                                return (
                                    <>
                                        {groups.today.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neon-cyan' : 'text-blue-600'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Today ({groups.today.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.today.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.yesterday.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                    Yesterday ({groups.yesterday.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.yesterday.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.thisWeek.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    This Week ({groups.thisWeek.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.thisWeek.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {groups.earlier.length > 0 && (
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                    Earlier ({groups.earlier.length})
                                                </h3>
                                                <div className="space-y-3">
                                                    {groups.earlier.map((email) => (
                                                        <EmailCard key={email.id} email={email} onClick={() => setSelectedEmail(email)} accessToken={accessToken} isDarkMode={isDarkMode} selectionMode={selectionMode} isSelected={selectedEmails.includes(email.id)} onToggleSelect={toggleEmailSelection} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Email Detail Modal */}
            {selectedEmail && (
                <EmailDetailView
                    email={selectedEmail}
                    onClose={() => setSelectedEmail(null)}
                    accessToken={accessToken}
                    isDarkMode={isDarkMode}
                    onAction={() => {
                        setSelectedEmail(null);
                        fetchEmails();
                    }}
                />
            )}

            {/* Floating Monitor - Corner Tab */}
            {!isMonitorOpen && (
                <button
                    onClick={() => setIsMonitorOpen(true)}
                    className="fixed bottom-6 right-6 p-0 w-16 h-16 bg-black/80 backdrop-blur-md rounded-full shadow-2xl hover:scale-110 transition-transform z-50 border border-neon-cyan/50 flex items-center justify-center group"
                    title="Open Monitor"
                >
                    <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse-slow" />
                    <img
                        src="/infinite-club-logo.png"
                        alt="Monitor"
                        className="w-10 h-10 object-contain group-hover:rotate-12 transition-transform"
                    />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-bounce shadow-lg shadow-green-500/50" />
                </button>
            )}

            {/* Floating Monitor Window */}
            {isMonitorOpen && (
                <ProcessWindow
                    activities={activities}
                    analytics={analytics}
                    onClear={handleClearActivity}
                    onDelete={handleDeleteActivity}
                    onClose={() => setIsMonitorOpen(false)}
                    isOpen={isMonitorOpen}
                />
            )}
        </div>
    );
};

export default Dashboard;
