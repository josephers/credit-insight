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
 * Combined function: Extracts terms AND performs benchmarking in one pass.
 * This reduces latency by 50% compared to sequential calls.
 */
export const extractAndBenchmark = async (
  fileBase64: string,
  mimeType: string,
  terms: StandardTerm[]
): Promise<{ extraction: ExtractionResult[], benchmarking: BenchmarkResult[] }> => {
  try {
    const termListString = terms.map(t => `${t.name} (${t.description || ''})`).join('\n');
    const benchmarkContext = JSON.stringify(MARKET_BENCHMARK, null, 2);
    const safeMimeType = sanitizeMimeType(mimeType);

    const prompt = `
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
      - Determine 'confidence' of the extraction.
      - SIMULTANEOUSLY compare the extracted value against the provided Market Benchmark key (if it exists).
      - Determine 'variance':
         - 'Green': Term is standard/neutral or better/safer for lender than benchmark.
         - 'Yellow': Term deviates slightly or is slightly looser.
         - 'Red': Term is aggressive, off-market, or significantly looser (riskier).
         - 'N/A': If the term is not in the Market Benchmark list or cannot be compared.
      - Provide 'commentary' explaining the variance or lack thereof.
      
      If a term is not found, set value="Not Found".
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { text: prompt },
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
              // Extraction Fields
              term: { type: Type.STRING },
              value: { type: Type.STRING },
              sourceSection: { type: Type.STRING },
              evidence: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
              
              // Benchmark Fields
              benchmarkValue: { type: Type.STRING },
              variance: { type: Type.STRING, enum: ['Green', 'Yellow', 'Red', 'N/A'] },
              commentary: { type: Type.STRING }
            },
            required: ['term', 'value', 'sourceSection', 'evidence', 'confidence', 'benchmarkValue', 'variance', 'commentary']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const rawResults = JSON.parse(text);

    // Split the combined result into the two expected structures
    const extraction: ExtractionResult[] = [];
    const benchmarking: BenchmarkResult[] = [];

    rawResults.forEach((r: any) => {
      // 1. Extraction Object
      extraction.push({
        term: r.term,
        value: r.value,
        sourceSection: r.sourceSection,
        evidence: r.evidence,
        confidence: r.confidence
      });

      // 2. Benchmark Object (only if applicable)
      if (r.variance !== 'N/A' && r.variance !== null) {
        benchmarking.push({
          term: r.term,
          extractedValue: r.value,
          benchmarkValue: r.benchmarkValue || MARKET_BENCHMARK[r.term as keyof typeof MARKET_BENCHMARK] || 'N/A',
          variance: r.variance,
          commentary: r.commentary
        });
      }
    });

    return { extraction, benchmarking };

  } catch (error) {
    console.error("Combined analysis error:", error);
    throw error;
  }
};

/**
 * Extracts specific terms from a document using Gemini.
 * @deprecated Use extractAndBenchmark for better performance.
 */
export const extractTermsFromDocument = async (
  fileBase64: string,
  mimeType: string,
  terms: StandardTerm[]
): Promise<ExtractionResult[]> => {
  const { extraction } = await extractAndBenchmark(fileBase64, mimeType, terms);
  return extraction;
};

/**
 * Compares extracted terms against a market benchmark using Gemini.
 * @deprecated Use extractAndBenchmark for better performance.
 */
export const compareWithBenchmark = async (
  extractedResults: ExtractionResult[]
): Promise<BenchmarkResult[]> => {
  // Fallback if needed, but we prefer the combined call.
  // We keep the old logic just in case partial re-runs are needed, 
  // though for this app we'll switch to the combined one.
  try {
    const relevantExtractions = extractedResults.filter(r => Object.keys(MARKET_BENCHMARK).includes(r.term));
    if (relevantExtractions.length === 0) return [];
    
    const benchmarkContext = JSON.stringify(MARKET_BENCHMARK, null, 2);
    const extractionContext = JSON.stringify(relevantExtractions.map(r => ({ term: r.term, value: r.value })), null, 2);

    const prompt = `
      COMPARE Current Deal Terms against Market Benchmark.
      BENCHMARK: ${benchmarkContext}
      DEAL: ${extractionContext}
      Return JSON array with variance (Green/Yellow/Red) and commentary.
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