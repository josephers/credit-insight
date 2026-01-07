import { StandardTerm, BenchmarkProfile } from './types';

export const DEFAULT_TERMS: StandardTerm[] = [
  // General
  { id: 'gen_1', name: 'Borrower Name', description: 'Legal name of the borrower', category: 'General' },
  { id: 'gen_2', name: 'Facility Amount', description: 'Total committed amount', category: 'General' },
  { id: 'gen_3', name: 'Maturity Date', description: 'Final maturity date', category: 'General' },
  { id: 'gen_4', name: 'Interest Rate / Margin', description: 'Applicable rate spreads', category: 'General' },
  { id: 'gen_5', name: 'Governing Law', description: 'Jurisdiction', category: 'General' },

  // Financial Covenants
  { id: 'fin_1', name: 'Max Total Net Leverage', description: 'Maximum allowed Total Net Leverage Ratio', category: 'Financial' },
  { id: 'fin_2', name: 'Min Interest Coverage', description: 'Minimum allowed Interest Coverage Ratio', category: 'Financial' },

  // Negative Covenants (Covenant Matrix)
  { id: 'cov_1', name: 'Limitation on Indebtedness', description: 'Restrictions on incurring additional debt', category: 'Covenants' },
  { id: 'cov_2', name: 'Limitation on Liens', description: 'Restrictions on creating liens', category: 'Covenants' },
  { id: 'cov_3', name: 'Limitation on Restricted Payments', description: 'Dividends, buybacks, and distributions', category: 'Covenants' },
  { id: 'cov_4', name: 'Limitation on Investments', description: 'Permitted investments and acquisitions', category: 'Covenants' },
  { id: 'cov_5', name: 'Limitation on Asset Sales', description: 'Restrictions on selling assets', category: 'Covenants' },
  { id: 'cov_6', name: 'Transactions with Affiliates', description: 'Rules for dealing with related parties', category: 'Covenants' },

  // Baskets (Basket Analysis)
  { id: 'bsk_1', name: 'General RP Basket', description: 'Fixed dollar amount for Restricted Payments', category: 'Baskets' },
  { id: 'bsk_2', name: 'Available Amount / Builder Basket', description: 'Retained ECF or Net Income that builds capacity', category: 'Baskets' },
  { id: 'bsk_3', name: 'Starter Basket Amount', description: 'Initial amount in the Builder Basket', category: 'Baskets' },
  { id: 'bsk_4', name: 'General Investment Basket', description: 'Fixed basket for general investments', category: 'Baskets' },
  { id: 'bsk_5', name: 'Ratio Debt Threshold', description: 'Leverage level permitting unlimited ratio debt', category: 'Baskets' },

  // Definitions (Mapping)
  { id: 'def_1', name: 'EBITDA Definition', description: 'Key add-backs and exclusions (synergies, one-offs)', category: 'Definitions' },
  { id: 'def_2', name: 'Consolidated Net Income', description: 'Definition of CNI', category: 'Definitions' },

  // Risk / Legal
  { id: 'rsk_1', name: 'Events of Default', description: 'Payment default, bankruptcy, cross-default thresholds', category: 'Risk' },
  { id: 'rsk_2', name: 'Collateral Grant', description: 'Scope of assets pledged', category: 'Risk' },
  { id: 'rsk_3', name: 'Guarantors', description: 'Entities providing guarantees', category: 'Risk' },
];

export const MARKET_BENCHMARK = {
  'Max Total Net Leverage': '4.50x',
  'Min Interest Coverage': '2.50x',
  'General RP Basket': '$25,000,000',
  'Available Amount / Builder Basket': '50% of CNI (Cumulative)',
  'Limitation on Indebtedness': 'Permitted Refinancing + Ratio Debt allowed if < Opening Leverage',
  'EBITDA Definition': 'Standard add-backs capped at 20% of EBITDA',
  'Events of Default': 'Customary, with Cross-Default > $10M',
  'Governing Law': 'New York',
  'Starter Basket Amount': '$10,000,000'
};

export const DEFAULT_BENCHMARK_PROFILES: BenchmarkProfile[] = [
  {
    id: 'us_large_cap',
    name: 'US Large Cap (Standard)',
    data: MARKET_BENCHMARK
  },
  {
    id: 'us_middle_market',
    name: 'US Middle Market',
    data: {
      ...MARKET_BENCHMARK,
      'Max Total Net Leverage': '3.50x',
      'Min Interest Coverage': '3.00x',
      'General RP Basket': '$5,000,000',
      'Starter Basket Amount': '$0',
      'Events of Default': 'Tightened cure periods'
    }
  },
  {
    id: 'canada_standard',
    name: 'Canada Standard',
    data: {
      ...MARKET_BENCHMARK,
      'Governing Law': 'Ontario / Canadian Federal',
      'Max Total Net Leverage': '4.00x',
      'General RP Basket': 'CAD $10,000,000',
      'Starter Basket Amount': 'CAD $5,000,000'
    }
  }
];

export const MAX_FILE_SIZE_MB = 20;

export const SUGGESTED_QUESTIONS = [
  "What are the mandatory prepayment triggers?",
  "List all baskets available for dividends/restricted payments.",
  "What is included/excluded from EBITDA?",
  "Are there any 'J.Crew' or 'Chewy' blocker provisions?",
  "What are the conditions to incur additional pari passu debt?",
  "Summarize the events of default and cure periods."
];