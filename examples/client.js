const WebSocket = require("ws");

async function run() {
  const res = await fetch("http://localhost:3000/api/orders/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputMint: "SOL", outputMint: "USDC", amount: 1.5, slippage_pct: 0.00001 }), 
    // I want to swap 1.5 SOL to USDC with slippagePac 0.5(default)
  });

  const { orderId } = await res.json();
  console.log("orderId:", orderId);

  const ws = new WebSocket("ws://localhost:3000/api/orders/ws?orderId=" + orderId);

  ws.on("open", () => console.log("WS open"));
  ws.on("message", (msg) => console.log("WS:", msg.toString()));
}

run();
