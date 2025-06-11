import { getDuneData } from '../utils/api.js';
import type { SwapTransaction } from '../types/index.js';

export async function getUserTransactions(
  walletAddress: string,
  limit: number = 10
): Promise<SwapTransaction[]> {
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    throw new Error('Invalid wallet address format');
  }

  if (walletAddress.length !== 42) {
    throw new Error('Invalid wallet address length');
  }

  try {
    const transactions = await getDuneData(walletAddress, limit);

    // Validate and clean the transaction data
    const validTransactions = transactions.filter(tx => {
      return tx.hash && 
             tx.from_token && 
             tx.to_token && 
             tx.from_amount > 0 && 
             tx.to_amount > 0 &&
             tx.gas_used > 0;
    });

    // Sort by timestamp (most recent first)
    validTransactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return validTransactions;
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    throw new Error(`Failed to fetch transaction data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}