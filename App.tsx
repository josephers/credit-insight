import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquareText, FileText, ChevronRight, X, AlertCircle, Settings, ArrowLeft } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { ChatView } from './components/ChatView';
import { TermsManager } from './components/TermsManager';
import { Dashboard } from './components/Dashboard';
import { DEFAULT_TERMS } from './constants';
import { AppView, UploadedFile, StandardTerm, DealSession } from './types';
import { getAllSessions, saveSession, deleteSessionById } from './services/db';

function App() {
  // Global State
  const [sessions, setSessions] = useState<DealSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  
  // Settings State
  const [terms, setTerms] = useState<StandardTerm[]>(DEFAULT_TERMS);
  
  // UI State
  const [showDocPreview, setShowDocPreview] = useState(true);

  // Derived State
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Load from DB on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedSessions = await getAllSessions();
        setSessions(loadedSessions);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setIsLoadingDB(false);
      }
    };
    loadData();
  }, []);

  // Handlers
  const handleFileSelect = async (uploadedFile: UploadedFile) => {
    const newSession: DealSession = {
      id: Date.now().toString(),
      borrowerName: 'New Borrower', // Default until extraction
      file: uploadedFile,
      extractionResults: [],
      benchmarkResults: [],
      chatHistory: [],
      lastModified: new Date()
    };
    
    // Save to State
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setCurrentView(AppView.ANALYSIS);
    
    // Persist to DB
    await saveSession(newSession);
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentView(AppView.ANALYSIS);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this deal session?')) {
      // Update UI immediately
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setCurrentView(AppView.DASHBOARD);
      }
      // Update DB
      await deleteSessionById(sessionId);
    }
  };

  const handleUpdateActiveSession = async (updates: Partial<DealSession>) => {
    if (!activeSessionId) return;

    // Use a functional update to get the latest state and find the session to update
    setSessions(prev => {
      const updatedSessions = prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedSession = { ...s, ...updates, lastModified: new Date() };
          // Fire and forget save to DB
          saveSession(updatedSession).catch(err => console.error("Failed to autosave:", err));
          return updatedSession;
        }
        return s;
      });
      return updatedSessions;
    });
  };

  const handleCloseSession = () => {
    setActiveSessionId(null);
    setCurrentView(AppView.DASHBOARD);
  };

  // Render logic
  const renderContent = () => {
    if (isLoadingDB) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4">
             <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
             <p className="text-slate-500 font-medium">Loading Portfolio...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case AppView.DASHBOARD:
        return (
          <Dashboard 
            sessions={sessions}
            onSelectSession={handleSessionSelect}
            onNewAnalysis={() => setCurrentView(AppView.UPLOAD)}
            onManageTerms={() => setCurrentView(AppView.TERMS)}
            onDeleteSession={handleDeleteSession}
          />
        );
      
      case AppView.UPLOAD:
        return (
          <div className="h-full relative">
             <button 
               onClick={() => setCurrentView(AppView.DASHBOARD)}
               className="absolute top-6 left-6 z-20 p-2 bg-white rounded-full shadow-md text-slate-500 hover:text-slate-800 transition-colors"
             >
               <ArrowLeft className="w-5 h-5" />
             </button>
             <FileUpload 
               onFileSelect={handleFileSelect} 
               onManageTerms={() => setCurrentView(AppView.TERMS)} 
             />
          </div>
        );
        
      case AppView.TERMS:
        return (
          <TermsManager 
            terms={terms} 
            setTerms={setTerms} 
            onBack={() => activeSession ? setCurrentView(AppView.ANALYSIS) : setCurrentView(AppView.DASHBOARD)} 
          />
        );
        
      case AppView.ANALYSIS:
        if (!activeSession) return null;
        return (
          <AnalysisView 
            file={activeSession.file} 
            terms={terms} 
            setTerms={setTerms} 
            results={activeSession.extractionResults}
            setResults={(results) => handleUpdateActiveSession({ extractionResults: typeof results === 'function' ? results(activeSession.extractionResults) : results })}
            borrowerName={activeSession.borrowerName}
            onUpdateBorrowerName={(name) => handleUpdateActiveSession({ borrowerName: name })}
            benchmarkResults={activeSession.benchmarkResults}
            setBenchmarkResults={(results) => handleUpdateActiveSession({ benchmarkResults: typeof results === 'function' ? results(activeSession.benchmarkResults) : results })}
            webFinancials={activeSession.webFinancials}
            setWebFinancials={(data) => handleUpdateActiveSession({ webFinancials: data })}
          />
        );
        
      case AppView.CHAT:
        if (!activeSession) return null;
        return (
          <ChatView 
            file={activeSession.file}
            history={activeSession.chatHistory}
            setHistory={(history) => handleUpdateActiveSession({ chatHistory: typeof history === 'function' ? history(activeSession.chatHistory) : history })}
            borrowerName={activeSession.borrowerName}
          />
        );
      default:
        return null;
    }
  };

  // No active session means we are in Dashboard, Upload, or Terms (from Dashboard)
  if (!activeSession) {
    return (
      <div className="h-full w-full bg-slate-50">
        {renderContent()}
      </div>
    );
  }

  // Active Session Layout
  const isPreviewable = activeSession.file.type === 'application/pdf' || 
                        activeSession.file.type === 'text/plain' || 
                        activeSession.file.type === 'text/html';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      
      {/* Sidebar Navigation */}
      <div className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 flex-shrink-0 shadow-lg">
        <div 
          onClick={() => setCurrentView(AppView.DASHBOARD)}
          className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center mb-4 shadow-brand-glow cursor-pointer hover:bg-brand-500 transition-colors"
          title="Back to Dashboard"
        >
          <FileText className="text-white w-6 h-6" />
        </div>
        
        <button
          onClick={() => setCurrentView(AppView.ANALYSIS)}
          className={`p-3 rounded-xl transition-all group relative ${
            currentView === AppView.ANALYSIS 
              ? 'bg-white/10 text-brand-400' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Analysis Dashboard"
        >
          <LayoutDashboard className="w-6 h-6" />
          {currentView === AppView.ANALYSIS && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full -ml-3"></div>
          )}
        </button>

        <button
          onClick={() => setCurrentView(AppView.CHAT)}
          className={`p-3 rounded-xl transition-all group relative ${
            currentView === AppView.CHAT 
              ? 'bg-white/10 text-brand-400' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="AI Chat"
        >
          <MessageSquareText className="w-6 h-6" />
          {currentView === AppView.CHAT && (
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full -ml-3"></div>
          )}
        </button>

        <button
          onClick={() => setCurrentView(AppView.TERMS)}
          className={`p-3 rounded-xl transition-all group relative ${
            currentView === AppView.TERMS 
              ? 'bg-white/10 text-brand-400' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Manage Terms"
        >
          <Settings className="w-6 h-6" />
          {currentView === AppView.TERMS && (
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full -ml-3"></div>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Workspace */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showDocPreview && currentView !== AppView.TERMS ? 'w-1/2' : 'w-full'}`}>
           {renderContent()}
        </div>

        {/* Resizer / Toggle (Only show if not in Terms view) */}
        {currentView !== AppView.TERMS && (
          <button 
             onClick={() => setShowDocPreview(!showDocPreview)}
             className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 shadow-md p-1 rounded-l-md hover:bg-slate-50 text-slate-500"
             style={{ right: showDocPreview ? '50%' : '0' }}
          >
            {showDocPreview ? <ChevronRight className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
        )}

        {/* Document Preview Panel (Only show if not in Terms view) */}
        {showDocPreview && currentView !== AppView.TERMS && (
          <div className="w-1/2 bg-slate-200 border-l border-slate-300 h-full relative shadow-inner">
            {isPreviewable ? (
              <iframe 
                src={`data:${activeSession.file.type};base64,${activeSession.file.data}`} 
                className="w-full h-full bg-white" 
                title="Document Preview"
              />
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                 <FileText className="w-16 h-16 mb-4 text-slate-400" />
                 <h3 className="text-xl font-semibold text-slate-700">Word Document Preview</h3>
                 <p className="max-w-xs mt-2 text-sm">
                   Browser preview is limited for Word files. The AI can still read and analyze the content fully.
                 </p>
                 <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded">
                     <AlertCircle className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                     <p className="font-medium text-slate-900 text-sm">Analysis Active</p>
                     <p className="text-xs text-slate-500">Gemini is processing {activeSession.file.name}</p>
                   </div>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;