import { getDuneData, getOneInchQuote, getHistoricalTokenPrice } from '../utils/api.js';
import type { SwapTransaction, ComparisonResult } from '../types/index.js';

export async function compareWithOneInch(walletAddress: string): Promise<ComparisonResult> {
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    throw new Error('Invalid wallet address format');
  }

  try {
    const transactions = await getDuneData(walletAddress, 10);

    if (transactions.length === 0) {
      return {
        success: true,
        wallet: walletAddress,
        totalTransactions: 0,
        totalActualGas: 0,
        totalOptimalGas: 0,
        gasSavingsPotential: 0,
        averageSlippageActual: 0,
        recommendations: ['No transactions found for analysis'],
        detailedComparisons: [],
      };
    }

    const detailedComparisons = [];
    let totalActualGas = 0;
    let totalOptimalGas = 0;
    let totalSlippage = 0;
    let validComparisons = 0;

    for (const tx of transactions) {
      try {
        // Skip if we don't have token addresses
        if (!tx.from_token_address || !tx.to_token_address) {
          console.warn(`Skipping transaction ${tx.hash}: missing token addresses`);
          continue;
        }

        // Convert amount to wei for 1inch API
        const amountInWei = (tx.from_amount * Math.pow(10, 18)).toString();

        // Get 1inch optimal quote for comparison
        const quote = await getOneInchQuote(
          tx.from_token_address,
          tx.to_token_address,
          amountInWei,
          tx.from_token,
          tx.to_token
        );

        const actualGas = tx.gas_used * tx.gas_price;
        const optimalGas = parseInt(quote.estimatedGas) * tx.gas_price;

        totalActualGas += actualGas;
        totalOptimalGas += optimalGas;

        // Calculate actual slippage if we have the data
        const actualSlippage = tx.slippage || 0;
        totalSlippage += actualSlippage;
        validComparisons++;

        // Calculate amount differences
        const optimalAmountOut = parseFloat(quote.toAmount) / Math.pow(10, 18);
        const actualAmountOut = tx.to_amount;

        detailedComparisons.push({
          txHash: tx.hash,
          actualRoute: tx.dex,
          optimalRoute: quote.protocols[0]?.[0] || '1inch Aggregated',
          gasDifference: actualGas - optimalGas,
          slippageDifference: actualSlippage, // Real slippage from transaction
          actualAmountOut,
          optimalAmountOut,
        });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error comparing transaction ${tx.hash}:`, error);
        // Continue with other transactions even if one fails
      }
    }

    const gasSavingsPotential = Math.max(0, totalActualGas - totalOptimalGas);
    const averageSlippageActual = validComparisons > 0 ? totalSlippage / validComparisons : 0;

    // Generate intelligent recommendations based on actual data
    const recommendations = generateRecommendations(
      transactions,
      gasSavingsPotential,
      totalActualGas,
      averageSlippageActual,
      detailedComparisons
    );

    return {
      success: true,
      wallet: walletAddress,
      totalTransactions: transactions.length,
      totalActualGas,
      totalOptimalGas,
      gasSavingsPotential,
      averageSlippageActual: Math.round(averageSlippageActual * 100) / 100,
      recommendations,
      detailedComparisons,
    };
  } catch (error) {
    console.error('Error in comparison analysis:', error);
    throw new Error(`Failed to perform comparison analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateRecommendations(
  transactions: SwapTransaction[],
  gasSavingsPotential: number,
  totalActualGas: number,
  averageSlippage: number,
  comparisons: any[]
): string[] {
  const recommendations: string[] = [];

  // Gas efficiency recommendations
  if (gasSavingsPotential > 0) {
    const savingsPercentage = (gasSavingsPotential / totalActualGas) * 100;
    recommendations.push(`Consider using 1inch aggregator for better gas efficiency`);
    recommendations.push(`Potential gas savings: ${(gasSavingsPotential / 1e9).toFixed(4)} Gwei (${savingsPercentage.toFixed(1)}%)`);
  } else {
    recommendations.push('Your gas usage is already quite efficient!');
  }

  // DEX-specific recommendations
  const dexUsage = transactions.reduce((acc, tx) => {
    acc[tx.dex] = (acc[tx.dex] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostUsedDex = Object.entries(dexUsage).sort(([,a], [,b]) => b - a)[0];
  if (mostUsedDex && mostUsedDex[0] === 'Uniswap V2') {
    recommendations.push('Consider upgrading to Uniswap V3 for better capital efficiency and lower slippage');
  }

  // Slippage recommendations
  if (averageSlippage > 1.0) {
    recommendations.push(`Your average slippage is ${averageSlippage.toFixed(2)}% - consider using limit orders or splitting large trades`);
  } else if (averageSlippage > 0.5) {
    recommendations.push('Consider adjusting slippage tolerance or timing trades during less volatile periods');
  }

  // Route optimization recommendations
  const suboptimalRoutes = comparisons.filter(c => c.gasDifference > 0).length;
  if (suboptimalRoutes > comparisons.length * 0.3) {
    recommendations.push('Many of your trades used suboptimal routes - consider using DEX aggregators');
  }

  // Volume-based recommendations
  const highValueTrades = transactions.filter(tx => (tx.usd_value || 0) > 1000).length;
  if (highValueTrades > 0) {
    recommendations.push('For high-value trades, consider using professional trading interfaces with better routing');
  }

  return recommendations;
}