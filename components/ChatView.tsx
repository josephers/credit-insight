import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { UploadedFile, ChatMessage, AIProvider } from '../types';
import { sendChatMessage } from '../services/aiService';
import { SUGGESTED_QUESTIONS } from '../constants';

interface ChatViewProps {
  file: UploadedFile;
  history: ChatMessage[];
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  borrowerName: string;
  aiProvider: AIProvider;
}

export const ChatView: React.FC<ChatViewProps> = ({ file, history, setHistory, borrowerName, aiProvider }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSend = async (textInput?: string) => {
    const messageText = textInput || input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date()
    };

    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(file.data, file.type, history, userMsg.text, aiProvider);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setHistory(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Error (${aiProvider}): I encountered an issue analyzing the document. Please check your keys or switch providers.`,
        timestamp: new Date(),
        isError: true
      };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex items-center gap-3">
        <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
          <FileText className="w-5 h-5" />
        </div>
        <div>
           <h2 className="font-bold text-slate-800">Analyst Q&A: {borrowerName}</h2>
           <p className="text-xs text-slate-500">Ask complex queries about {file.name} using {aiProvider === 'azure' ? 'Azure OpenAI' : 'Gemini'}</p>
        </div>
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
            placeholder={`Ask a question about ${borrowerName}...`}
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
    </div>
  );
};