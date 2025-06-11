export { getUserTransactions } from './transactions.js';
export { compareWithOneInch } from './comparison.js';
export { generateSwapReport } from './report.js';

// Re-export types for convenience
export type { 
  SwapTransaction, 
  OneInchQuote, 
  ComparisonResult, 
  SwapReportData 
} from '../types/index.js';