import { randomUUID } from 'crypto';

export type DexQuote = {
    venue: 'Raydium' | 'Meteora';
    price: number; // output per 1 input
    liquidity: number; // fake liquidity metric
};

export function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

export async function getMockQuote(venue: 'Raydium' | 'Meteora', input: string, output: string, amount: number): Promise<DexQuote> {
    // Simulate network / on-chain quote delay
    const delay = 1500 + Math.floor(Math.random() * 2000); // 1-3s
    await sleep(delay);

    // base price (mocked). We'll make Meteora slightly better on average.
    const base = venue === 'Meteora' ? 25 : 24.5;

    // add jitter -5% .. +5%
    const jitter = 1 + (Math.random() * 0.1 - 0.05);
    const price = +(base * jitter).toFixed(6);
    const liquidity = 1000 + Math.floor(Math.random() * 10000);

    return { venue, price, liquidity };
}


export async function getBestQuote(input: string, output: string, amount: number) {
    const [r1, r2] = await Promise.all([
        getMockQuote('Raydium', input, output, amount),
        getMockQuote('Meteora', input, output, amount),
    ]);

    return r1.price >= r2.price ? r1 : r2; // choose higher output per input
}

export async function mockCreateTransaction() {

}

// Set failure chance globally (0 = never fail, 1 = always fail)
export let mockSwapFailureChance = 0.10;  // 10% default

export function setMockSwapFailureChance(pct: number) {
    mockSwapFailureChance = Math.max(0, Math.min(1, pct));
}

export async function mockExecuteSwap(
    venue: "Raydium" | "Meteora",
    input: string,
    output: string,
    amount: number,
    slippagePct = 0.5
) {
    // Roll for failure
    const failureRoll = Math.random();

    if (failureRoll < mockSwapFailureChance) {
        // Pick a random mock error
        const errors = [
            `${venue} RPC timeout`,
            `${venue} insufficient liquidity for pair ${input}/${output}`,
            `${venue} slippage exceeded allowed threshold`,
            `${venue} execution server overloaded`,
            `${venue} transaction simulation failed`,
        ];

        const msg = errors[Math.floor(Math.random() * errors.length)];
        throw new Error(msg);
    }

    // Simulated network latency
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 250));

    // Fake tx hash
    const txHash = `mock_tx_${randomUUID().slice(0, 12)}`;

    // Mock execution price
    const base = venue === "Meteora" ? 25 : 24.5;
    const jitter = 1 + (Math.random() * 0.01 - 0.005);
    const executionPrice = +(
        base * jitter * (1 - slippagePct / 100)
    ).toFixed(6);

    return { txHash, executionPrice };
}