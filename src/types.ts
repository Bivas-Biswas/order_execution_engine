export type OrderStatus =
    | 'pending'
    | 'routing'
    | 'building'
    | 'submitted'
    | 'confirmed'
    | 'failed';


export interface OrderRequest {
    inputMint: string;
    outputMint: string;
    amount: number;
}


export interface OrderRecord {
    id: string;
    input_mint: string;
    output_mint: string;
    amount: number;
    status: OrderStatus;
    venue?: string | null;
    execution_price?: number | null;
    tx_hash?: string | null;
    error?: string | null;
    created_at?: string;
}
