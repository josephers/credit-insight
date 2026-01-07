import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult, StandardTerm, ChatMessage, BenchmarkResult, WebFinancialData, BenchmarkData, AIProvider } from "../types";
import { MARKET_BENCHMARK } from "../constants";
import * as pdfjsModule from 'https://esm.sh/pdfjs-dist@3.11.174';

// Handle ESM default export quirk for pdfjs-dist
const pdfjsLib = (pdfjsModule as any).default || pdfjsModule;

// Initialize PDF.js worker
if (pdfjsLib.GlobalWorkerOptions) {
  // Use CDNJS for the worker to ensure we get a classic script (UMD) compatible with standard Worker loading
  // esm.sh/build/pdf.worker.min.js often returns an ES module which causes "import outside module" errors in workers
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const gemini = new GoogleGenAI({ apiKey: process.env.API_KEY });
const GEMINI_MODEL = 'gemini-3-flash-preview';

// Azure Config
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;

/**
 * Try to fetch a fresh token from the backend middleware (Vite dev server).
 */
const fetchDynamicAzureToken = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/auth/azure-token');
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        return data.token;
      }
    }
  } catch (e) {
    // Ignore errors, we will fallback to ENV
  }
  return null;
};

/**
 * Helper: Generate Azure Headers based on available Auth method.
 * Prioritizes:
 * 1. Fresh Token from Backend (Azure Identity / Auto-refresh)
 * 2. Static Env Token (AZURE_OPENAI_AD_TOKEN)
 * 3. API Key (AZURE_OPENAI_API_KEY)
 */
const getAzureHeaders = async () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 1. Try dynamic token first
  let token = await fetchDynamicAzureToken();

  // 2. Fallback to static env token
  if (!token && process.env.AZURE_OPENAI_AD_TOKEN) {
    token = process.env.AZURE_OPENAI_AD_TOKEN;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (AZURE_KEY) {
    headers['api-key'] = AZURE_KEY;
  } else {
    throw new Error("Missing Azure configuration. Please set AZURE_OPENAI_API_KEY or ensure @azure/identity is configured.");
  }

  return headers;
};

/**
 * Helper: Handle Azure API Errors with specific advice for RBAC/Auth.
 */
const handleAzureError = async (response: Response) => {
  const errorText = await response.text();
  let errorMessage = `Azure Error: ${response.status} ${response.statusText}`;
  
  if (response.status === 401 || response.status === 403) {
    errorMessage += `\n\nAuth Failed. \n1. Check Token Audience (see console).\n2. Ensure your user has the 'Cognitive Services OpenAI User' role assigned in Azure IAM.`;
  }
  
  throw new Error(`${errorMessage} - ${errorText}`);
};

/**
 * Helper to ensure MIME type is supported by Gemini.
 */
const sanitizeMimeType = (mimeType: string): string => {
  if (mimeType === 'multipart/related') return 'text/html';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'text/plain'; 
  return mimeType;
};

/**
 * Extract text from PDF using PDF.js (Client-side)
 * Required because Azure OpenAI Chat Completions doesn't accept PDF bytes.
 */
const extractTextFromPdf = async (base64Data: string): Promise<string> => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Ensure worker is ready
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
       pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  } catch (error) {
    console.error("PDF Extraction Failed", error);
    throw new Error("Failed to extract text from PDF for Azure analysis. " + (error instanceof Error ? error.message : String(error)));
  }
};

/**
 * Core function to handle Text/PDF content for Azure
 */
const prepareContentForAzure = async (fileBase64: string, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    return await extractTextFromPdf(fileBase64);
  } else {
    // For text/html/txt, just decode
    return atob(fileBase64);
  }
};

// --- API IMPLEMENTATIONS ---

export const extractAndBenchmark = async (
  fileBase64: string,
  mimeType: string,
  terms: StandardTerm[],
  customBenchmarks?: BenchmarkData,
  provider: AIProvider = 'gemini'
): Promise<{ extraction: ExtractionResult[], benchmarking: BenchmarkResult[] }> => {
  
  const termListString = terms.map(t => `${t.name} (${t.description || ''})`).join('\n');
  const benchmarkData = customBenchmarks || MARKET_BENCHMARK;
  const benchmarkContext = JSON.stringify(benchmarkData, null, 2);

  const systemPrompt = `
      You are an expert Senior Credit Officer analyzing a corporate credit agreement.
      
      Your task is two-fold:
      1. EXTRACT specific terms from the document.
      2. COMPARE those extracted terms against a Market Benchmark to determine risk variance.
      
      TERMS TO EXTRACT:
      ${termListString}
      
      MARKET BENCHMARK (Standard / Conservative Profile):
      ${benchmarkContext}
      
      INSTRUCTIONS:
      - For each term, extract the 'value' (concise but complete), 'sourceSection', and 'evidence' (verbatim quote).
      - Determine 'confidence' of the extraction (High/Medium/Low).
      - SIMULTANEOUSLY compare the extracted value against the provided Market Benchmark key.
      - Determine 'variance': 'Green', 'Yellow', 'Red', or 'N/A'.
      - Provide 'commentary'.
      
      If a term is not found, set value="Not Found".
      
      RETURN JSON ARRAY.
  `;

  try {
    let rawResults: any[] = [];

    if (provider === 'azure') {
      if (!AZURE_ENDPOINT) throw new Error("Azure OpenAI Endpoint not configured");

      const textContent = await prepareContentForAzure(fileBase64, mimeType);
      const headers = await getAzureHeaders();
      
      // Removed 'temperature' for Azure to support Reasoning Models (o1) which don't support it.
      const response = await fetch(`${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt + "\nRespond with a JSON object containing a key 'results' which is the array of items." },
            { role: 'user', content: `Analyze this credit agreement content:\n\n${textContent.substring(0, 100000)}` } // Truncate if too huge
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) await handleAzureError(response);
      
      const json = await response.json();
      const content = json.choices[0].message.content;
      rawResults = JSON.parse(content).results;

    } else {
      // GEMINI IMPLEMENTATION
      const safeMimeType = sanitizeMimeType(mimeType);
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { inlineData: { mimeType: safeMimeType, data: fileBase64 } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                value: { type: Type.STRING },
                sourceSection: { type: Type.STRING },
                evidence: { type: Type.STRING },
                confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                benchmarkValue: { type: Type.STRING },
                variance: { type: Type.STRING, enum: ['Green', 'Yellow', 'Red', 'N/A'] },
                commentary: { type: Type.STRING }
              },
              required: ['term', 'value', 'sourceSection', 'evidence', 'confidence', 'benchmarkValue', 'variance', 'commentary']
            }
          }
        }
      });
      rawResults = JSON.parse(response.text!);
    }

    // Map Results
    const extraction: ExtractionResult[] = [];
    const benchmarking: BenchmarkResult[] = [];

    rawResults.forEach((r: any) => {
      extraction.push({
        term: r.term,
        value: r.value,
        sourceSection: r.sourceSection,
        evidence: r.evidence,
        confidence: r.confidence
      });

      if (r.variance !== 'N/A' && r.variance !== null) {
        benchmarking.push({
          term: r.term,
          extractedValue: r.value,
          benchmarkValue: r.benchmarkValue || benchmarkData[r.term] || 'N/A',
          variance: r.variance,
          commentary: r.commentary
        });
      }
    });

    return { extraction, benchmarking };

  } catch (error) {
    console.error(`Analysis failed using ${provider}:`, error);
    throw error;
  }
};

export const rebenchmarkTerms = async (
  extractedResults: ExtractionResult[],
  benchmarkData: BenchmarkData,
  provider: AIProvider = 'gemini'
): Promise<BenchmarkResult[]> => {
  const simplifiedExtractions = extractedResults.map(r => ({ term: r.term, value: r.value }));
  
  const prompt = `
      You are a Senior Credit Officer.
      RE-EVALUATE risk variance of these extracted terms against the provided benchmark.
      
      TARGET BENCHMARK:
      ${JSON.stringify(benchmarkData, null, 2)}
      
      EXTRACTED TERMS:
      ${JSON.stringify(simplifiedExtractions, null, 2)}
      
      INSTRUCTIONS:
      - Compare 'value' vs 'benchmark'.
      - Determine 'variance': 'Green', 'Yellow', 'Red', or 'N/A'.
      - Provide short 'commentary'.
      - RETURN JSON ARRAY.
  `;

  try {
    let rawResults: any[] = [];

    if (provider === 'azure') {
      const headers = await getAzureHeaders();
      // Removed 'temperature' for Azure
      const response = await fetch(`${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: prompt + "\nRespond with a JSON object containing a key 'results'." },
          ],
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) await handleAzureError(response);
      
      const json = await response.json();
      rawResults = JSON.parse(json.choices[0].message.content).results;

    } else {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                benchmarkValue: { type: Type.STRING },
                variance: { type: Type.STRING, enum: ['Green', 'Yellow', 'Red', 'N/A'] },
                commentary: { type: Type.STRING }
              },
              required: ['term', 'variance', 'commentary']
            }
          }
        }
      });
      rawResults = JSON.parse(response.text!);
    }

    const newBenchmarkResults: BenchmarkResult[] = [];
    rawResults.forEach((r: any) => {
      const originalExtraction = extractedResults.find(e => e.term === r.term);
      if (originalExtraction && r.variance !== 'N/A') {
        newBenchmarkResults.push({
          term: r.term,
          extractedValue: originalExtraction.value,
          benchmarkValue: r.benchmarkValue || benchmarkData[r.term] || 'N/A',
          variance: r.variance,
          commentary: r.commentary
        });
      }
    });

    return newBenchmarkResults;

  } catch (error) {
    console.error("Re-benchmarking error:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  fileBase64: string,
  mimeType: string,
  history: ChatMessage[],
  newMessage: string,
  provider: AIProvider = 'gemini'
): Promise<string> => {
  const systemContext = `You are a helpful AI assistant analyzing the attached Credit Agreement. Answer based ONLY on the provided document context. Quote sections.`;

  try {
    if (provider === 'azure') {
      const textContent = await prepareContentForAzure(fileBase64, mimeType);
      const headers = await getAzureHeaders();
      
      const messages = [
        { role: 'system', content: systemContext },
        { role: 'user', content: `Document Context:\n${textContent.substring(0, 50000)}\n\n(Truncated if too long)` },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: newMessage }
      ];

      // Removed 'temperature' for Azure
      const response = await fetch(`${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ messages })
      });
      
      if (!response.ok) await handleAzureError(response);
      
      const json = await response.json();
      return json.choices[0].message.content;

    } else {
      const safeMimeType = sanitizeMimeType(mimeType);
      const contents: any[] = history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));
      contents.push({
        role: 'user',
        parts: [
          { text: `Context: ${systemContext}\nUser Query: ${newMessage}` },
          { inlineData: { mimeType: safeMimeType, data: fileBase64 } }
        ]
      });

      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents,
      });
      return response.text || "No response";
    }
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const fetchFinancialsFromWeb = async (borrowerName: string, provider: AIProvider = 'gemini'): Promise<{ data: WebFinancialData[], sourceUrls: string[] }> => {
  if (provider === 'azure') {
    throw new Error("Live Web Search is not supported with Azure OpenAI in this version.");
  }
  
  // Existing Gemini Search Logic
  try {
    const prompt = `Find latest financial data for "${borrowerName}". SEC 10-K/10-Q. Extract LTM Revenue, EBITDA, Debt, Cash, Net Leverage. JSON Array.`;
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              metric: { type: Type.STRING },
              value: { type: Type.STRING },
              period: { type: Type.STRING },
              source: { type: Type.STRING }
            },
            required: ['metric', 'value', 'period', 'source']
          }
        }
      }
    });

    const data = JSON.parse(response.text!) as WebFinancialData[];
    const sourceUrls: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) sourceUrls.push(chunk.web.uri);
      });
    }
    return { data, sourceUrls: Array.from(new Set(sourceUrls)) };
  } catch (error) {
    console.error("Web Financials error:", error);
    throw error;
  }
};