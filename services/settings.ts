import { AppSettings, StandardTerm, BenchmarkData } from '../types';
import { DEFAULT_TERMS, MARKET_BENCHMARK } from '../constants';

const API_URL = '/api/settings';

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      const json = await response.json();
      if (json) {
        return {
            terms: json.terms || DEFAULT_TERMS,
            benchmarks: json.benchmarks || MARKET_BENCHMARK
        };
      }
    }
  } catch (error) {
    console.warn("Failed to fetch settings from server, using defaults", error);
  }
  
  // Return defaults if fetch fails or no file exists
  return {
    terms: DEFAULT_TERMS,
    benchmarks: MARKET_BENCHMARK
  };
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch (error) {
    console.error("Failed to save settings", error);
  }
};
