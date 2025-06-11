export interface SwapTransaction {
  hash: string;
  timestamp: string;
  from_token: string;
  to_token: string;
  from_token_address: string;
  to_token_address: string;
  from_amount: number;
  to_amount: number;
  gas_used: number;
  gas_price: number;
  dex: string;
  usd_value?: number;
  slippage?: number;
}

export interface OneInchQuote {
  toAmount: string;
  estimatedGas: string;
  protocols: string[][];
  fromTokenAmount?: string;
  toTokenAmount?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface DuneQueryResult {
  execution_id: string;
  query_id: number;
  state: string;
  result: {
    rows: DuneSwapRow[];
    metadata: {
      column_names: string[];
    };
  };
}

export interface DuneSwapRow {
  tx_hash: string;
  block_time: string;
  token_sold_symbol: string;
  token_bought_symbol: string;
  token_sold_address: string;
  token_bought_address: string;
  token_sold_amount: string;
  token_bought_amount: string;
  amount_usd: string;
  gas_used: string;
  gas_price: string;
  project: string;
  trader: string;
}

export interface ComparisonResult {
  success: boolean;
  wallet: string;
  totalTransactions: number;
  totalActualGas: number;
  totalOptimalGas: number;
  gasSavingsPotential: number;
  averageSlippageActual: number;
  recommendations: string[];
  detailedComparisons: Array<{
    txHash: string;
    actualRoute: string;
    optimalRoute: string;
    gasDifference: number;
    slippageDifference: number;
    actualAmountOut: number;
    optimalAmountOut: number;
  }>;
}

export interface SwapReportData {
  success: boolean;
  wallet: string;
  reportGeneratedAt: string;
  summary: {
    totalSwaps: number;
    totalVolumeUSD: number;
    averageGasUsed: number;
    mostUsedDEX: string;
    efficiencyScore: number;
  };
  gasAnalysis: {
    totalGasSpent: number;
    averageGasPrice: number;
    potentialSavings: number;
    savingsPercentage: number;
  };
  routingAnalysis: {
    optimalRoutes: number;
    suboptimalRoutes: number;
    missedOpportunities: string[];
  };
  recommendations: string[];
  timeRange: {
    from: string;
    to: string;
  };
}