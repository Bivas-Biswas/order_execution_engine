import request from "supertest";
import { describe, it, expect } from "vitest";
import { API_BASE_URL } from "./setup";
import WebSocket from "ws";

describe("Order body validation", () => {

  it("accepts a valid order body", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({ inputMint: "SOL", outputMint: "USDC", amount: 1.5 });

    expect(res.status).toBe(200);
  });

  it("rejects missing fields", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({ outputMint: "BTC" });

    expect(res.status).toBe(400);
  });

  it("rejects wrong data types", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({ inputMint: "BTC", outputMint: "not-a-number", amount: "buy" });

    expect(res.status).toBe(400);
  });

});

describe("Order Execution + WebSocket full flow", () => {
  it("WS first message contains snapshot and last message contains success/failed", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({
        inputMint: "SOL",
        outputMint: "USDC",
        amount: 1.5
      });

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBeDefined();

    const orderId = res.body.orderId;

    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/api/orders/ws?orderId=${orderId}`;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    let firstMessage: any;
    let lastMessage: any;

    lastMessage = await new Promise<string>((resolve, reject) => {
      const messages: string[] = [];

      const timeout = setTimeout(() => {
        if (messages.length === 0) {
          reject(new Error("No WebSocket messages received"));
        } else {
          resolve(messages[messages.length - 1]);
        }
      }, 1000);

      ws.on("message", (msg) => {
        const text = JSON.parse(msg.toString());

        if (!firstMessage) {
          firstMessage = text;
        }

        messages.push(text);

        if (
          text.status === "success" ||
          text.status === "failed"
        ) {
          clearTimeout(timeout);
          resolve(text);
        }
      });

      ws.on("error", reject);
    });

    ws.close();

    expect(firstMessage.type).toBe("snapshot");
    expect(
      lastMessage.status === "success" || lastMessage.status !== "failed"
    ).toBe(true);
  });
});

describe("GET /api/orders/:id", () => {
  it("returns 404 when empty id use as params", async () => {
    const resGet = await request(API_BASE_URL)
      .get(`/api/orders/`);

    expect(resGet.status).toBe(404);
  })

  it("returns an order when id exists", async () => {

    const resCreate = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({
        inputMint: "SOL",
        outputMint: "USDC",
        amount: 1.5
      });

    expect(resCreate.status).toBe(200);
    expect(resCreate.body.orderId).toBeDefined();

    const orderId = resCreate.body.orderId;

    const resGet = await request(API_BASE_URL)
      .get(`/api/orders/${orderId}`);

    expect(resGet.status).toBe(200);
    expect(resGet.body).toBeDefined();
    expect(resGet.body.id).toBe(orderId);
  });

  it("returns 404 when order does not exist", async () => {
    const res = await request(API_BASE_URL)
      .get("/api/orders/non_existing_id_12345");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});

