import { WebSocket } from '@fastify/websocket';
import { Static, Type } from '@sinclair/typebox';

export const OrderRequestSchema = Type.Object({
  inputMint: Type.String(),
  outputMint: Type.String(),
  amount: Type.Number(),
  slippage_pct: Type.Optional(
    Type.Number({ exclusiveMinimum: 0 }), // must be > 0
  ),
});

export type OrderRequest = Static<typeof OrderRequestSchema>;

export const FetchOrderRequestSchema = Type.Object({
  id: Type.String(),
});

export type FetchOrderRequest = Static<typeof FetchOrderRequestSchema>;

export type WebSocketConnection = WebSocket;
export type WSClients = Map<string, Set<WebSocketConnection>>;
