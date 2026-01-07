import React, { useState } from 'react';
import { Play, Download, ChevronDown, ChevronUp, Quote, AlertCircle, FileText, Scale, LayoutList, AlertTriangle, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { StandardTerm, ExtractionResult, UploadedFile, BenchmarkResult, WebFinancialData } from '../types';
import { extractAndBenchmark, fetchFinancialsFromWeb } from '../services/geminiService';

interface AnalysisViewProps {
  file: UploadedFile;
  terms: StandardTerm[];
  setTerms: React.Dispatch<React.SetStateAction<StandardTerm[]>>;
  results: ExtractionResult[];
  setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
  borrowerName: string;
  onUpdateBorrowerName: (name: string) => void;
  benchmarkResults: BenchmarkResult[];
  setBenchmarkResults: React.Dispatch<React.SetStateAction<BenchmarkResult[]>>;
  webFinancials?: { data: WebFinancialData[], sourceUrls: string[], lastUpdated: Date };
  setWebFinancials: (data: { data: WebFinancialData[], sourceUrls: string[], lastUpdated: Date }) => void;
}

type Tab = 'terms' | 'covenants' | 'baskets' | 'benchmark' | 'financials';

export const AnalysisView: React.FC<AnalysisViewProps> = ({ 
  file, 
  terms, 
  setTerms, 
  results, 
  setResults,
  borrowerName,
  onUpdateBorrowerName,
  benchmarkResults,
  setBenchmarkResults,
  webFinancials,
  setWebFinancials
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingWeb, setIsFetchingWeb] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('terms');
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResults([]);
    setBenchmarkResults([]);
    
    try {
      setStatusText('Analyzing document & Benchmarking...');
      
      // Perform simultaneous extraction and benchmarking
      const { extraction, benchmarking } = await extractAndBenchmark(file.data, file.type, terms);
      
      setResults(extraction);
      setBenchmarkResults(benchmarking);

      // Auto-update Borrower Name if found
      const borrowerTerm = extraction.find(r => r.term === 'Borrower Name');
      if (borrowerTerm && borrowerTerm.value && borrowerTerm.value !== 'Not Found') {
        onUpdateBorrowerName(borrowerTerm.value);
      }
      
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setStatusText('');
    }
  };

  const handleFetchFinancials = async () => {
    if (!borrowerName || borrowerName === 'New Borrower') {
      alert("Please extract a Borrower Name first or update it manually.");
      return;
    }
    
    setIsFetchingWeb(true);
    try {
      const result = await fetchFinancialsFromWeb(borrowerName);
      setWebFinancials({
        data: result.data,
        sourceUrls: result.sourceUrls,
        lastUpdated: new Date()
      });
    } catch (e) {
      console.error(e);
      alert("Failed to fetch financial data from web.");
    } finally {
      setIsFetchingWeb(false);
    }
  };

  const toggleExpand = (termName: string) => {
    setExpandedResult(expandedResult === termName ? null : termName);
  };

  const handleExport = () => {
    if (results.length === 0) return;
    
    // Create CSV content
    const headers = ['Category', 'Term', 'Value', 'Source Section', 'Confidence', 'Evidence', 'Benchmark Variance', 'Commentary'];
    const rows = results.map(r => {
      const termDef = terms.find(t => t.name === r.term);
      const bench = benchmarkResults.find(b => b.term === r.term);
      
      return [
        termDef?.category || 'General',
        `"${r.term}"`,
        `"${r.value.replace(/"/g, '""')}"`,
        `"${r.sourceSection}"`,
        r.confidence,
        `"${r.evidence.replace(/"/g, '""')}"`,
        bench?.variance || '',
        `"${(bench?.commentary || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${borrowerName.replace(/[^a-z0-9]/gi, '_')}_Analysis.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderResultCard = (term: StandardTerm) => {
    const result = results.find(r => r.term === term.name);
    if (!result) return null;

    const isExpanded = expandedResult === term.name;

    return (
      <div key={term.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-3 hover:shadow-md transition-shadow group/card">
        <div 
          className="p-4 cursor-pointer hover:bg-slate-50/30 transition-colors"
          onClick={() => toggleExpand(term.name)}
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-bold text-slate-800 text-[15px]">{term.name}</h4>
                {/* Collapsed view source hint */}
                {!isExpanded && result.sourceSection && result.sourceSection !== 'N/A' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 opacity-60 group-hover/card:opacity-100 transition-opacity">
                    <FileText className="w-3 h-3" />
                    {result.sourceSection}
                  </span>
                )}
              </div>
              <p className={`text-slate-600 text-sm leading-relaxed ${isExpanded ? 'whitespace-pre-wrap font-medium' : 'line-clamp-2'}`}>
                {result.value}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
               {/* Confidence Badge */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                 <div className={`w-1.5 h-1.5 rounded-full ${
                    result.confidence === 'High' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]' :
                    result.confidence === 'Medium' ? 'bg-amber-500' : 'bg-red-500'
                 }`} />
                 <span className={`text-[10px] font-bold uppercase tracking-wider ${
                   result.confidence === 'High' ? 'text-emerald-700' :
                   result.confidence === 'Medium' ? 'text-amber-700' : 'text-red-700'
                 }`}>
                   {result.confidence}
                 </span>
              </div>
              
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>
        </div>
        
        {isExpanded && (
          <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-3">
               
               {/* Section Link / Citation Header */}
               <div className="flex items-center gap-2 mb-1">
                 <FileText className="w-4 h-4 text-brand-600" />
                 <span className="font-semibold text-xs text-slate-600 uppercase tracking-wider">Source Reference:</span>
                 <span className="font-mono text-xs font-medium text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 select-all">
                   {result.sourceSection}
                 </span>
               </div>

               {/* Evidence Quote Block */}
               <div className="relative pl-4 mt-1">
                 <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-300 rounded-full"></div>
                 <Quote className="absolute -left-2 top-0 w-4 h-4 text-brand-600 bg-slate-50 fill-white" />
                 <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap pt-0.5">
                   "{result.evidence}"
                 </p>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    if (results.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20">
          {isAnalyzing ? (
             <div className="flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
               <p className="text-lg font-medium text-slate-600">{statusText}</p>
             </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Ready to Analyze</h3>
              <p className="text-slate-500 max-w-sm text-center mb-8">
                Run the analysis to generate a structured term sheet, covenant matrix, and basket calculations.
              </p>
              <button
                onClick={handleAnalyze}
                className="px-8 py-3 bg-brand-600 text-white rounded-lg font-medium shadow-md hover:bg-brand-700 transition-colors flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Analysis
              </button>
            </>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'terms':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <FileText className="w-5 h-5 text-brand-500" />
                General Terms
              </h3>
              {terms.filter(t => t.category === 'General').map(renderResultCard)}
              
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mt-8">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Risk & Defaults
              </h3>
              {terms.filter(t => t.category === 'Risk').map(renderResultCard)}
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <LayoutList className="w-5 h-5 text-purple-500" />
                Key Definitions
              </h3>
              {terms.filter(t => t.category === 'Definitions').map(renderResultCard)}
              
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mt-8">
                <Scale className="w-5 h-5 text-green-500" />
                Financial Covenants
              </h3>
              {terms.filter(t => t.category === 'Financial').map(renderResultCard)}
            </div>
          </div>
        );

      case 'covenants':
        return (
          <div className="max-w-5xl mx-auto">
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
               <div>
                 <h4 className="font-semibold text-blue-800">Covenant Matrix</h4>
                 <p className="text-sm text-blue-600">Review negative covenants, thresholds, and specific permissions.</p>
               </div>
             </div>
             <div className="space-y-4">
               {terms.filter(t => t.category === 'Covenants').map(renderResultCard)}
             </div>
          </div>
        );

      case 'baskets':
        return (
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                 <h3 className="text-lg font-bold text-slate-800 mb-4">Basket Capacity Analysis</h3>
                 <p className="text-sm text-slate-500 mb-6">
                   Analysis of permissions for Restricted Payments (Dividends) and Investments.
                 </p>
                 <div className="space-y-4">
                    {terms.filter(t => t.category === 'Baskets').map(renderResultCard)}
                 </div>
              </div>
            </div>
          </div>
        );

      case 'benchmark':
        if (benchmarkResults.length === 0) {
           return (
             <div className="flex flex-col items-center justify-center h-64 text-slate-400">
               <p>No benchmark data available. Try re-running the analysis.</p>
             </div>
           )
        }
        return (
          <div className="max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Portfolio Benchmark Matrix</h3>
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  Comparisons vs. Market Standard (Conservative)
                </span>
             </div>
             
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-3 p-4">Term</div>
                  <div className="col-span-3 p-4">Current Deal</div>
                  <div className="col-span-3 p-4">Benchmark / Market</div>
                  <div className="col-span-3 p-4">Variance Analysis</div>
                </div>
                
                {benchmarkResults.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-3 p-4 font-medium text-slate-800 text-sm flex items-center">
                      {item.term}
                    </div>
                    <div className="col-span-3 p-4 text-sm text-slate-600 font-mono bg-slate-50/50">
                      {item.extractedValue}
                    </div>
                    <div className="col-span-3 p-4 text-sm text-slate-500 font-mono">
                      {item.benchmarkValue}
                    </div>
                    <div className="col-span-3 p-4">
                       <div className="flex items-start gap-2">
                         <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                           item.variance === 'Green' ? 'bg-green-500' : 
                           item.variance === 'Yellow' ? 'bg-yellow-500' : 'bg-red-500'
                         }`} />
                         <div>
                           <span className={`text-xs font-bold px-1.5 py-0.5 rounded border mb-1 inline-block ${
                              item.variance === 'Green' ? 'bg-green-50 text-green-700 border-green-200' : 
                              item.variance === 'Yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'
                           }`}>
                             {item.variance}
                           </span>
                           <p className="text-xs text-slate-600 leading-tight">
                             {item.commentary}
                           </p>
                         </div>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        );

      case 'financials':
        return (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Borrower Financials (Web)</h3>
                <p className="text-slate-500 text-sm">
                  Live data retrieved from SEC.gov and financial news via Google Search.
                </p>
              </div>
              <button
                onClick={handleFetchFinancials}
                disabled={isFetchingWeb}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
                   isFetchingWeb ? 'bg-slate-200 text-slate-500 cursor-wait' : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {isFetchingWeb ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Fetching...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" /> Fetch Latest Financials
                  </>
                )}
              </button>
            </div>

            {(!webFinancials || webFinancials.data.length === 0) ? (
               <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Globe className="w-8 h-8 text-slate-300" />
                 </div>
                 <h4 className="text-lg font-semibold text-slate-700 mb-2">No Financial Data</h4>
                 <p className="text-slate-500 max-w-sm mx-auto mb-6">
                   Click the button above to search the web for {borrowerName}'s latest 10-K/10-Q filings and financial metrics.
                 </p>
               </div>
            ) : (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {webFinancials.data.map((item, idx) => (
                     <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-brand-200 transition-colors">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{item.metric}</p>
                        <p className="text-2xl font-bold text-slate-900 mb-1">{item.value}</p>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                            {item.period}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.source}>
                            Src: {item.source}
                          </span>
                        </div>
                     </div>
                   ))}
                </div>

                {/* Sources Footnote */}
                {webFinancials.sourceUrls.length > 0 && (
                  <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                    <h5 className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Source Links (EDGAR / Web)
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {webFinancials.sourceUrls.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline bg-white px-2 py-1 rounded border border-slate-200 truncate max-w-xs"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-right text-[10px] text-slate-400">
                  Last updated: {new Date(webFinancials.lastUpdated).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">{borrowerName}</h2>
          <p className="text-xs text-slate-500 flex items-center gap-1">
             <FileText className="w-3 h-3" />
             {file.name}
          </p>
        </div>
        <div className="flex gap-2">
          {results.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Feed
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm transition-all ${
              isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {isAnalyzing ? 'Processing...' : 'Re-Run Analysis'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6">
        {[
          { id: 'terms', label: 'Term Sheet', icon: FileText },
          { id: 'covenants', label: 'Covenant Matrix', icon: Scale },
          { id: 'baskets', label: 'Basket Analysis', icon: LayoutList },
          { id: 'benchmark', label: 'Benchmarking', icon: AlertTriangle },
          { id: 'financials', label: 'Financials (Web)', icon: Globe }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-brand-600 text-brand-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-slate-50/50">
        {renderTabContent()}
      </div>
    </div>
  );
};