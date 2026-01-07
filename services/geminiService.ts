import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult, StandardTerm, ChatMessage, BenchmarkResult, WebFinancialData } from "../types";
import { MARKET_BENCHMARK } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Helper to ensure MIME type is supported by Gemini.
 * Maps unsupported types (like multipart/related) to supported equivalents.
 */
const sanitizeMimeType = (mimeType: string): string => {
  if (mimeType === 'multipart/related') return 'text/html';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'text/plain'; // Fallback for Word if raw bytes sent (though ideal is extracting text)
  return mimeType;
};

/**
 * Extracts specific terms from a document using Gemini.
 */
export const extractTermsFromDocument = async (
  fileBase64: string,
  mimeType: string,
  terms: StandardTerm[]
): Promise<ExtractionResult[]> => {
  try {
    const termListString = terms.map(t => `${t.name} (${t.description || ''})`).join('\n');
    const safeMimeType = sanitizeMimeType(mimeType);

    const extractionPrompt = `
      You are an expert Senior Credit Officer analyzing a corporate credit agreement.
      
      Your task is to extract specific terms to generate a Structured Term Sheet.
      
      TERMS TO EXTRACT:
      ${termListString}
      
      INSTRUCTIONS:
      1. For each term, extract the 'value'. Be concise but complete (e.g., for baskets, include the $ amount and % cap).
      2. Provide the 'sourceSection' (e.g., "Section 6.01(a)"). This is CRITICAL for auditability.
      3. Provide 'evidence' (a direct verbatim quote).
      4. Set 'confidence' (High/Medium/Low).
      5. For "EBITDA Definition", explicitly list what is added back.
      6. For "Baskets", explicitly look for fixed dollar amounts and grower percentages.
      
      If a term is not found, value="Not Found", sourceSection="N/A", evidence="N/A".
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { text: extractionPrompt },
            {
              inlineData: {
                mimeType: safeMimeType,
                data: fileBase64
              }
            }
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
              confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
            },
            required: ['term', 'value', 'sourceSection', 'evidence', 'confidence']
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }
    
    return JSON.parse(text) as ExtractionResult[];

  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
};

/**
 * Compares extracted terms against a market benchmark using Gemini.
 */
export const compareWithBenchmark = async (
  extractedResults: ExtractionResult[]
): Promise<BenchmarkResult[]> => {
  try {
    // Filter only terms that exist in the benchmark
    const relevantExtractions = extractedResults.filter(r => Object.keys(MARKET_BENCHMARK).includes(r.term));
    
    if (relevantExtractions.length === 0) return [];

    const benchmarkContext = JSON.stringify(MARKET_BENCHMARK, null, 2);
    const extractionContext = JSON.stringify(relevantExtractions.map(r => ({ term: r.term, value: r.value })), null, 2);

    const prompt = `
      You are a Credit Portfolio Manager performing a benchmarking analysis.
      
      MARKET BENCHMARK (Standard / Conservative Profile):
      ${benchmarkContext}
      
      CURRENT DEAL TERMS:
      ${extractionContext}
      
      TASK:
      Compare the Current Deal Terms against the Market Benchmark.
      For each term, determine the 'variance' and provide 'commentary'.
      
      Variance Logic:
      - 'Green': The current deal term is standard, neutral, or better/more restrictive (safer for lender) than benchmark.
      - 'Yellow': The current deal term is slightly looser or deviates slightly from standard.
      - 'Red': The current deal term is aggressive, "off-market", or significantly looser (riskier for lender) than benchmark.
      
      Output a JSON array.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              extractedValue: { type: Type.STRING },
              benchmarkValue: { type: Type.STRING },
              variance: { type: Type.STRING, enum: ['Green', 'Yellow', 'Red'] },
              commentary: { type: Type.STRING }
            },
            required: ['term', 'extractedValue', 'benchmarkValue', 'variance', 'commentary']
          }
        }
      }
    });

    return JSON.parse(response.text!) as BenchmarkResult[];

  } catch (error) {
    console.error("Benchmark error:", error);
    return [];
  }
}

/**
 * Fetches latest financial data for a borrower using Google Search Grounding.
 */
export const fetchFinancialsFromWeb = async (
  borrowerName: string
): Promise<{ data: WebFinancialData[], sourceUrls: string[] }> => {
  try {
    const prompt = `
      Find the latest financial data for "${borrowerName}".
      
      Prioritize searching "SEC.gov" for the latest 10-K or 10-Q filings, or reputable financial news sources.
      
      Extract the following metrics if available:
      1. LTM Revenue (Last Twelve Months)
      2. LTM EBITDA
      3. Total Debt
      4. Cash & Cash Equivalents
      5. Net Leverage Ratio
      
      Return a JSON array where each item has:
      - metric (e.g., "LTM Revenue")
      - value (e.g., "$500M")
      - period (e.g., "Q3 2024" or "FY 2023")
      - source (Brief name of source, e.g. "SEC 10-Q")
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME, // Supports search tools
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
    
    // Extract Source URLs from Grounding Metadata
    const sourceUrls: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) {
          sourceUrls.push(chunk.web.uri);
        }
      });
    }

    // Deduplicate URLs
    const uniqueUrls = Array.from(new Set(sourceUrls));

    return { data, sourceUrls: uniqueUrls };

  } catch (error) {
    console.error("Web Financials error:", error);
    throw error;
  }
};

/**
 * Sends a chat message to Gemini with the document context.
 */
export const sendChatMessage = async (
  fileBase64: string,
  mimeType: string,
  history: ChatMessage[],
  newMessage: string
): Promise<string> => {
  try {
    const safeMimeType = sanitizeMimeType(mimeType);
    
    const contents: Array<{
      role: string;
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    }> = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    contents.push({
      role: 'user',
      parts: [
        { 
          text: `Context: You are a helpful AI assistant analyzing the attached Credit Agreement.
                 Instructions: Answer based ONLY on the provided document. Quote relevant sections.
                 
                 If the user asks about covenants, baskets, or definitions, provide exact references (e.g. Section 4.02).
                 If asked about "Leakage", look for unrestricted subsidiary designations and investment baskets.
                 
                 User Query: ${newMessage}` 
        },
        {
          inlineData: {
            mimeType: safeMimeType,
            data: fileBase64
          }
        }
      ]
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
    });
    
    return response.text || "I'm sorry, I couldn't generate a response.";

  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};