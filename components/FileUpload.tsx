import React, { useCallback } from 'react';
import { Upload, FileText, Settings } from 'lucide-react';
import { UploadedFile } from '../types';
import { MAX_FILE_SIZE_MB } from '../constants';

interface FileUploadProps {
  onFileSelect: (file: UploadedFile) => void;
  onManageTerms: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onManageTerms }) => {
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = (e.target?.result as string).split(',')[1];
      
      // Determine MIME type with overrides for common issues
      let mimeType = file.type;
      const lowerName = file.name.toLowerCase();

      // Fix for browsers detecting HTML/MHTML as multipart/related which Gemini rejects
      if (mimeType === 'multipart/related') {
        mimeType = 'text/html';
      }
      
      // Force standard MIME types based on extension if explicit
      if (lowerName.endsWith('.txt')) {
        mimeType = 'text/plain';
      } else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
        mimeType = 'text/html';
      } else if (lowerName.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      }

      onFileSelect({
        name: file.name,
        type: mimeType || 'text/plain', // Default to text/plain if detection fails
        data: base64String,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  }, [onFileSelect]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50 relative">
      <div className="max-w-xl w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-12 border border-slate-200">
          <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10 text-brand-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Upload Credit Agreement</h2>
          <p className="text-slate-600 mb-8">
            Upload a PDF, Word, Text, or HTML document to begin RAG-based analysis. 
            We'll extract key terms and enable interactive chat.
          </p>
          
          <label className="relative inline-flex items-center justify-center px-8 py-4 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors cursor-pointer group shadow-md shadow-brand-500/20 mb-6">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span>Select Document</span>
            </span>
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.docx,.doc,.txt,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html"
              onChange={handleFileChange}
            />
          </label>
          
          <div className="flex justify-center">
             <button 
               onClick={onManageTerms}
               className="text-sm text-slate-500 hover:text-brand-600 font-medium flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-slate-50"
             >
               <Settings className="w-4 h-4" />
               Configure Standard Terms
             </button>
          </div>
          
          <p className="mt-6 text-xs text-slate-400">Supported: PDF, DOCX, TXT, HTML (Max {MAX_FILE_SIZE_MB}MB)</p>
        </div>
      </div>
    </div>
  );
};