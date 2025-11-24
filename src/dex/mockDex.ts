import { randomUUID } from 'crypto';

export type DexQuote = {
  venue: 'Raydium' | 'Meteora';
  price: number; // output per 1 input
  liquidity: number; // fake liquidity metric,
  expectedOut: number;
};

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function getMockQuote(
  venue: 'Raydium' | 'Meteora',
  input: string,
  output: string,
  amount: number,
): Promise<DexQuote> {
  const delay = 1500 + Math.floor(Math.random() * 2000);
  await sleep(delay);

  const base = venue === 'Meteora' ? 25 : 24.5;

  const jitter = 1 + (Math.random() * 0.1 - 0.05);
  const price = +(base * jitter).toFixed(6);

  const liquidity = 1000 + Math.floor(Math.random() * 10000);

  const expectedOut = +(price * amount).toFixed(6);

  return { venue, price, liquidity, expectedOut };
}

export async function getBestQuote(input: string, output: string, amount: number) {
  const [r1, r2] = await Promise.all([
    getMockQuote('Raydium', input, output, amount),
    getMockQuote('Meteora', input, output, amount),
  ]);

  return r1.price >= r2.price ? r1 : r2; // choose higher output per input
}

export async function mockCreateTransaction() {}

// Set failure chance globally (0 = never fail, 1 = always fail)
export let mockSwapFailureChance = 0.1; // 10% default

export function setMockSwapFailureChance(pct: number) {
  mockSwapFailureChance = Math.max(0, Math.min(1, pct));
}

type mockExecuteSwap = {
  venue: 'Raydium' | 'Meteora';
  input: string;
  output: string;
  amount: number;
  expectedOut: number;
  slippagePct: number;
};

export async function mockExecuteSwap({
  venue,
  input,
  output,
  amount,
  expectedOut,
  slippagePct = 0.5,
}: mockExecuteSwap) {
  // Reject extremely tiny slippage (too strict)
  if (slippagePct < 0.01) {
    return {
      error: `Slippage tolerance ${slippagePct}% is too small to execute a trade`,
    };
  }

  // Random failure injection
  const failureRoll = Math.random();
  if (failureRoll < mockSwapFailureChance) {
    const errors = [
      `${venue} RPC timeout`,
      `${venue} insufficient liquidity for pair ${input}/${output}`,
      `${venue} slippage exceeded allowed threshold`,
      `${venue} execution server overloaded`,
      `${venue} transaction simulation failed`,
    ];

    return {
      error: errors[Math.floor(Math.random() * errors.length)],
    };
  }

  await new Promise((r) => setTimeout(r, 100 + Math.random() * 250));

  // Simulate real market movement between quote and execution
  const executionMovement = 1 + (Math.random() * 0.04 - 0.02); // -2% to +2%
  const executionOut = +(expectedOut * executionMovement).toFixed(6);

  // Slippage limit
  const minAcceptableOut = +(expectedOut * (1 - slippagePct / 100)).toFixed(6);

  // If execution worse than allowed slippage -> fail
  if (executionOut < minAcceptableOut) {
    // throw new Error("Execution worse than allowed slippage");
    return {
      error: 'Execution worse than allowed slippage',
    };
  }

  // Otherwise success
  return {
    txHash: `mock_tx_${randomUUID().slice(0, 12)}`,
    executionOut,
    executionPrice: +(executionOut / amount).toFixed(6),
  };
}
