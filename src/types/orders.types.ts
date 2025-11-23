import { Type, Static } from "@sinclair/typebox";

export const OrderRequestSchema = Type.Object({
    inputMint: Type.String(),
    outputMint: Type.String(),
    amount: Type.Number()
});

export type OrderRequest = Static<typeof OrderRequestSchema>;

export const FetchOrderRequestSchema = Type.Object({
    id: Type.String(),
});

export type FetchOrderRequest = Static<typeof FetchOrderRequestSchema>;