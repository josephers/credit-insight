import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, MessageSquareText, FileText, ChevronRight, X, AlertCircle, Settings, ArrowLeft, LayoutGrid, Scale } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { ChatView } from './components/ChatView';
import { TermsManager } from './components/TermsManager';
import { BenchmarkManager } from './components/BenchmarkManager';
import { Dashboard } from './components/Dashboard';
import { MatrixView } from './components/MatrixView';
import { DEFAULT_TERMS, DEFAULT_BENCHMARK_PROFILES, MAX_FILE_SIZE_MB } from './constants';
import { AppView, UploadedFile, StandardTerm, DealSession, BenchmarkData, BenchmarkProfile, AIProvider, ChatMessage } from './types';
import { getAllSessions, saveSession, deleteSessionById } from './services/db';
import { getSettings, saveSettings } from './services/settings';
import { extractAndBenchmark, rebenchmarkTerms } from './services/aiService';

function App() {
  // Global State
  const [sessions, setSessions] = useState<DealSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  
  // Settings State
  const [terms, setTerms] = useState<StandardTerm[]>(DEFAULT_TERMS);
  const [benchmarkProfiles, setBenchmarkProfiles] = useState<BenchmarkProfile[]>(DEFAULT_BENCHMARK_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_BENCHMARK_PROFILES[0].id);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  
  // UI State
  const [showDocPreview, setShowDocPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Derived State
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeBenchmarkData = benchmarkProfiles.find(p => p.id === activeProfileId)?.data || DEFAULT_BENCHMARK_PROFILES[0].data;

  // Handle Blob URL generation for document preview
  useEffect(() => {
    if (!activeSession?.file) {
      setPreviewUrl(null);
      return;
    }

    const { data, type } = activeSession.file;
    
    // Only support preview for PDF, Text, HTML
    // We convert Base64 to Blob URL to handle large files better than Data URIs
    if (type === 'application/pdf' || type === 'text/plain' || type === 'text/html') {
      let objectUrl: string | null = null;
      try {
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type });
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (e) {
        console.error("Failed to generate preview blob:", e);
        setPreviewUrl(null);
      }

      // Cleanup function to revoke URL when activeSession file changes or unmounts
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [activeSession?.file]);

  const refreshSessions = useCallback(async () => {
    setIsLoadingDB(true);
    try {
      const loadedSessions = await getAllSessions();
      setSessions(loadedSessions);
      
      const loadedSettings = await getSettings();
      setTerms(loadedSettings.terms);
      setBenchmarkProfiles(loadedSettings.benchmarkProfiles);
      setActiveProfileId(loadedSettings.activeProfileId);
      setAiProvider(loadedSettings.aiProvider);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoadingDB(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!isLoadingDB) {
       saveSettings({ terms, benchmarkProfiles, activeProfileId, aiProvider });
    }
  }, [terms, benchmarkProfiles, activeProfileId, aiProvider, isLoadingDB]);

  const handleFileSelect = async (uploadedFile: UploadedFile) => {
    const newSession: DealSession = {
      id: Date.now().toString(),
      borrowerName: 'New Borrower',
      file: uploadedFile,
      extractionResults: [],
      benchmarkResults: {}, // Initial empty map
      chatHistory: [],
      lastModified: new Date()
    };
    
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setCurrentView(AppView.ANALYSIS);
    await saveSession(newSession);
  };

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

          const newSession: DealSession = {
            id: Date.now().toString(),
            borrowerName: 'Analyzing...',
            file: uploadedFile,
            extractionResults: [],
            benchmarkResults: {},
            chatHistory: [],
            lastModified: new Date()
          };

          const { extraction, benchmarking } = await extractAndBenchmark(uploadedFile.data, uploadedFile.type, terms, activeBenchmarkData, aiProvider);
          newSession.extractionResults = extraction;
          // Store initial benchmark results under the active profile ID
          newSession.benchmarkResults = {
             [activeProfileId]: benchmarking
          };

          const borrowerTerm = extraction.find(r => r.term === 'Borrower Name');
          if (borrowerTerm && borrowerTerm.value && borrowerTerm.value !== 'Not Found') {
            newSession.borrowerName = borrowerTerm.value;
          } else {
            newSession.borrowerName = file.name.replace(/\.[^/.]+$/, "");
          }

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
  }, [terms, activeBenchmarkData, activeProfileId, aiProvider]);

  const handleRebenchmarkSessions = async (sessionIds: string[]) => {
     const targetBenchmarks = activeBenchmarkData;
     const updatedSessions = [...sessions];
     
     await Promise.all(sessionIds.map(async (sessionId) => {
        const sessionIndex = updatedSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return;
        
        const session = updatedSessions[sessionIndex];
        const newResults = await rebenchmarkTerms(session.extractionResults, targetBenchmarks, aiProvider);
        
        // Update the specific profile key in the benchmark map
        const updatedBenchmarks = {
            ...session.benchmarkResults,
            [activeProfileId]: newResults
        };

        const updatedSession = { ...session, benchmarkResults: updatedBenchmarks, lastModified: new Date() };
        updatedSessions[sessionIndex] = updatedSession;
        await saveSession(updatedSession);
     }));
     
     setSessions(updatedSessions);
  };

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

  /**
   * Updates a session safely by ID, ensuring we use the latest state.
   */
  const handleUpdateSession = (sessionId: string, updateFn: (s: DealSession) => Partial<DealSession>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updates = updateFn(s);
        const newSession = { ...s, ...updates, lastModified: new Date() };
        saveSession(newSession).catch(err => console.error("Failed to autosave:", err));
        return newSession;
      }
      return s;
    }));
  };

  /**
   * Helper for updating the *active* session specifically.
   */
  const handleUpdateActiveSession = (updates: Partial<DealSession>) => {
    if (activeSessionId) {
      handleUpdateSession(activeSessionId, () => updates);
    }
  };

  const handleUpdateBenchmarks = (data: BenchmarkData) => {
    setBenchmarkProfiles(prev => prev.map(p => {
      if (p.id === activeProfileId) {
        return { ...p, data };
      }
      return p;
    }));
  };

  const renderContent = () => {
    if (isLoadingDB) return <div className="flex items-center justify-center h-full"><p className="text-slate-500 font-medium">Loading...</p></div>;

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
            currentProvider={aiProvider}
            onSetProvider={setAiProvider}
          />
        );
      
      case AppView.MATRIX:
        return (
          <MatrixView 
             sessions={sessions}
             terms={terms}
             benchmarkProfiles={benchmarkProfiles}
             activeProfileId={activeProfileId}
             setActiveProfileId={setActiveProfileId}
             onUpdateBenchmarkData={handleUpdateBenchmarks}
             onAnalyzeFile={handleMatrixFileAnalyze}
             onRemoveSession={handleDeleteSession}
             onRebenchmarkSessions={handleRebenchmarkSessions}
          />
        );
      
      case AppView.UPLOAD:
        return (
          <div className="h-full relative">
             <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="absolute top-6 left-6 z-20 p-2 bg-white rounded-full shadow-md text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
             <FileUpload onFileSelect={handleFileSelect} onManageTerms={() => setCurrentView(AppView.TERMS)} />
          </div>
        );
        
      case AppView.TERMS:
        return <TermsManager terms={terms} setTerms={setTerms} onBack={() => activeSession ? setCurrentView(AppView.ANALYSIS) : setCurrentView(AppView.DASHBOARD)} />;
      
      case AppView.BENCHMARKS:
        return <BenchmarkManager profiles={benchmarkProfiles} setProfiles={setBenchmarkProfiles} activeProfileId={activeProfileId} setActiveProfileId={setActiveProfileId} terms={terms} onBack={() => setCurrentView(AppView.DASHBOARD)} />;
        
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
            
            benchmarkResultsMap={activeSession.benchmarkResults}
            setBenchmarkResultsMap={(resultsMap) => handleUpdateActiveSession({ 
              benchmarkResults: typeof resultsMap === 'function' ? resultsMap(activeSession.benchmarkResults) : resultsMap 
            })}
            
            benchmarkProfiles={benchmarkProfiles}
            activeProfileId={activeProfileId}
            
            webFinancials={activeSession.webFinancials}
            setWebFinancials={(data) => handleUpdateActiveSession({ webFinancials: data })}
            aiProvider={aiProvider}
          />
        );
        
      case AppView.CHAT:
        return (
          <ChatView 
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onUpdateHistory={(sessionId, historyFn) => {
              handleUpdateSession(sessionId, (s) => ({
                chatHistory: typeof historyFn === 'function' ? historyFn(s.chatHistory) : historyFn
              }));
            }}
            aiProvider={aiProvider}
          />
        );
      default: return null;
    }
  };

  const isWideView = [AppView.MATRIX, AppView.DASHBOARD, AppView.UPLOAD, AppView.TERMS, AppView.BENCHMARKS, AppView.CHAT].includes(currentView);
  
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <div className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 flex-shrink-0 shadow-lg">
        <div onClick={() => { setActiveSessionId(null); setCurrentView(AppView.DASHBOARD); }} className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center mb-4 shadow-brand-glow cursor-pointer hover:bg-brand-500 transition-colors" title="Back to Dashboard">
          <FileText className="text-white w-6 h-6" />
        </div>
        
        {activeSession ? (
          <>
            <button onClick={() => setCurrentView(AppView.ANALYSIS)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.ANALYSIS ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Analysis Dashboard"><LayoutDashboard className="w-6 h-6" /></button>
            <button onClick={() => setCurrentView(AppView.CHAT)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.CHAT ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="AI Chat"><MessageSquareText className="w-6 h-6" /></button>
          </>
        ) : (
          <>
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.DASHBOARD ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Dashboard"><LayoutDashboard className="w-6 h-6" /></button>
            <button onClick={() => setCurrentView(AppView.CHAT)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.CHAT ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="AI Chat"><MessageSquareText className="w-6 h-6" /></button>
          </>
        )}

        <button onClick={() => { setActiveSessionId(null); setCurrentView(AppView.MATRIX); }} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.MATRIX ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Comparison Matrix"><LayoutGrid className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView(AppView.TERMS)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.TERMS ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Manage Terms"><Settings className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView(AppView.BENCHMARKS)} className={`p-3 rounded-xl transition-all group relative ${currentView === AppView.BENCHMARKS ? 'bg-white/10 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Manage Benchmarks"><Scale className="w-6 h-6" /></button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex-1 flex flex-col transition-all duration-300 ${activeSession && showDocPreview && !isWideView ? 'w-1/2' : 'w-full'}`}>
           {renderContent()}
        </div>
        {activeSession && showDocPreview && !isWideView && (
          <button onClick={() => setShowDocPreview(!showDocPreview)} className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 shadow-md p-1 rounded-l-md hover:bg-slate-50 text-slate-500" style={{ right: showDocPreview ? '50%' : '0' }}>
            {showDocPreview ? <ChevronRight className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
        )}
        {activeSession && showDocPreview && !isWideView && (
          <div className="w-1/2 bg-slate-200 border-l border-slate-300 h-full relative shadow-inner">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full bg-white" title="Document Preview" />
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                 <FileText className="w-16 h-16 mb-4 text-slate-400" />
                 <h3 className="text-xl font-semibold text-slate-700">Document Preview Unavailable</h3>
                 {activeSession.file.type === 'application/pdf' && <p className="text-xs text-red-400 mt-2">PDF Display Error: Invalid format or browser block.</p>}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;