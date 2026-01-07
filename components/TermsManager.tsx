import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, RefreshCw, Settings, Save, X } from 'lucide-react';
import { StandardTerm } from '../types';
import { DEFAULT_TERMS } from '../constants';

interface TermsManagerProps {
  terms: StandardTerm[];
  setTerms: React.Dispatch<React.SetStateAction<StandardTerm[]>>;
  onBack: () => void;
}

const CATEGORIES = ['General', 'Financial', 'Covenants', 'Baskets', 'Definitions', 'Risk'] as const;

export const TermsManager: React.FC<TermsManagerProps> = ({ terms, setTerms, onBack }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTerm, setNewTerm] = useState<Partial<StandardTerm>>({ category: 'General' });

  const handleDelete = (id: string) => {
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all terms to the system defaults? This will lose any custom terms.')) {
      setTerms(DEFAULT_TERMS);
    }
  };

  const handleAddTerm = () => {
    if (!newTerm.name || !newTerm.category) return;
    
    const term: StandardTerm = {
      id: Date.now().toString(),
      name: newTerm.name,
      description: newTerm.description || '',
      category: newTerm.category as any,
    };

    setTerms(prev => [...prev, term]);
    setNewTerm({ category: 'General', name: '', description: '' });
    setIsAdding(false);
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
              <Settings className="w-5 h-5 text-brand-600" />
              Extraction Terms Manager
            </h2>
            <p className="text-xs text-slate-500">Define the standard terms AI should look for in documents.</p>
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
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Term
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Add New Term Form */}
          {isAdding && (
            <div className="bg-white p-6 rounded-xl shadow-md border border-brand-200 animate-in slide-in-from-top-2 mb-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800">Add New Term</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Term Name</label>
                  <input 
                    type="text" 
                    value={newTerm.name || ''}
                    onChange={e => setNewTerm({...newTerm, name: e.target.value})}
                    placeholder="e.g. EBITDA Cushion"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Category</label>
                  <select 
                    value={newTerm.category}
                    onChange={e => setNewTerm({...newTerm, category: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description (Instructions for AI)</label>
                  <input 
                    type="text" 
                    value={newTerm.description || ''}
                    onChange={e => setNewTerm({...newTerm, description: e.target.value})}
                    placeholder="Describe what the AI should extract..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handleAddTerm}
                  disabled={!newTerm.name}
                  className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Term
                </button>
              </div>
            </div>
          )}

          {/* Terms List */}
          {CATEGORIES.map(category => {
            const categoryTerms = terms.filter(t => t.category === category);
            if (categoryTerms.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    category === 'Financial' ? 'bg-green-500' :
                    category === 'Risk' ? 'bg-red-500' :
                    category === 'Covenants' ? 'bg-blue-500' :
                    'bg-slate-400'
                  }`}></span>
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryTerms.map(term => (
                    <div key={term.id} className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-brand-200 relative">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-slate-800">{term.name}</h4>
                        <button 
                          onClick={() => handleDelete(term.id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove term"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2" title={term.description}>
                        {term.description || <span className="italic opacity-50">No description provided</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};