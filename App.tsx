import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, MessageSquareText, FileText, ChevronRight, X, AlertCircle, Settings, ArrowLeft, LayoutGrid, Scale } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { ChatView } from './components/ChatView';
import { TermsManager } from './components/TermsManager';
import { BenchmarkManager } from './components/BenchmarkManager';
import { Dashboard } from './components/Dashboard';
import { MatrixView } from './components/MatrixView';
import { DEFAULT_TERMS, MARKET_BENCHMARK, MAX_FILE_SIZE_MB } from './constants';
import { AppView, UploadedFile, StandardTerm, DealSession, BenchmarkData } from './types';
import { getAllSessions, saveSession, deleteSessionById } from './services/db';
import { getSettings, saveSettings } from './services/settings';
import { extractAndBenchmark } from './services/geminiService';

function App() {
  // Global State
  const [sessions, setSessions] = useState<DealSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  
  // Settings State
  const [terms, setTerms] = useState<StandardTerm[]>(DEFAULT_TERMS);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData>(MARKET_BENCHMARK);
  
  // UI State
  const [showDocPreview, setShowDocPreview] = useState(true);

  // Derived State
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const refreshSessions = useCallback(async () => {
    setIsLoadingDB(true);
    try {
      const loadedSessions = await getAllSessions();
      setSessions(loadedSessions);
      
      const loadedSettings = await getSettings();
      setTerms(loadedSettings.terms);
      setBenchmarks(loadedSettings.benchmarks);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoadingDB(false);
    }
  }, []);

  // Load from DB on Mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Persist Settings when changed (Debounced implicitly by user action usually, but here we just save on update)
  useEffect(() => {
    // Avoid saving initial load if it's just defaults, but simple save is fine
    if (!isLoadingDB) {
       saveSettings({ terms, benchmarks });
    }
  }, [terms, benchmarks, isLoadingDB]);

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

  /**
   * Special handler for Matrix view drag-and-drop.
   * Uploads, Extracts, Benchmarks, and Saves automatically.
   */
  const handleMatrixFileAnalyze = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = (e.target?.result as string).split(',')[1];
          
          let mimeType = file.type;
          const lowerName = file.name.toLowerCase();
          if (mimeType === 'multipart/related' || !mimeType) mimeType = 'text/html';
          if (lowerName.endsWith('.txt')) mimeType = 'text/plain';
          else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerName.endsWith('.mhtml')) mimeType = 'text/html';
          else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';

          const uploadedFile: UploadedFile = {
            name: file.name,
            type: mimeType || 'text/plain',
            data: base64String,
            size: file.size
          };

          // 1. Create Session
          const newSession: DealSession = {
            id: Date.now().toString(),
            borrowerName: 'Analyzing...',
            file: uploadedFile,
            extractionResults: [],
            benchmarkResults: [],
            chatHistory: [],
            lastModified: new Date()
          };

          // 2. Extract Terms AND Benchmark (One Shot) - PASSING DYNAMIC BENCHMARKS
          const { extraction, benchmarking } = await extractAndBenchmark(uploadedFile.data, uploadedFile.type, terms, benchmarks);
          newSession.extractionResults = extraction;
          newSession.benchmarkResults = benchmarking;

          // Update Borrower Name
          const borrowerTerm = extraction.find(r => r.term === 'Borrower Name');
          if (borrowerTerm && borrowerTerm.value && borrowerTerm.value !== 'Not Found') {
            newSession.borrowerName = borrowerTerm.value;
          } else {
            newSession.borrowerName = file.name.replace(/\.[^/.]+$/, ""); // Fallback to filename
          }

          // 3. Save
          setSessions(prev => [newSession, ...prev]);
          await saveSession(newSession);
          
          resolve();
        } catch (err) {
          console.error("Matrix auto-analyze failed:", err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, [terms, benchmarks]);

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentView(AppView.ANALYSIS);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this deal session?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setCurrentView(AppView.DASHBOARD);
      }
      await deleteSessionById(sessionId);
    }
  };

  const handleUpdateActiveSession = async (updates: Partial<DealSession>) => {
    if (!activeSessionId) return;

    setSessions(prev => {
      const updatedSessions = prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedSession = { ...s, ...updates, lastModified: new Date() };
          saveSession(updatedSession).catch(err => console.error("Failed to autosave:", err));
          return updatedSession;
        }
        return s;
      });
      return updatedSessions;
    });
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
            onManageBenchmarks={() => setCurrentView(AppView.BENCHMARKS)}
            onDeleteSession={handleDeleteSession}
            onDataImported={refreshSessions}
          />
        );
      
      case AppView.MATRIX:
        return (
          <MatrixView 
             sessions={sessions}
             terms={terms}
             benchmarks={benchmarks}
             onAnalyzeFile={handleMatrixFileAnalyze}
             onRemoveSession={handleDeleteSession}
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
      
      case AppView.BENCHMARKS:
        return (
          <BenchmarkManager
            benchmarks={benchmarks}
            setBenchmarks={setBenchmarks}
            terms={terms}
            onBack={() => setCurrentView(AppView.DASHBOARD)}
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

  const isWideView = currentView === AppView.MATRIX || currentView === AppView.DASHBOARD || currentView === AppView.UPLOAD || currentView === AppView.TERMS || currentView === AppView.BENCHMARKS;
  
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      
      {/* Sidebar Navigation */}
      <div className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 flex-shrink-0 shadow-lg">
        <div 
          onClick={() => { setActiveSessionId(null); setCurrentView(AppView.DASHBOARD); }}
          className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center mb-4 shadow-brand-glow cursor-pointer hover:bg-brand-500 transition-colors"
          title="Back to Dashboard"
        >
          <FileText className="text-white w-6 h-6" />
        </div>
        
        {/* Navigation Buttons */}
        {activeSession ? (
          <>
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
          </>
        ) : (
          <button
            onClick={() => setCurrentView(AppView.DASHBOARD)}
            className={`p-3 rounded-xl transition-all group relative ${
              currentView === AppView.DASHBOARD 
                ? 'bg-white/10 text-brand-400' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Dashboard"
          >
            <LayoutDashboard className="w-6 h-6" />
            {currentView === AppView.DASHBOARD && (
               <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full -ml-3"></div>
            )}
          </button>
        )}

        <button
          onClick={() => { setActiveSessionId(null); setCurrentView(AppView.MATRIX); }}
          className={`p-3 rounded-xl transition-all group relative ${
            currentView === AppView.MATRIX 
              ? 'bg-white/10 text-brand-400' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Comparison Matrix"
        >
          <LayoutGrid className="w-6 h-6" />
          {currentView === AppView.MATRIX && (
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
        
        <button
          onClick={() => setCurrentView(AppView.BENCHMARKS)}
          className={`p-3 rounded-xl transition-all group relative ${
            currentView === AppView.BENCHMARKS
              ? 'bg-white/10 text-brand-400' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Manage Benchmarks"
        >
          <Scale className="w-6 h-6" />
          {currentView === AppView.BENCHMARKS && (
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full -ml-3"></div>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Workspace */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${activeSession && showDocPreview && !isWideView ? 'w-1/2' : 'w-full'}`}>
           {renderContent()}
        </div>

        {/* Resizer / Toggle (Only show if active session and not in wide view) */}
        {activeSession && !isWideView && (
          <button 
             onClick={() => setShowDocPreview(!showDocPreview)}
             className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 shadow-md p-1 rounded-l-md hover:bg-slate-50 text-slate-500"
             style={{ right: showDocPreview ? '50%' : '0' }}
          >
            {showDocPreview ? <ChevronRight className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
        )}

        {/* Document Preview Panel (Only show if active session and not in wide view) */}
        {activeSession && showDocPreview && !isWideView && (
          <div className="w-1/2 bg-slate-200 border-l border-slate-300 h-full relative shadow-inner">
            {(activeSession.file.type === 'application/pdf' || activeSession.file.type === 'text/plain' || activeSession.file.type === 'text/html') ? (
              <iframe 
                src={`data:${activeSession.file.type};base64,${activeSession.file.data}`} 
                className="w-full h-full bg-white" 
                title="Document Preview"
              />
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                 <FileText className="w-16 h-16 mb-4 text-slate-400" />
                 <h3 className="text-xl font-semibold text-slate-700">Document Preview Unavailable</h3>
                 <p className="max-w-xs mt-2 text-sm">
                   Browser preview is limited for this file type. The AI can still read and analyze the content fully.
                 </p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;