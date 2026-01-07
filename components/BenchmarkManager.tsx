import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, RefreshCw, Scale, Save, AlertTriangle } from 'lucide-react';
import { BenchmarkData, StandardTerm } from '../types';
import { MARKET_BENCHMARK } from '../constants';

interface BenchmarkManagerProps {
  benchmarks: BenchmarkData;
  setBenchmarks: (data: BenchmarkData) => void;
  terms: StandardTerm[];
  onBack: () => void;
}

export const BenchmarkManager: React.FC<BenchmarkManagerProps> = ({ 
  benchmarks, 
  setBenchmarks, 
  terms, 
  onBack 
}) => {
  const [newBenchmarkTerm, setNewBenchmarkTerm] = useState('');
  const [newBenchmarkValue, setNewBenchmarkValue] = useState('');
  
  // Create a list of terms that don't have benchmarks yet
  const availableTerms = terms.filter(t => !benchmarks[t.name]);

  const handleUpdate = (term: string, value: string) => {
    setBenchmarks({
      ...benchmarks,
      [term]: value
    });
  };

  const handleDelete = (term: string) => {
    const next = { ...benchmarks };
    delete next[term];
    setBenchmarks(next);
  };

  const handleAdd = () => {
    if (!newBenchmarkTerm || !newBenchmarkValue) return;
    setBenchmarks({
      ...benchmarks,
      [newBenchmarkTerm]: newBenchmarkValue
    });
    setNewBenchmarkTerm('');
    setNewBenchmarkValue('');
  };

  const handleReset = () => {
    if (confirm('Reset all benchmarks to system defaults? Custom changes will be lost.')) {
      setBenchmarks(MARKET_BENCHMARK);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-600" />
              Benchmark Manager
            </h2>
            <p className="text-xs text-slate-500">
              Define "Market Standard" values. The AI uses these to calculate variance (Green/Yellow/Red).
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Add New */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
               <Plus className="w-4 h-4 text-brand-600" />
               Add Benchmark Criteria
             </h3>
             <div className="flex gap-4 items-end">
               <div className="flex-1">
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Term</label>
                 <select
                   value={newBenchmarkTerm}
                   onChange={e => setNewBenchmarkTerm(e.target.value)}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50"
                 >
                   <option value="">-- Select a Term --</option>
                   {availableTerms.map(t => (
                     <option key={t.id} value={t.name}>{t.name} ({t.category})</option>
                   ))}
                 </select>
               </div>
               <div className="flex-1">
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Standard / Conservative Value</label>
                 <input 
                   type="text"
                   value={newBenchmarkValue}
                   onChange={e => setNewBenchmarkValue(e.target.value)}
                   placeholder="e.g. 4.00x or $10M"
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                 />
               </div>
               <button
                 onClick={handleAdd}
                 disabled={!newBenchmarkTerm || !newBenchmarkValue}
                 className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
               >
                 Add
               </button>
             </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 grid grid-cols-12 gap-4">
                <div className="col-span-5 text-xs font-bold text-slate-500 uppercase">Term Name</div>
                <div className="col-span-6 text-xs font-bold text-slate-500 uppercase">Benchmark Value (Standard)</div>
                <div className="col-span-1"></div>
             </div>
             
             {Object.entries(benchmarks).length === 0 && (
               <div className="p-8 text-center text-slate-400">
                 No benchmarks defined. Add one above.
               </div>
             )}

             {Object.entries(benchmarks).map(([term, value]) => (
               <div key={term} className="px-6 py-4 border-b border-slate-100 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-5 font-medium text-slate-800">
                    {term}
                    <div className="text-[10px] text-slate-400 font-normal">
                      {terms.find(t => t.name === term)?.category || 'Custom'}
                    </div>
                  </div>
                  <div className="col-span-6">
                    <input 
                      type="text"
                      value={value}
                      onChange={e => handleUpdate(term, e.target.value)}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-0 px-2 py-1 outline-none transition-all font-mono text-sm text-slate-700"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button 
                      onClick={() => handleDelete(term)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
               </div>
             ))}
          </div>

          <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">How Benchmarking Works</h4>
              <p className="text-sm text-amber-700 mt-1">
                The AI compares the extracted value from the document against the value you enter here.
                <br/>
                Example: If Benchmark is <strong>"4.50x"</strong> and Deal is <strong>"5.00x"</strong>, the variance will likely be <span className="font-bold text-red-600">Red</span> (Aggressive).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
