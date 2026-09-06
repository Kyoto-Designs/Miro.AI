import React, { useState, useEffect, useRef } from 'react';
import {
Menu, X, MessageSquare, Plus, Settings, Trash2, Send, Square,
ChevronDown, Copy, Check, Info, Command
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// -----------------------------------------------------------------------------
// CONFIGURATION & CONSTANTS
// -----------------------------------------------------------------------------
const MODELS = [
{ id: 'Qwen3.5 Omni Plus', desc: 'General-purpose multimodal assistant' },
{ id: 'Qwen3 Coder Plus', desc: 'Specialized coding & technical assistant' },
{ id: 'Qwen3.8 Max', desc: 'High-capability general reasoning model' }
];
const MODES = [
{ id: 'MIRO', label: 'MIRO', desc: 'General Assistant' },
{ id: 'CastleWizard', label: 'CastleWizard', desc: 'Castle Make & Play' },
{ id: 'Bloxxer', label: 'Bloxxer', desc: 'Roblox Gameplay' },
{ id: 'BloxxerBuild', label: 'BloxxerBuild', desc: 'Roblox Studio & Luau' },
{ id: 'AimMiro', label: 'AimMiro', desc: 'FPS Strategy & Aim' }
];
const PERSONALITIES = [
'Balanced', 'Friendly', 'Professional', 'Technical',
'Creative', 'Concise', 'Tutor', 'Expert'
];
const API_URL = import.meta.env.VITE_BACKEND_URL
? ⁠${import.meta.env.VITE_BACKEND_URL}/api/chat⁠
: 'http://localhost:3001/api/chat';
// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
const generateId = () => Math.random().toString(36).substring(2, 9);
const getInitialState = (key, defaultValue) => {
const saved = localStorage.getItem(key);
return saved ? JSON.parse(saved) : defaultValue;
};
// -----------------------------------------------------------------------------
// COMPONENTS
// -----------------------------------------------------------------------------
// Copy Button Component for Code Blocks
const CopyButton = ({ text }) => {
const [copied, setCopied] = useState(false);
const handleCopy = () => {
navigator.clipboard.writeText(text);
setCopied(true);
setTimeout(() => setCopied(false), 2000);
};
return (
<button 
onClick={handleCopy} 
className="p-1 hover:bg-zinc-700 rounded transition-colors flex items-center gap-1 text-xs text-zinc-300"
aria-label="Copy code"
>
{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
{copied ? 'Copied' : 'Copy'}
</button>
);
};
export default function App() {
// State: Preferences
const [prefs, setPrefs] = useState(() => getInitialState('miro_prefs', {
defaultModel: 'Qwen3.5 Omni Plus',
defaultMode: 'MIRO',
defaultPersonality: 'Balanced',
enterToSend: true
}));
// State: Active Session Config
const [currentModel, setCurrentModel] = useState(prefs.defaultModel);
const [currentMode, setCurrentMode] = useState(prefs.defaultMode);
const [currentPersonality, setCurrentPersonality] = useState(prefs.defaultPersonality);
// State: Conversations
const [conversations, setConversations] = useState(() => getInitialState('miro_chats', []));
const [activeChatId, setActiveChatId] = useState(null);
// State: UI & Input
const [inputMessage, setInputMessage] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [error, setError] = useState(null);
// Refs
const messagesEndRef = useRef(null);
const textareaRef = useRef(null);
const abortControllerRef = useRef(null);
// Save state on change
useEffect(() => localStorage.setItem('miro_prefs', JSON.stringify(prefs)), [prefs]);
useEffect(() => localStorage.setItem('miro_chats', JSON.stringify(conversations)), [conversations]);
// Auto-scroll
const scrollToBottom = () => {
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};
useEffect(scrollToBottom, [conversations, activeChatId]);
// Derived active chat
const activeChat = conversations.find(c => c.id === activeChatId);
const currentMessages = activeChat ? activeChat.messages : [];
// Actions: Chats
const startNewChat = () => {
setCurrentModel(prefs.defaultModel);
setCurrentMode(prefs.defaultMode);
setCurrentPersonality(prefs.defaultPersonality);
setActiveChatId(null);
setSidebarOpen(false);
setError(null);
};
const deleteChat = (e, id) => {
e.stopPropagation();
const filtered = conversations.filter(c => c.id !== id);
setConversations(filtered);
if (activeChatId === id) setActiveChatId(null);
};
const stopGeneration = () => {
if (abortControllerRef.current) {
abortControllerRef.current.abort();
abortControllerRef.current = null;
setIsGenerating(false);
}
};
// Chat API call logic
const handleSend = async () => {
if (!inputMessage.trim() || isGenerating) return;
let chatId = activeChatId;
let newConversations = [...conversations];
// Create new chat if empty
if (!chatId) {
chatId = generateId();
const newChat = {
id: chatId,
title: inputMessage.slice(0, 30) + '...',
updatedAt: Date.now(),
model: currentModel,
mode: currentMode,
personality: currentPersonality,
messages: []
};
newConversations.unshift(newChat);
setActiveChatId(chatId);
}
const chatIndex = newConversations.findIndex(c => c.id === chatId);
const userMsg = { role: 'user', content: inputMessage.trim(), id: generateId() };
newConversations[chatIndex].messages.push(userMsg);
newConversations[chatIndex].updatedAt = Date.now();
setConversations(newConversations);
setInputMessage('');
setError(null);
setIsGenerating(true);
// Reset textarea height
if (textareaRef.current) textareaRef.current.style.height = 'auto';
// Prepare assistant placeholder
const assistantMsgId = generateId();
newConversations[chatIndex].messages.push({ role: 'assistant', content: '', id: assistantMsgId });
setConversations([...newConversations]);
abortControllerRef.current = new AbortController();
try {
const response = await fetch(API_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
signal: abortControllerRef.current.signal,
body: JSON.stringify({
messages: newConversations[chatIndex].messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
model: currentModel,
mode: currentMode,
personality: currentPersonality
})
});
if (!response.ok) {
const errorData = await response.json().catch(() => ({}));
throw new Error(errorData.error || 'Network response was not ok');
}
const reader = response.body.getReader();
const decoder = new TextDecoder('utf-8');
let done = false;
let text = '';
while (!done) {
const { value, done: doneReading } = await reader.read();
done = doneReading;
if (value) {
// A rudimentary SSE parser for standard OpenAI stream chunk format
const chunk = decoder.decode(value, { stream: true });
const lines = chunk.split('\n');
for (const line of lines) {
if (line.startsWith('data: ') && line !== 'data: [DONE]') {
try {
const data = JSON.parse(line.slice(6));
if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
text += data.choices[0].delta.content;
// Update state incrementally
setConversations(prev => {
const updated = [...prev];
const idx = updated.findIndex(c => c.id === chatId);
if (idx > -1) {
const mIdx = updated[idx].messages.findIndex(m => m.id === assistantMsgId);
if (mIdx > -1) {
updated[idx].messages[mIdx].content = text;
}
}
return updated;
});
}
} catch (e) {
// Ignore parse errors on split chunks, wait for buffer to complete
}
}
}
}
}
} catch (err) {
if (err.name !== 'AbortError') {
setError(err.message || 'MIRO couldn’t complete that request. Please try again.');
// Remove the empty assistant message
setConversations(prev => {
const updated = [...prev];
const idx = updated.findIndex(c => c.id === chatId);
if (idx > -1) {
updated[idx].messages = updated[idx].messages.filter(m => m.id !== assistantMsgId);
}
return updated;
});
}
} finally {
setIsGenerating(false);
abortControllerRef.current = null;
}
};
const handleKeyDown = (e) => {
if (e.key === 'Enter' && !e.shiftKey && prefs.enterToSend) {
e.preventDefault();
handleSend();
}
};
const autoResize = (e) => {
e.target.style.height = 'auto';
e.target.style.height = ⁠${Math.min(e.target.scrollHeight, 200)}px⁠;
};
// -----------------------------------------------------------------------------
// RENDER: COMPONENTS
// -----------------------------------------------------------------------------
const MarkdownComponents = {
code({node, inline, className, children, ...props}) {
const match = /language-(\w+)/.exec(className || '');
const codeString = String(children).replace(/\n$/, '');
return !inline && match ? (
<div className="relative group rounded-md overflow-hidden my-4 border border-zinc-800 bg-zinc-950">
<div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
<span>{match[1]}</span>
<CopyButton text={codeString} />
</div>
<SyntaxHighlighter
style={vscDarkPlus}
language={match[1]}
PreTag="div"
customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
{...props}
>
{codeString}
</SyntaxHighlighter>
</div>
) : (
<code className="bg-zinc-800 text-purple-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
{children}
</code>
);
}
};
return (
<div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden antialiased selection:bg-purple-900 selection:text-white">
{/* SIDEBAR (Desktop: fixed width, Mobile: slide-in drawer) */}
<div className={⁠fixed inset-y-0 left-0 z-40 w-72 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0⁠}>
<div className="p-4 flex items-center justify-between">
<div className="flex items-center gap-2 font-bold text-lg tracking-wide">
<div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center text-sm">M</div>
MIRO.AI
</div>
<button className="md:hidden text-zinc-400 p-1" onClick={() => setSidebarOpen(false)}>
<X size={20} />
</button>
</div>
<div className="px-3 pb-3">
<button 
onClick={startNewChat}
className="w-full flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
>
<Plus size={16} /> New Chat
</button>
</div>
<div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
<div className="text-xs font-semibold text-zinc-500 mb-2 px-2 uppercase tracking-wider">History</div>
{conversations.length === 0 ? (
<div className="text-zinc-600 text-sm px-2 py-4">No conversations yet.</div>
) : (
conversations.map(chat => (
<div
key={chat.id}
onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
className={⁠group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${activeChatId === chat.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}⁠}
>
<div className="flex items-center gap-2 overflow-hidden">
<MessageSquare size={14} className="shrink-0" />
<span className="truncate">{chat.title}</span>
</div>
<button
onClick={(e) => deleteChat(e, chat.id)}
className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
aria-label="Delete chat"
>
<Trash2 size={14} />
</button>
</div>
))
)}
</div>
<div className="p-4 border-t border-zinc-900">
<button
onClick={() => setSettingsOpen(true)}
className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium w-full p-2 rounded-lg hover:bg-zinc-900"
>
<Settings size={16} /> Settings
</button>
</div>
</div>
{/* MOBILE OVERLAY */}
{sidebarOpen && (
<div
className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
onClick={() => setSidebarOpen(false)}
/>
)}
{/* MAIN CONTENT AREA */}
<div className="flex-1 flex flex-col min-w-0 h-full relative">
{/* HEADER */}
<header className="h-14 flex items-center justify-between px-4 border-b border-zinc-900/50 bg-black/80 backdrop-blur shrink-0 z-10">
<div className="flex items-center gap-2 md:gap-4">
<button className="md:hidden text-zinc-400" onClick={() => setSidebarOpen(true)}>
<Menu size={20} />
</button>
{!activeChatId ? (
<div className="flex items-center gap-2 md:gap-4">
{/* Mode Selector */}
<div className="relative group">
<select
value={currentMode}
onChange={(e) => setCurrentMode(e.target.value)}
className="appearance-none bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:border-brand-accent cursor-pointer"
>
{MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
</select>
<ChevronDown size={14} className="absolute right-2.5 top-2.5 text-zinc-500 pointer-events-none" />
</div>
{/* Model Selector */}
<div className="relative group hidden sm:block">
<select
value={currentModel}
onChange={(e) => setCurrentModel(e.target.value)}
className="appearance-none bg-zinc-950 border border-zinc-800 text-zinc-400 text-sm rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:border-brand-accent cursor-pointer max-w-[150px] truncate"
>
{MODELS.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
</select>
<ChevronDown size={14} className="absolute right-2.5 top-2.5 text-zinc-600 pointer-events-none" />
</div>
</div>
) : (
<div className="flex flex-col">
<span className="text-sm font-medium">{activeChat?.mode || 'MIRO'}</span>
<span className="text-xs text-zinc-500">{activeChat?.model}</span>
</div>
)}
</div>
</header>
{/* CHAT AREA */}
<div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar relative">
{!activeChatId || currentMessages.length === 0 ? (
<div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6">
<div className="w-16 h-16 bg-brand-purple rounded-2xl flex items-center justify-center border border-brand-accent/30 shadow-[0_0_30px_rgba(157,78,221,0.15)]">
<div className="text-3xl font-bold text-white">M</div>
</div>
<div>
<h1 className="text-2xl font-bold mb-2">Welcome to MIRO.AI</h1>
<p className="text-zinc-400 text-sm">Your intelligent workspace.</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg mt-8">
{MODES.filter(m => m.id !== 'MIRO').slice(0, 4).map((mode) => (
<button
key={mode.id}
onClick={() => { setCurrentMode(mode.id); document.querySelector('textarea').focus(); }}
className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all text-left flex flex-col gap-1"
>
<span className="text-sm font-medium text-white">{mode.label}</span>
<span className="text-xs text-zinc-500">{mode.desc}</span>
</button>
))}
</div>
</div>
) : (
<div className="max-w-3xl mx-auto space-y-6 pb-20">
{currentMessages.map((msg) => (
<div key={msg.id} className={⁠flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}⁠}>
{msg.role === 'assistant' && (
<div className="w-8 h-8 rounded-md bg-brand-purple border border-brand-accent/30 flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm">
<span className="text-xs font-bold text-brand-light">M</span>
</div>
)}
<div className={⁠max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl ${msg.role === 'user'  ? 'bg-zinc-900 text-white rounded-br-sm'  : 'bg-transparent text-zinc-100 markdown-body'}⁠}>
{msg.role === 'user' ? (
<div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
) : (
<ReactMarkdown 
remarkPlugins={[remarkGfm]}
components={MarkdownComponents}
className="text-sm leading-relaxed space-y-4"
>
{msg.content || '...'}
</ReactMarkdown>
)}
</div>
</div>
))}
{error && (
<div className="bg-red-950/40 border border-red-900/50 text-red-200 text-sm px-4 py-3 rounded-xl max-w-2xl mx-auto flex gap-3 items-center">
<Info size={16} className="shrink-0 text-red-400" />
<p>{error}</p>
</div>
)}
<div ref={messagesEndRef} className="h-4" />
</div>
)}
</div>
{/* COMPOSER */}
<div className="p-4 bg-gradient-to-t from-black via-black to-transparent shrink-0">
<div className="max-w-3xl mx-auto relative group">
<textarea
ref={textareaRef}
value={inputMessage}
onChange={(e) => { setInputMessage(e.target.value); autoResize(e); }}
onKeyDown={handleKeyDown}
placeholder={isGenerating ? "MIRO is thinking..." : "Message MIRO..."}
disabled={isGenerating}
rows={1}
className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-zinc-700 focus:bg-zinc-800/80 transition-all resize-none overflow-hidden text-sm disabled:opacity-50"
style={{ minHeight: '52px', maxHeight: '200px' }}
/>
<div className="absolute right-2 bottom-2">
{isGenerating ? (
<button 
onClick={stopGeneration}
className="p-2 bg-zinc-800 text-red-400 rounded-xl hover:bg-zinc-700 transition-colors shadow-sm"
aria-label="Stop generation"
>
<Square size={16} fill="currentColor" />
</button>
) : (
<button
onClick={handleSend}
disabled={!inputMessage.trim()}
className={⁠p-2 rounded-xl transition-all shadow-sm flex items-center justify-center ${inputMessage.trim()  ? 'bg-white text-black hover:bg-zinc-200'  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}⁠}
aria-label="Send message"
>
<Send size={16} />
</button>
)}
</div>
</div>
<div className="max-w-3xl mx-auto mt-2 text-center text-[10px] text-zinc-600 hidden md:flex items-center justify-center gap-1">
MIRO can make mistakes. Consider verifying technical information. <Command size={10} className="ml-2"/>+ Enter to send
</div>
</div>
</div>
{/* SETTINGS MODAL */}
{settingsOpen && (
<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
<div className="flex items-center justify-between p-4 border-b border-zinc-900">
<h2 className="text-lg font-semibold">Settings</h2>
<button onClick={() => setSettingsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
<X size={20} />
</button>
</div>
<div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
{/* Default Configuration */}
<div className="space-y-4">
<h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">AI Defaults</h3>
<div className="space-y-1.5">
<label className="text-sm text-zinc-300">Default Model</label>
<select
value={prefs.defaultModel}
onChange={(e) => setPrefs({...prefs, defaultModel: e.target.value})}
className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-lg p-2.5 focus:border-brand-accent outline-none"
>
{MODELS.map(m => <option key={m.id} value={m.id}>{m.id} - {m.desc}</option>)}
</select>
</div>
<div className="space-y-1.5">
<label className="text-sm text-zinc-300">Default Mode</label>
<select
value={prefs.defaultMode}
onChange={(e) => setPrefs({...prefs, defaultMode: e.target.value})}
className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-lg p-2.5 focus:border-brand-accent outline-none"
>
{MODES.map(m => <option key={m.id} value={m.id}>{m.label} ({m.desc})</option>)}
</select>
</div>
<div className="space-y-1.5">
<label className="text-sm text-zinc-300">Personality Type</label>
<select
value={prefs.defaultPersonality}
onChange={(e) => setPrefs({...prefs, defaultPersonality: e.target.value})}
className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-lg p-2.5 focus:border-brand-accent outline-none"
>
{PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
</select>
</div>
</div>
{/* Chat Preferences */}
<div className="space-y-4 pt-4 border-t border-zinc-900">
<h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Chat Preferences</h3>
<label className="flex items-center justify-between cursor-pointer group">
<span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Press Enter to send</span>
<div className={⁠w-10 h-5 rounded-full transition-colors relative ${prefs.enterToSend ? 'bg-brand-accent' : 'bg-zinc-800'}⁠}>
<input
type="checkbox"
className="sr-only"
checked={prefs.enterToSend}
onChange={(e) => setPrefs({...prefs, enterToSend: e.target.checked})}
/>
<div className={⁠absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${prefs.enterToSend ? 'translate-x-5' : 'translate-x-0'}⁠} />
</div>
</label>
</div>
{/* Data & About */}
<div className="space-y-4 pt-4 border-t border-zinc-900">
<h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Data</h3>
<button
onClick={() => {
if (window.confirm('Clear all local conversations?')) {
setConversations([]);
setActiveChatId(null);
}
}}
className="w-full py-2.5 px-4 bg-red-950/20 text-red-400 text-sm border border-red-900/30 rounded-lg hover:bg-red-900/30 transition-colors"
>
Clear all conversations
</button>
</div>
</div>
</div>
</div>
)}
{/* GLOBAL STYLES FOR MARKDOWN/SCROLLBAR */}
<style dangerouslySetInnerHTML={{__html: `
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
.markdown-body h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
.markdown-body h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; margin-top: 1.5rem; }
.markdown-body h3 { font-size: 1.125rem; font-weight: bold; margin-bottom: 0.5rem; margin-top: 1rem; }
.markdown-body p { margin-bottom: 0.75rem; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
.markdown-body ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
.markdown-body li { margin-bottom: 0.25rem; }
.markdown-body a { color: #9d4edd; text-decoration: underline; text-underline-offset: 2px; }
.markdown-body a:hover { color: #e0aaff; }
.markdown-body blockquote { border-left: 3px solid #3f3f46; padding-left: 1rem; color: #a1a1aa; font-style: italic; }
.markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
.markdown-body th, .markdown-body td { border: 1px solid #3f3f46; padding: 0.5rem; text-align: left; }
.markdown-body th { background-color: #18181b; }
`}} />
</div>
);
}
