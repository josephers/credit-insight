import { AppSettings, StandardTerm, BenchmarkData, BenchmarkProfile } from '../types';
import { DEFAULT_TERMS, DEFAULT_BENCHMARK_PROFILES, MARKET_BENCHMARK } from '../constants';

const API_URL = '/api/settings';

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      const json = await response.json();
      if (json) {
        // Migration logic for old settings format
        let profiles = json.benchmarkProfiles;
        let activeId = json.activeProfileId;

        // If no profiles but legacy benchmarks exist
        if (!profiles && json.benchmarks) {
          profiles = [
            { id: 'legacy', name: 'Imported Defaults', data: json.benchmarks },
            ...DEFAULT_BENCHMARK_PROFILES.filter(p => p.id !== 'us_large_cap') // Add others
          ];
          activeId = 'legacy';
        }

        return {
            terms: json.terms || DEFAULT_TERMS,
            benchmarkProfiles: profiles || DEFAULT_BENCHMARK_PROFILES,
            activeProfileId: activeId || DEFAULT_BENCHMARK_PROFILES[0].id
        };
      }
    }
  } catch (error) {
    console.warn("Failed to fetch settings from server, using defaults", error);
  }
  
  // Return defaults if fetch fails or no file exists
  return {
    terms: DEFAULT_TERMS,
    benchmarkProfiles: DEFAULT_BENCHMARK_PROFILES,
    activeProfileId: DEFAULT_BENCHMARK_PROFILES[0].id
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