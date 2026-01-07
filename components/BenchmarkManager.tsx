import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, RefreshCw, Scale, Globe, FolderPlus } from 'lucide-react';
import { BenchmarkData, BenchmarkProfile, StandardTerm } from '../types';
import { MARKET_BENCHMARK } from '../constants';

interface BenchmarkManagerProps {
  profiles: BenchmarkProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<BenchmarkProfile[]>>;
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  terms: StandardTerm[];
  onBack: () => void;
}

export const BenchmarkManager: React.FC<BenchmarkManagerProps> = ({ 
  profiles, 
  setProfiles, 
  activeProfileId,
  setActiveProfileId,
  terms, 
  onBack 
}) => {
  const [newBenchmarkTerm, setNewBenchmarkTerm] = useState('');
  const [newBenchmarkValue, setNewBenchmarkValue] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const benchmarks = activeProfile.data;

  // Create a list of terms that don't have benchmarks yet in the ACTIVE profile
  const availableTerms = terms.filter(t => !benchmarks[t.name]);

  const updateActiveProfile = (updatedData: BenchmarkData) => {
    setProfiles(prev => prev.map(p => 
      p.id === activeProfileId ? { ...p, data: updatedData } : p
    ));
  };

  const handleUpdateTerm = (term: string, value: string) => {
    updateActiveProfile({ ...benchmarks, [term]: value });
  };

  const handleDeleteTerm = (term: string) => {
    const next = { ...benchmarks };
    delete next[term];
    updateActiveProfile(next);
  };

  const handleAddTerm = () => {
    if (!newBenchmarkTerm || !newBenchmarkValue) return;
    updateActiveProfile({ ...benchmarks, [newBenchmarkTerm]: newBenchmarkValue });
    setNewBenchmarkTerm('');
    setNewBenchmarkValue('');
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: BenchmarkProfile = {
      id: Date.now().toString(),
      name: newProfileName,
      data: { ...MARKET_BENCHMARK } // Clone defaults
    };
    setProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setNewProfileName('');
    setIsCreatingProfile(false);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      alert("Cannot delete the last profile.");
      return;
    }
    if (confirm("Delete this benchmark profile?")) {
      const newProfiles = profiles.filter(p => p.id !== id);
      setProfiles(newProfiles);
      if (activeProfileId === id) {
        setActiveProfileId(newProfiles[0].id);
      }
    }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      
      {/* Sidebar: Profile List */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
           <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
             <ArrowLeft className="w-4 h-4" />
           </button>
           <h2 className="font-bold text-slate-800 text-sm">Profiles</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => setActiveProfileId(profile.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex justify-between items-center group ${
                activeProfileId === profile.id 
                  ? 'bg-brand-50 text-brand-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{profile.name}</span>
              {profiles.length > 1 && (
                <span 
                  onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-200">
          {isCreatingProfile ? (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <input 
                type="text" 
                autoFocus
                placeholder="Profile Name"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                className="w-full text-xs p-1 mb-2 border border-slate-300 rounded"
              />
              <div className="flex gap-2">
                <button onClick={handleCreateProfile} className="flex-1 bg-brand-600 text-white text-xs py-1 rounded">Save</button>
                <button onClick={() => setIsCreatingProfile(false)} className="flex-1 bg-slate-200 text-slate-600 text-xs py-1 rounded">Cancel</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsCreatingProfile(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              <FolderPlus className="w-4 h-4" /> New Group
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Edit Active Profile */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-600" />
              {activeProfile.name}
            </h2>
            <p className="text-xs text-slate-500">
              Manage standard values for this benchmark group.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Add New Term */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
               <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <Plus className="w-4 h-4 text-brand-600" />
                 Add Benchmark Criteria to {activeProfile.name}
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
                   onClick={handleAddTerm}
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
                  <div className="col-span-6 text-xs font-bold text-slate-500 uppercase">Benchmark Value</div>
                  <div className="col-span-1"></div>
               </div>
               
               {Object.entries(benchmarks).length === 0 && (
                 <div className="p-8 text-center text-slate-400">
                   No benchmarks defined for this profile.
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
                        onChange={e => handleUpdateTerm(term, e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-0 px-2 py-1 outline-none transition-all font-mono text-sm text-slate-700"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button 
                        onClick={() => handleDeleteTerm(term)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};