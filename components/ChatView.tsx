import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, AlertTriangle, FileText, Sparkles, MessageSquare, Search, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { UploadedFile, ChatMessage, AIProvider, DealSession } from '../types';
import { sendChatMessage } from '../services/aiService';
import { SUGGESTED_QUESTIONS } from '../constants';

interface ChatViewProps {
  sessions: DealSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onUpdateHistory: (sessionId: string, historyFn: (prev: ChatMessage[]) => ChatMessage[]) => void;
  aiProvider: AIProvider;
}

export const ChatView: React.FC<ChatViewProps> = ({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onUpdateHistory, 
  aiProvider 
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const history = activeSession?.chatHistory || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, activeSessionId]);

  const handleSend = async (textInput?: string) => {
    if (!activeSession) return;
    const messageText = textInput || input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date()
    };

    // Optimistic Update: Update history using the callback prop
    onUpdateHistory(activeSession.id, (prev) => [...prev, userMsg]);
    
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(
        activeSession.file.data, 
        activeSession.file.type, 
        [...history, userMsg], // Pass current history + new message context
        userMsg.text, 
        aiProvider
      );
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      
      onUpdateHistory(activeSession.id, (prev) => [...prev, botMsg]);

    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Error (${aiProvider}): I encountered an issue analyzing the document. Please check your keys or switch providers.`,
        timestamp: new Date(),
        isError: true
      };
      onUpdateHistory(activeSession.id, (prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!activeSession) return;
    if (confirm('Are you sure you want to clear the chat history for this deal? This action cannot be undone.')) {
      onUpdateHistory(activeSession.id, () => []);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar - Deal List */}
      <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200">
           <h2 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-brand-600" />
             Chats
           </h2>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search deals..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
             />
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.length === 0 && (
            <div className="text-center p-4 text-slate-400 text-sm">
              No deals found.
            </div>
          )}
          {filteredSessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                activeSessionId === session.id 
                  ? 'bg-white shadow-sm border border-brand-100 ring-1 ring-brand-100' 
                  : 'hover:bg-slate-100 border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                activeSessionId === session.id ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${
                   activeSessionId === session.id ? 'text-slate-800' : 'text-slate-600'
                }`}>
                  {session.borrowerName}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {session.chatHistory.length > 0 
                    ? `${session.chatHistory.length} messages` 
                    : 'Start conversation'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {activeSession ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                   <h2 className="font-bold text-slate-800">{activeSession.borrowerName}</h2>
                   <p className="text-xs text-slate-500 flex items-center gap-1">
                     Analyzed by {aiProvider === 'azure' ? 'Azure OpenAI' : 'Gemini'}
                   </p>
                </div>
              </div>
              
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear Chat History"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                  <Bot className="w-16 h-16 text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Credit Analyst AI</h3>
                  <p className="text-slate-500 max-w-md mt-2 mb-8">
                    I can help you audit definitions, check for leakage, summarize baskets, and compare terms.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="p-3 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all text-left flex items-start gap-2 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-400" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                      msg.role === 'user' ? 'bg-slate-700 text-white' : 'bg-brand-600 text-white'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    
                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-slate-800 text-white rounded-tr-none' 
                          : msg.isError 
                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}>
                        {msg.isError && <AlertTriangle className="w-4 h-4 inline mr-2 mb-0.5" />}
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:bg-slate-100 prose-pre:p-2 prose-code:text-brand-600">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start w-full">
                  <div className="flex items-center gap-3 ml-1">
                     <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center">
                       <Bot className="w-5 h-5" />
                     </div>
                     <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-1.5">
                       <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                       <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                       <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                     </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="relative max-w-4xl mx-auto flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-xl p-2 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all shadow-sm">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask a question about ${activeSession.borrowerName}...`}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-slate-800 placeholder:text-slate-400 text-sm"
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-lg mb-0.5 transition-all ${
                    input.trim() && !isLoading 
                      ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50">
            <MessageSquare className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium">Select a deal to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};