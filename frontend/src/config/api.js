// API Configuration
// In production, use VITE_API_URL env variable
// In development, uses Vite proxy (relative URLs work)

const API_BASE = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
    // Auth
    authUrl: `${API_BASE}/auth/url`,
    authRefresh: `${API_BASE}/auth/refresh`,

    // Emails
    emails: `${API_BASE}/api/emails`,
    autoReplies: `${API_BASE}/api/auto-replies/history`,
    bulkDelete: `${API_BASE}/api/emails/bulk-delete`,

    // Auto Reply
    autoReplyToggle: `${API_BASE}/api/auto-reply/toggle`,
    autoReplyAnalytics: `${API_BASE}/api/auto-reply/analytics`,
    autoRepliesReset: `${API_BASE}/api/auto-replies/reset`,

    // Analytics & Activity
    activity: `${API_BASE}/api/activity`,
    analytics: `${API_BASE}/api/analytics`,
    analyticsRealtime: `${API_BASE}/api/analytics/realtime`,

    // User
    userProfile: `${API_BASE}/api/user/profile`,
    labelsCounts: `${API_BASE}/api/labels/counts`,
};

export default API_BASE;
