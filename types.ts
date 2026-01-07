export interface StandardTerm {
  id: string;
  name: string;
  description?: string;
  category: 'General' | 'Covenants' | 'Baskets' | 'Definitions' | 'Risk' | 'Financial';
}

export interface ExtractionResult {
  term: string;
  value: string;
  sourceSection: string;
  evidence: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface BenchmarkResult {
  term: string;
  extractedValue: string;
  benchmarkValue: string;
  variance: 'Green' | 'Yellow' | 'Red'; // Green = In line/Better, Yellow = Minor Dev, Red = Aggressive/Worse
  commentary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface UploadedFile {
  name: string;
  type: string; // MIME type
  data: string; // Base64
  size: number;
}

export interface DealSession {
  id: string;
  borrowerName: string;
  file: UploadedFile;
  extractionResults: ExtractionResult[];
  benchmarkResults: BenchmarkResult[];
  chatHistory: ChatMessage[];
  lastModified: Date;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  CHAT = 'CHAT',
  TERMS = 'TERMS',
}