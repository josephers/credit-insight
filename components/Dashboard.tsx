import React, { useMemo, useState, useRef } from 'react';
import { Plus, Search, FileText, ChevronRight, Briefcase, Calendar, Trash2, Settings, Download, UploadCloud, Scale } from 'lucide-react';
import { DealSession } from '../types';
import { exportDatabase, importDatabase } from '../services/db';

interface DashboardProps {
  sessions: DealSession[];
  onSelectSession: (sessionId: string) => void;
  onNewAnalysis: () => void;
  onManageTerms: () => void;
  onManageBenchmarks: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDataImported: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  sessions, 
  onSelectSession, 
  onNewAnalysis, 
  onManageTerms,
  onManageBenchmarks,
  onDeleteSession,
  onDataImported
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group sessions by Borrower Name
  const groupedSessions = useMemo(() => {
    const groups: Record<string, DealSession[]> = {};
    sessions.forEach(session => {
      const key = session.borrowerName || 'Unknown Borrower';
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    });
    return groups;
  }, [sessions]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedSessions;
    const lowerTerm = searchTerm.toLowerCase();
    
    const result: Record<string, DealSession[]> = {};
    Object.keys(groupedSessions).forEach(borrower => {
      // Check if borrower name matches
      if (borrower.toLowerCase().includes(lowerTerm)) {
        result[borrower] = groupedSessions[borrower];
      } else {
        // Check if any file in the group matches
        const matchingSessions = groupedSessions[borrower].filter(s => 
          s.file.name.toLowerCase().includes(lowerTerm)
        );
        if (matchingSessions.length > 0) {
          result[borrower] = matchingSessions;
        }
      }
    });
    return result;
  }, [groupedSessions, searchTerm]);

  const handleExport = async () => {
    try {
      const json = await exportDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `credit-insight-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export database.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Importing will merge the backup with your current data. Continue?")) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await importDatabase(json);
        alert("Portfolio imported successfully!");
        onDataImported();
      } catch (error) {
        console.error("Import failed", error);
        alert("Failed to import file. Please ensure it is a valid CreditInsight backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-brand-600" />
            Deal Portfolio
          </h1>
          <p className="text-slate-500 mt-1">Manage active credit agreement analysis sessions.</p>
        </div>
        <div className="flex items-center gap-3">
           
           {/* Data Management Buttons */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 mr-2">
             <button
               onClick={handleExport}
               className="p-2 text-slate-600 hover:text-brand-600 hover:bg-white rounded-md transition-all"
               title="Export Portfolio to File (Share)"
             >
               <Download className="w-4 h-4" />
             </button>
             <div className="w-px h-4 bg-slate-300 mx-1"></div>
             <button
               onClick={handleImportClick}
               className="p-2 text-slate-600 hover:text-brand-600 hover:bg-white rounded-md transition-all"
               title="Import Portfolio from File"
             >
               <UploadCloud className="w-4 h-4" />
             </button>
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileChange} 
               accept=".json" 
               className="hidden" 
             />
           </div>
           
           <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
             <button 
               onClick={onManageBenchmarks}
               className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-transparent hover:bg-white rounded-md hover:shadow-sm font-medium transition-all text-sm"
               title="Edit Market Standards"
             >
               <Scale className="w-4 h-4" />
               Benchmarks
             </button>
             <div className="w-px bg-slate-300 my-2"></div>
             <button 
               onClick={onManageTerms}
               className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-transparent hover:bg-white rounded-md hover:shadow-sm font-medium transition-all text-sm"
               title="Edit Extraction Terms"
             >
               <Settings className="w-4 h-4" />
               Terms
             </button>
           </div>
           
           <button 
             onClick={onNewAnalysis}
             className="ml-2 flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 shadow-sm transition-colors"
           >
             <Plus className="w-5 h-5" />
             New Analysis
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by Borrower Name or Filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl shadow-sm text-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none placeholder:text-slate-300"
            />
          </div>

          {/* Empty State */}
          {sessions.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Briefcase className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Active Deals</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-8">
                Upload a credit agreement to automatically create a new deal session and extract borrower details.
              </p>
              <div className="flex justify-center gap-4">
                <button 
                  onClick={onNewAnalysis}
                  className="text-brand-600 font-semibold hover:text-brand-700 inline-flex items-center justify-center gap-2"
                >
                  Start your first analysis <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleImportClick}
                  className="text-slate-500 hover:text-slate-700 inline-flex items-center justify-center gap-2 text-sm underline"
                >
                  Import Backup
                </button>
              </div>
            </div>
          )}

          {/* Grid of Borrowers */}
          <div className="space-y-8">
            {(Object.entries(filteredGroups) as [string, DealSession[]][]).map(([borrower, groupSessions]) => (
              <div key={borrower} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-lg font-bold text-slate-800 mb-4 pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-brand-500 rounded-full"></span>
                  {borrower}
                  <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                    {groupSessions.length} {groupSessions.length === 1 ? 'Doc' : 'Docs'}
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {groupSessions.map(session => (
                    <div 
                      key={session.id}
                      className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden flex flex-col cursor-pointer relative"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 bg-blue-50 text-brand-600 rounded-lg">
                            <FileText className="w-6 h-6" />
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-slate-800 mb-1 line-clamp-1" title={session.file.name}>
                          {session.file.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-4">
                           <Calendar className="w-3.5 h-3.5" />
                           {new Date(session.lastModified).toLocaleDateString()} 
                           <span className="text-slate-300">|</span>
                           {session.extractionResults.length > 0 ? (
                             <span className="text-green-600 font-medium">Analyzed</span>
                           ) : (
                             <span className="text-amber-600 font-medium">Pending Analysis</span>
                           )}
                        </div>
                      </div>
                      <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center group-hover:bg-brand-50/50 transition-colors">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open Deal</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transform group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
