import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { X, Archive, Trash2, Sparkles, Send, Loader2, Wand2, Clock, Mail, Maximize2, Minimize2, Reply, Bold, Italic, Underline, List } from 'lucide-react';
import AIImprovementModal from './AIImprovementModal';

const EmailDetailView = ({ email, onClose, accessToken, onAction, isDarkMode = true }) => {
    const [isGeneratingReply, setIsGeneratingReply] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showReplyBox, setShowReplyBox] = useState(false);
    const [showImprovementModal, setShowImprovementModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [replyMode, setReplyMode] = useState(null);
    const iframeRef = useRef(null);
    const editorRef = useRef(null);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const extractEmail = (fromString) => {
        if (!fromString) return '';
        const match = fromString.match(/<(.+)>/);
        return match ? match[1] : fromString;
    };

    const extractName = (fromString) => {
        if (!fromString) return 'Unknown';
        const match = fromString.match(/^(.+?)\s*</);
        if (match) return match[1].replace(/"/g, '').trim();
        if (fromString.includes('@')) return fromString.split('@')[0];
        return fromString;
    };

    const emailBody = email.fullBody || email.body || email.snippet || '';
    const isHtmlContent = emailBody.includes('<html') || emailBody.includes('<div') || emailBody.includes('<table') || emailBody.includes('<p>') || emailBody.includes('<br');

    useEffect(() => {
        if (iframeRef.current && isHtmlContent) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow.document;

            doc.open();
            doc.write(`<!DOCTYPE html><html><head><style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; font-size: 14px; line-height: 1.6; color: ${isDarkMode ? '#e0e0e0' : '#1f2937'}; background: ${isDarkMode ? '#1a1a1a' : '#ffffff'}; margin: 0; padding: 16px; }
                img { max-width: 100%; height: auto; } a { color: #00d9ff; }
            </style></head><body>${emailBody}</body></html>`);
            doc.close();

            setTimeout(() => {
                if (iframe.contentDocument?.body) {
                    iframe.style.height = Math.max(iframe.contentDocument.body.scrollHeight + 50, 300) + 'px';
                }
            }, 300);
        }
    }, [emailBody, isHtmlContent, isDarkMode]);

    const handleManualReply = () => {
        setReplyMode('manual');
        setShowReplyBox(true);
        setTimeout(() => { if (editorRef.current) editorRef.current.focus(); }, 100);
    };

    const handleGenerateReply = async () => {
        setIsGeneratingReply(true);
        setReplyMode('ai');
        try {
            const response = await axios.post('/api/emails/generate-reply', { emailId: email.id },
                { headers: { Authorization: `Bearer ${accessToken}` } });
            setShowReplyBox(true);
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = response.data.reply.replace(/\n/g, '<br>');
                    editorRef.current.focus();
                }
            }, 100);
        } catch (error) {
            alert('Failed to generate reply');
        } finally {
            setIsGeneratingReply(false);
        }
    };

    const handleSendReply = async () => {
        const replyText = editorRef.current?.innerText?.trim();
        if (!replyText) return alert('Please write a reply');
        setIsSending(true);
        try {
            await axios.post('/api/emails/send', {
                to: extractEmail(email.from),
                subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
                body: replyText,
                threadId: email.threadId
            }, { headers: { Authorization: `Bearer ${accessToken}` } });
            alert('Reply sent!');
            if (onAction) onAction('reply', email.id);
            onClose();
        } catch (error) {
            alert('Failed to send reply');
        } finally {
            setIsSending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this email?')) return;
        try {
            await axios.post('/api/emails/delete', { emailId: email.id }, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (onAction) onAction('delete', email.id);
            onClose();
        } catch (error) { alert('Failed to delete'); }
    };

    const handleArchive = async () => {
        try {
            await axios.post('/api/emails/archive', { emailId: email.id }, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (onAction) onAction('archive', email.id);
            onClose();
        } catch (error) { alert('Failed to archive'); }
    };

    const applyFormat = (command) => {
        document.execCommand(command, false, null);
        editorRef.current?.focus();
    };

    // Theme Helpers
    const glassClass = isDarkMode ? 'glass-panel' : 'bg-white shadow-xl border border-gray-200';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const borderClass = isDarkMode ? 'border-white/10' : 'border-gray-200';
    const bgHeader = isDarkMode ? 'bg-black/40' : 'bg-gray-50';
    const bgActions = isDarkMode ? 'bg-black/20' : 'bg-white';
    const buttonHover = isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';

    return (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/20'}`}>
            <div className={`${glassClass} overflow-y-auto custom-scrollbar transition-all duration-300 ${isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'max-w-4xl w-full max-h-[90vh]'
                } ${!isDarkMode ? 'rounded-2xl' : ''}`}>

                {/* Header - Scrolls with content */}
                <div className={`p-3 border-b ${borderClass} flex items-center justify-between ${bgHeader}`}>
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neon-cyan" />
                        <h2 className={`text-base font-semibold ${textPrimary}`}>Email</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-1.5 rounded-lg ${buttonHover}`}>
                            {isFullscreen ? <Minimize2 className={`w-4 h-4 ${textSecondary}`} /> : <Maximize2 className={`w-4 h-4 ${textSecondary}`} />}
                        </button>
                        <button onClick={onClose} className={`p-1.5 rounded-lg ${buttonHover}`}>
                            <X className={`w-4 h-4 ${textSecondary}`} />
                        </button>
                    </div>
                </div>

                {/* Action Buttons - Scrolls with content */}
                <div className={`p-3 border-b ${borderClass} ${bgActions} flex gap-2 flex-wrap`}>
                    <button onClick={handleManualReply}
                        className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${isDarkMode ? 'glass-panel text-white hover:border-neon-cyan/50' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}>
                        <Reply className="w-4 h-4" /> Reply
                    </button>
                    <button onClick={handleGenerateReply} disabled={isGeneratingReply}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-electric-purple text-white font-medium flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-neon-cyan/20">
                        {isGeneratingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isGeneratingReply ? 'Generating...' : 'AI Reply'}
                    </button>
                    <div className="flex-1" />
                    <button onClick={handleArchive}
                        className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${isDarkMode ? 'glass-panel text-gray-300 hover:border-neon-cyan/50' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}>
                        <Archive className="w-4 h-4" /> Archive
                    </button>
                    <button onClick={handleDelete}
                        className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${isDarkMode ? 'glass-panel text-gray-300 hover:border-red-500/50 hover:text-red-400' : 'bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            }`}>
                        <Trash2 className="w-4 h-4" /> Delete
                    </button>
                </div>

                {/* Main Content - Scrolls with modal */}
                <div className={`${!isDarkMode ? 'bg-white' : ''}`}>
                    {/* Reply Editor - When active */}
                    {showReplyBox && (
                        <div className={`border-b ${borderClass} ${isDarkMode ? 'bg-black/30' : 'bg-gray-50'} flex flex-col`} style={{ minHeight: '350px' }}>
                            <div className={`p-3 border-b ${borderClass} flex items-center justify-between flex-shrink-0`}>
                                <span className={`text-sm font-medium ${isDarkMode ? 'text-neon-cyan' : 'text-blue-600'}`}>
                                    {replyMode === 'ai' ? '✨ AI Reply' : '✏️ Your Reply'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => applyFormat('bold')} className={`p-1.5 rounded ${buttonHover} ${textSecondary} hover:${textPrimary}`} title="Bold">
                                        <Bold className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => applyFormat('italic')} className={`p-1.5 rounded ${buttonHover} ${textSecondary} hover:${textPrimary}`} title="Italic">
                                        <Italic className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => applyFormat('underline')} className={`p-1.5 rounded ${buttonHover} ${textSecondary} hover:${textPrimary}`} title="Underline">
                                        <Underline className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => applyFormat('insertUnorderedList')} className={`p-1.5 rounded ${buttonHover} ${textSecondary} hover:${textPrimary}`} title="Bullet List">
                                        <List className="w-4 h-4" />
                                    </button>
                                    <div className={`w-px h-5 mx-1 ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
                                    <button onClick={() => setShowImprovementModal(true)} className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${buttonHover} ${textSecondary} hover:text-electric-purple`}>
                                        <Wand2 className="w-3 h-3" /> Edit with AI
                                    </button>
                                </div>
                            </div>

                            {/* Rich Text Editor */}
                            <div
                                ref={editorRef}
                                contentEditable
                                className={`flex-1 p-4 text-base leading-relaxed overflow-y-auto focus:outline-none custom-scrollbar ${textPrimary}`}
                                style={{ minHeight: '200px' }}
                                data-placeholder="Type your reply here..."
                            />

                            <div className={`p-3 border-t ${borderClass} flex gap-2 flex-shrink-0`}>
                                <button onClick={handleSendReply} disabled={isSending}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-electric-purple text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {isSending ? 'Sending...' : 'Send Reply'}
                                </button>
                                <button onClick={() => { setShowReplyBox(false); setReplyMode(null); if (editorRef.current) editorRef.current.innerHTML = ''; }}
                                    className={`px-6 py-2.5 rounded-xl font-medium transition-all ${isDarkMode ? 'glass-panel text-gray-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Email Content */}
                    <div className="p-4 space-y-4">
                        {/* Subject */}
                        <h1 className={`text-xl font-bold ${textPrimary}`}>{email.subject || '(No Subject)'}</h1>

                        {/* Sender Info - NO AVATAR, clean */}
                        <div className={`py-2 border-b ${borderClass}`}>
                            <div className={`font-semibold ${textPrimary}`}>{extractName(email.from)}</div>
                            <div className={`text-sm ${textSecondary}`}>{extractEmail(email.from)}</div>
                            <div className={`text-xs ${textSecondary} mt-1 flex items-center gap-1`}>
                                to me • <Clock className="w-3 h-3" /> {formatDate(email.date)}
                            </div>
                        </div>

                        {/* AI Analysis */}
                        {email.aiAnalysis && (
                            <div className={`p-3 rounded-xl border ${isDarkMode ? 'glass-panel border-electric-purple/30' : 'bg-purple-50 border-purple-100'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3 h-3 text-electric-purple" />
                                    <span className="text-xs font-medium text-electric-purple">AI Analysis</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className={`rounded p-2 ${isDarkMode ? 'bg-black/30' : 'bg-white border border-purple-100'}`}>
                                        <p className="text-gray-500">Category</p>
                                        <p className={textPrimary}>{email.aiAnalysis.category || 'General'}</p>
                                    </div>
                                    <div className={`rounded p-2 ${isDarkMode ? 'bg-black/30' : 'bg-white border border-purple-100'}`}>
                                        <p className="text-gray-500">Priority</p>
                                        <p className={`${textPrimary} capitalize`}>{email.aiAnalysis.priority || 'Normal'}</p>
                                    </div>
                                    <div className={`rounded p-2 ${isDarkMode ? 'bg-black/30' : 'bg-white border border-purple-100'}`}>
                                        <p className="text-gray-500">Confidence</p>
                                        <p className={textPrimary}>{Math.round((email.aiAnalysis.confidence || 0.75) * 100)}%</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Email Body */}
                        <div className={`overflow-hidden rounded-xl ${isDarkMode ? 'glass-panel' : 'border border-gray-200'}`}>
                            {isHtmlContent ? (
                                <iframe ref={iframeRef} title="Email" className="w-full border-0" style={{ minHeight: '300px', background: isDarkMode ? '#1a1a1a' : '#ffffff' }} sandbox="allow-same-origin" />
                            ) : (
                                <div className={`p-4 leading-relaxed whitespace-pre-wrap ${textPrimary}`}>{emailBody || 'No content'}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AIImprovementModal isOpen={showImprovementModal} onClose={() => setShowImprovementModal(false)}
                currentReply={editorRef.current?.innerText || ''} emailContext={email.snippet || ''} accessToken={accessToken}
                onImproved={(improved) => { if (editorRef.current) editorRef.current.innerHTML = improved.replace(/\n/g, '<br>'); }}
            />

            <style>{`
                [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                }
            `}</style>
        </div>
    );
};

export default EmailDetailView;
