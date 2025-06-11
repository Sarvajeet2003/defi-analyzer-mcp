import { getUserTransactions } from './transactions.js';
import { compareWithOneInch } from './comparison.js';
import { getTokenPrice } from '../utils/api.js';
import type { SwapReportData } from '../types/index.js';

export async function generateSwapReport(walletAddress: string): Promise<SwapReportData> {
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    throw new Error('Invalid wallet address format');
  }

  try {
    // Get transaction and comparison data
    const [transactions, comparison] = await Promise.all([
      getUserTransactions(walletAddress, 50),
      compareWithOneInch(walletAddress),
    ]);

    if (transactions.length === 0) {
      return {
        success: true,
        wallet: walletAddress,
        reportGeneratedAt: new Date().toISOString(),
        summary: {
          totalSwaps: 0,
          totalVolumeUSD: 0,
          averageGasUsed: 0,
          mostUsedDEX: 'N/A',
          efficiencyScore: 0,
        },
        gasAnalysis: {
          totalGasSpent: 0,
          averageGasPrice: 0,
          potentialSavings: 0,
          savingsPercentage: 0,
        },
        routingAnalysis: {
          optimalRoutes: 0,
          suboptimalRoutes: 0,
          missedOpportunities: ['No transactions found'],
        },
        recommendations: ['Start making some swaps to get analysis!'],
        timeRange: {
          from: new Date().toISOString(),
          to: new Date().toISOString(),
        },
      };
    }

    // Calculate real volume in USD
    const totalVolumeUSD = await calculateRealVolumeUSD(transactions);

    // Calculate gas statistics
    const totalGasSpent = transactions.reduce((sum, tx) => sum + (tx.gas_used * tx.gas_price), 0);
    const averageGasUsed = Math.round(transactions.reduce((sum, tx) => sum + tx.gas_used, 0) / transactions.length);
    const averageGasPrice = totalGasSpent / transactions.reduce((sum, tx) => sum + tx.gas_used, 0);

    // Find most used DEX based on actual data
    const dexCounts = transactions.reduce((counts, tx) => {
      counts[tx.dex] = (counts[tx.dex] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const mostUsedDEX = Object.entries(dexCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

    // Calculate real efficiency score based on multiple factors
    const efficiencyScore = calculateEfficiencyScore(
      comparison.gasSavingsPotential,
      totalGasSpent,
      comparison.averageSlippageActual,
      transactions
    );

    // Calculate real routing analysis
    const routingAnalysis = calculateRoutingAnalysis(comparison.detailedComparisons);

    // Generate comprehensive recommendations
    const recommendations = generateComprehensiveRecommendations(
      transactions,
      comparison,
      efficiencyScore,
      averageGasPrice,
      totalVolumeUSD
    );

    // Calculate real time range
    const timestamps = transactions.map(tx => new Date(tx.timestamp));
    const timeRange = {
      from: new Date(Math.min(...timestamps.map(d => d.getTime()))).toISOString(),
      to: new Date(Math.max(...timestamps.map(d => d.getTime()))).toISOString(),
    };

    const potentialSavings = Math.max(0, comparison.gasSavingsPotential);
    const savingsPercentage = totalGasSpent > 0 ? (potentialSavings / totalGasSpent) * 100 : 0;

    return {
      success: true,
      wallet: walletAddress,
      reportGeneratedAt: new Date().toISOString(),
      summary: {
        totalSwaps: transactions.length,
        totalVolumeUSD: Math.round(totalVolumeUSD * 100) / 100,
        averageGasUsed,
        mostUsedDEX,
        efficiencyScore: Math.round(efficiencyScore),
      },
      gasAnalysis: {
        totalGasSpent: Math.round(totalGasSpent),
        averageGasPrice: Math.round(averageGasPrice),
        potentialSavings: Math.round(potentialSavings),
        savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      },
      routingAnalysis,
      recommendations,
      timeRange,
    };
  } catch (error) {
    console.error('Error generating swap report:', error);
    throw new Error(`Failed to generate swap report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function calculateRealVolumeUSD(transactions: any[]): Promise<number> {
  let totalVolume = 0;

  for (const tx of transactions) {
    try {
      // Use the USD value from Dune if available
      if (tx.usd_value && tx.usd_value > 0) {
        totalVolume += tx.usd_value;
      } else {
        // Fallback: try to get current price and estimate
        const tokenPrice = await getTokenPrice(tx.from_token);
        if (tokenPrice > 0) {
          totalVolume += tx.from_amount * tokenPrice;
        }
      }
    } catch (error) {
      console.error(`Error calculating volume for transaction ${tx.hash}:`, error);
      // Continue with other transactions
    }
  }

  return totalVolume;
}

function calculateEfficiencyScore(
  gasSavingsPotential: number,
  totalGasSpent: number,
  averageSlippage: number,
  transactions: any[]
): number {
  let score = 100;

  // Deduct points for gas inefficiency
  if (totalGasSpent > 0) {
    const gasEfficiencyPenalty = (gasSavingsPotential / totalGasSpent) * 50;
    score -= gasEfficiencyPenalty;
  }

  // Deduct points for high slippage
  const slippagePenalty = Math.min(averageSlippage * 10, 30);
  score -= slippagePenalty;

  // Deduct points for using outdated DEXes
  const outdatedDexCount = transactions.filter(tx => 
    tx.dex.includes('V1') || tx.dex.includes('SushiSwap')
  ).length;
  const outdatedPenalty = (outdatedDexCount / transactions.length) * 20;
  score -= outdatedPenalty;

  // Bonus for consistent trading
  const uniqueDexes = new Set(transactions.map(tx => tx.dex)).size;
  if (uniqueDexes <= 3 && transactions.length > 5) {
    score += 5; // Bonus for focused trading
  }

  return Math.max(0, Math.min(100, score));
}

function calculateRoutingAnalysis(detailedComparisons: any[]) {
  if (detailedComparisons.length === 0) {
    return {
      optimalRoutes: 0,
      suboptimalRoutes: 0,
      missedOpportunities: ['No comparison data available'],
    };
  }

  const optimalRoutes = detailedComparisons.filter(c => c.gasDifference <= 0).length;
  const suboptimalRoutes = detailedComparisons.length - optimalRoutes;

  const missedOpportunities: string[] = [];

  // Analyze missed opportunities
  const significantSavings = detailedComparisons.filter(c => c.gasDifference > 50000);
  if (significantSavings.length > 0) {
    missedOpportunities.push(`${significantSavings.length} transactions could have saved significant gas`);
  }

  const betterAmountOuts = detailedComparisons.filter(c => 
    c.optimalAmountOut > c.actualAmountOut * 1.01
  );
  if (betterAmountOuts.length > 0) {
    missedOpportunities.push(`${betterAmountOuts.length} transactions could have gotten better rates`);
  }

  if (missedOpportunities.length === 0) {
    missedOpportunities.push('Your routing choices were generally optimal!');
  }

  return {
    optimalRoutes,
    suboptimalRoutes,
    missedOpportunities,
  };
}

function generateComprehensiveRecommendations(
  transactions: any[],
  comparison: any,
  efficiencyScore: number,
  averageGasPrice: number,
  totalVolumeUSD: number
): string[] {
  const recommendations: string[] = [];

  // Include comparison recommendations
  recommendations.push(...comparison.recommendations);

  // Efficiency-based recommendations
  if (efficiencyScore < 50) {
    recommendations.push('⚠️ Your trading efficiency is below average - consider using DEX aggregators');
  } else if (efficiencyScore < 70) {
    recommendations.push('💡 Theres room for improvement in your trading efficiency');
  } else if (efficiencyScore >= 90) {
    recommendations.push('🎉 Excellent trading efficiency! Youre doing great!');
  }

  // Gas price recommendations
  if (averageGasPrice > 100e9) { // > 100 Gwei
    recommendations.push('⛽ Consider timing your trades during lower gas periods (weekends, early morning UTC)');
  } else if (averageGasPrice < 20e9) { // < 20 Gwei
    recommendations.push('✅ Great job timing your trades during low gas periods!');
  }

  // Volume-based recommendations
  if (totalVolumeUSD > 100000) {
    recommendations.push('💰 For high-volume trading, consider using professional tools like DeFiSaver or Instadapp');
  } else if (totalVolumeUSD < 1000) {
    recommendations.push('🔍 For small trades, consider batching transactions to save on gas costs');
  }

  // DEX diversity recommendations
  const uniqueDexes = new Set(transactions.map(tx => tx.dex)).size;
  if (uniqueDexes === 1) {
    recommendations.push('🔄 Consider diversifying across multiple DEXes for better rates and reduced slippage');
  }

  // Frequency-based recommendations
  if (transactions.length > 20) {
    recommendations.push('📊 Consider using DCA (Dollar Cost Averaging) strategies for frequent trading');
  }

  return recommendations;
}