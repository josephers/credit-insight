import React, { useState, useMemo } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, AlertCircle, LayoutGrid, FileText, Plus, GripVertical } from 'lucide-react';
import { DealSession, StandardTerm } from '../types';
import { MARKET_BENCHMARK } from '../constants';

interface MatrixViewProps {
  sessions: DealSession[];
  terms: StandardTerm[];
  onAnalyzeFile: (file: File) => Promise<void>;
  onRemoveSession: (id: string) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({ 
  sessions, 
  terms, 
  onAnalyzeFile,
  onRemoveSession 
}) => {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(
    sessions.slice(0, 3).map(s => s.id) // Default to first 3
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      // The parent component should update 'sessions'. 
      // We'll rely on useEffect or manual addition if we want to auto-select the new one.
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

  const getVarianceColor = (variance?: 'Green' | 'Yellow' | 'Red') => {
    switch(variance) {
      case 'Green': return 'bg-green-50 text-green-700 border-green-200';
      case 'Yellow': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Red': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-white text-slate-600 border-transparent';
    }
  };

  const getVarianceIcon = (variance?: 'Green' | 'Yellow' | 'Red') => {
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

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-brand-600" />
            Deal Comparison Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Compare terms across portfolio. Drag & drop files to add new deals.
          </p>
        </div>
        
        {/* Session Selector */}
        <div className="flex items-center gap-2 relative group">
           <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
             <Plus className="w-4 h-4" />
             Select Deals ({selectedSessionIds.length})
           </button>
           
           {/* Dropdown */}
           <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 hidden group-hover:block z-40 p-2 max-h-96 overflow-y-auto">
             <div className="text-xs font-bold text-slate-400 uppercase px-2 py-1 mb-1">Available Sessions</div>
             {sessions.map(s => (
               <label key={s.id} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={selectedSessionIds.includes(s.id)}
                   onChange={() => toggleSession(s.id)}
                   className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                 />
                 <span className="text-sm text-slate-700 truncate">{s.borrowerName}</span>
               </label>
             ))}
             {sessions.length === 0 && <div className="p-2 text-sm text-slate-400 italic">No deals available</div>}
           </div>
        </div>
      </div>

      {/* Matrix Table Container */}
      <div className="flex-1 overflow-auto p-6 scroll-smooth">
        <div className="inline-block min-w-full align-middle">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="sticky left-0 z-20 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-64 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Terms / Feature
                  </th>
                  {/* Benchmark Column */}
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-64 bg-slate-50/50">
                     Market Standard (Benchmark)
                  </th>
                  {/* Deal Columns */}
                  {selectedSessions.map(session => (
                    <th key={session.id} scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-800 uppercase tracking-wider w-64 min-w-[250px]">
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
                      <td colSpan={selectedSessions.length + 2} className="sticky left-0 z-10 bg-slate-100/50 px-6 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                        {category}
                      </td>
                    </tr>
                    
                    {/* Term Rows */}
                    {catTerms.map(term => {
                      // Get benchmark value
                      const benchmarkVal = MARKET_BENCHMARK[term.name as keyof typeof MARKET_BENCHMARK] || 'N/A';
                      
                      return (
                        <tr key={term.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-6 py-4 text-sm font-medium text-slate-900 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {term.name}
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5 line-clamp-1">{term.description}</p>
                          </td>
                          
                          {/* Benchmark Cell */}
                          <td className="px-6 py-4 text-sm text-slate-500 bg-slate-50/30 font-mono border-r border-slate-100">
                            {benchmarkVal}
                          </td>

                          {/* Deal Cells */}
                          {selectedSessions.map(session => {
                            const result = session.extractionResults.find(r => r.term === term.name);
                            const benchmarkRes = session.benchmarkResults.find(b => b.term === term.name);
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