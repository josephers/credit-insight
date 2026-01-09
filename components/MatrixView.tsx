import React, { useState, useMemo } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, AlertCircle, LayoutGrid, FileText, Plus, ChevronDown, RefreshCw } from 'lucide-react';
import { DealSession, StandardTerm, BenchmarkData, BenchmarkProfile } from '../types';

interface MatrixViewProps {
  sessions: DealSession[];
  terms: StandardTerm[];
  benchmarkProfiles: BenchmarkProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  onUpdateBenchmarkData: (data: BenchmarkData) => void;
  onAnalyzeFile: (file: File) => Promise<void>;
  onRemoveSession: (id: string) => void;
  onRebenchmarkSessions: (sessionIds: string[]) => Promise<void>;
}

export const MatrixView: React.FC<MatrixViewProps> = ({ 
  sessions, 
  terms, 
  benchmarkProfiles,
  activeProfileId,
  setActiveProfileId,
  onUpdateBenchmarkData,
  onAnalyzeFile,
  onRemoveSession,
  onRebenchmarkSessions
}) => {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(
    sessions.slice(0, 3).map(s => s.id) // Default to first 3
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRebenchmarking, setIsRebenchmarking] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Group terms by category for the table
  const categories = useMemo(() => {
    const groups: Record<string, StandardTerm[]> = {};
    terms.forEach(term => {
      if (!groups[term.category]) groups[term.category] = [];
      groups[term.category].push(term);
    });
    return groups;
  }, [terms]);

  const selectedSessions = useMemo(() => 
    sessions.filter(s => selectedSessionIds.includes(s.id)),
  [sessions, selectedSessionIds]);
  
  const activeProfile = benchmarkProfiles.find(p => p.id === activeProfileId) || benchmarkProfiles[0];
  const benchmarks = activeProfile.data;

  // Drag Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Process the first file
    const file = files[0];
    setIsProcessing(true);
    try {
      await onAnalyzeFile(file);
    } catch (error) {
      console.error("Drop processing failed", error);
      alert("Failed to process dropped file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSession = (id: string) => {
    if (selectedSessionIds.includes(id)) {
      setSelectedSessionIds(prev => prev.filter(sid => sid !== id));
    } else {
      setSelectedSessionIds(prev => [...prev, id]);
    }
  };

  const toggleAllSessions = () => {
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map(s => s.id));
    }
  };

  const handleBenchmarkChange = (term: string, value: string) => {
    onUpdateBenchmarkData({
      ...benchmarks,
      [term]: value
    });
  };

  const handleRebenchmarkClick = async () => {
    if (selectedSessionIds.length === 0) return;
    setIsRebenchmarking(true);
    try {
      await onRebenchmarkSessions(selectedSessionIds);
    } catch (error) {
      console.error("Rebenchmark failed", error);
      alert("Failed to re-run Benchmark Analysis.");
    } finally {
      setIsRebenchmarking(false);
    }
  };

  const getVarianceColor = (variance?: 'Green' | 'Yellow' | 'Red' | 'N/A') => {
    switch(variance) {
      case 'Green': return 'bg-green-50 text-green-700 border-green-200';
      case 'Yellow': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Red': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-white text-slate-600 border-transparent';
    }
  };

  const getVarianceIcon = (variance?: 'Green' | 'Yellow' | 'Red' | 'N/A') => {
    switch(variance) {
      case 'Green': return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'Yellow': return <AlertTriangle className="w-3 h-3 text-yellow-600" />;
      case 'Red': return <AlertCircle className="w-3 h-3 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div 
      className={`h-full flex flex-col bg-slate-50 relative transition-colors ${isDragging ? 'bg-brand-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-brand-50/90 border-4 border-brand-200 border-dashed m-4 rounded-3xl pointer-events-none">
          <Upload className="w-16 h-16 text-brand-600 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-brand-800">Drop Deal to Add to Matrix</h2>
          <p className="text-brand-600">File will be analyzed and added as a new column</p>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
           <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
           <h2 className="text-xl font-bold text-slate-800">Analyzing New Deal...</h2>
           <p className="text-slate-500">Extracting terms and calculating variance</p>
        </div>
      )}

       {/* Re-benchmarking Overlay */}
       {isRebenchmarking && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
           <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
           <h2 className="text-xl font-bold text-slate-800">Updating Variance Analysis...</h2>
           <p className="text-slate-500">Comparing extracted terms against {activeProfile.name}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0 z-40 relative">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-brand-600" />
            Deal Comparison Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Compare terms across portfolio. Drag & drop files to add new deals.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          
          <button
            onClick={handleRebenchmarkClick}
            disabled={isRebenchmarking || selectedSessionIds.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Recalculate colors based on current benchmark values"
          >
             <RefreshCw className={`w-4 h-4 ${isRebenchmarking ? 'animate-spin' : ''}`} />
             Re-run Benchmark Analysis
          </button>

          {/* Session Selector */}
          <div className="flex items-center gap-2 relative">
             <button 
               onClick={() => setIsDropdownOpen(!isDropdownOpen)}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                 isDropdownOpen ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
               }`}
             >
               <Plus className="w-4 h-4" />
               Select Deals ({selectedSessionIds.length})
             </button>
             
             {/* Backdrop to close on click outside */}
             {isDropdownOpen && (
               <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
             )}

             {/* Dropdown */}
             {isDropdownOpen && (
               <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                 <div className="flex justify-between items-center px-2 py-2 mb-1 border-b border-slate-100">
                   <span className="text-xs font-bold text-slate-400 uppercase">Available Sessions</span>
                   <button 
                     onClick={(e) => { e.stopPropagation(); toggleAllSessions(); }}
                     className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded transition-colors"
                   >
                     {selectedSessionIds.length === sessions.length && sessions.length > 0 ? 'Deselect All' : 'Select All'}
                   </button>
                 </div>
                 
                 {sessions.length > 0 ? (
                   sessions.map(s => (
                     <label key={s.id} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={selectedSessionIds.includes(s.id)}
                         onChange={() => toggleSession(s.id)}
                         className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                       />
                       <span className="text-sm text-slate-700 truncate">{s.borrowerName}</span>
                     </label>
                   ))
                 ) : (
                   <div className="p-2 text-sm text-slate-400 italic">No deals available</div>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Matrix Table Container */}
      <div className="flex-1 overflow-auto p-6 scroll-smooth">
        <div className="inline-block min-w-full align-middle">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-30 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-64 border-r border-slate-200 border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Terms / Feature
                  </th>
                  {/* Benchmark Column */}
                  <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-64 border-b border-slate-200 min-w-[200px]">
                     <div className="flex flex-col gap-1">
                       <span>Benchmark</span>
                       <div className="relative">
                         <select 
                            value={activeProfileId}
                            onChange={(e) => setActiveProfileId(e.target.value)}
                            className="w-full bg-slate-100 border-none rounded text-xs text-slate-700 py-1 pl-2 pr-6 cursor-pointer focus:ring-2 focus:ring-brand-500 appearance-none"
                         >
                           {benchmarkProfiles.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                           ))}
                         </select>
                         <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                       </div>
                     </div>
                  </th>
                  {/* Deal Columns */}
                  {selectedSessions.map(session => (
                    <th key={session.id} scope="col" className="sticky top-0 z-20 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-800 uppercase tracking-wider w-64 min-w-[250px] border-b border-slate-200">
                      <div className="flex justify-between items-start gap-2">
                        <span className="line-clamp-2">{session.borrowerName}</span>
                        <button 
                          onClick={() => toggleSession(session.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-normal normal-case">
                         <FileText className="w-3 h-3" />
                         {session.file.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {(Object.entries(categories) as [string, StandardTerm[]][]).map(([category, catTerms]) => (
                  <React.Fragment key={category}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100/50">
                      <td colSpan={selectedSessions.length + 2} className="sticky left-0 z-10 bg-slate-100 px-6 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                        {category}
                      </td>
                    </tr>
                    
                    {/* Term Rows */}
                    {catTerms.map(term => {
                      // Get benchmark value
                      const benchmarkVal = benchmarks[term.name as keyof typeof benchmarks] || '';
                      
                      return (
                        <tr key={term.id} className="hover:bg-slate-50/50 transition-colors group/row">
                          <td className="sticky left-0 z-10 bg-white px-6 py-4 text-sm font-medium text-slate-900 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {term.name}
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5 line-clamp-1">{term.description}</p>
                          </td>
                          
                          {/* Benchmark Cell - Editable */}
                          <td className="px-6 py-4 text-sm text-slate-500 bg-slate-50/30 font-mono border-r border-slate-100 p-0">
                            <input 
                              type="text"
                              value={benchmarkVal}
                              onChange={(e) => handleBenchmarkChange(term.name, e.target.value)}
                              placeholder="-"
                              className="w-full h-full bg-transparent px-2 py-1 border border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-0 rounded outline-none transition-all text-sm font-mono text-slate-700"
                            />
                          </td>

                          {/* Deal Cells */}
                          {selectedSessions.map(session => {
                            const result = session.extractionResults.find(r => r.term === term.name);
                            // Look up benchmark result for current active profile
                            const profileResults = session.benchmarkResults[activeProfileId] || [];
                            const benchmarkRes = profileResults.find(b => b.term === term.name);
                            
                            const value = result ? result.value : '-';
                            const variance = benchmarkRes?.variance;
                            
                            return (
                              <td key={`${session.id}-${term.id}`} className="px-6 py-4 text-sm align-top">
                                <div className={`p-3 rounded-lg border ${getVarianceColor(variance)} h-full`}>
                                   <div className="flex justify-between items-start gap-2 mb-1">
                                      <span className="font-medium whitespace-pre-wrap word-break text-xs">{value}</span>
                                      {variance && (
                                        <div className="flex-shrink-0" title={`${variance} Variance: ${benchmarkRes?.commentary || ''}`}>
                                          {getVarianceIcon(variance)}
                                        </div>
                                      )}
                                   </div>
                                   {/* Only show commentary if it's aggressive/red to save space */}
                                   {variance === 'Red' && benchmarkRes?.commentary && (
                                     <p className="text-[10px] opacity-80 mt-2 pt-2 border-t border-red-200 leading-tight">
                                       {benchmarkRes.commentary}
                                     </p>
                                   )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};