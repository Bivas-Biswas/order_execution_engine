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

  it("reject when slippage_pct is = 0", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({ inputMint: "BTC", outputMint: "not-a-number", amount: 1.5, slippage_pct: 0 });

    expect(res.status).toBe(400);
  })

  it("reject when slippage_pct is < 0", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({ inputMint: "BTC", outputMint: "not-a-number", amount: 1.5, slippage_pct: -1 });

    expect(res.status).toBe(400);
  })

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

    const messages: any[] = [];

    // Collect messages until socket closes
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (msg) => {
        const text = JSON.parse(msg.toString());
        messages.push(text);
      });

      ws.on("close", () => {
        resolve();
      });

      ws.on("error", reject);
    });

    // Now messages[] contains the full lifecycle
    expect(messages.length).toBeGreaterThan(0);

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    expect(firstMessage.type).toBe("snapshot");

    expect(
      lastMessage.status === "confirmed" || lastMessage.status === "failed"
    ).toBe(true);
  });


  it("reject when slippage_pct is < 0.01", async () => {
    const res = await request(API_BASE_URL)
      .post("/api/orders/execute")
      .send({
        inputMint: "SOL",
        outputMint: "USDC",
        amount: 1.5,
        slippage_pct: 0.001
      });

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBeDefined();

    const orderId = res.body.orderId;

    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/api/orders/ws?orderId=${orderId}`;
    const ws = new WebSocket(wsUrl);

    const messages: any[] = [];

    // Collect messages until socket closes
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (msg) => {
        const text = JSON.parse(msg.toString());
        messages.push(text);
      });

      ws.on("close", () => {
        resolve();
      });

      ws.on("error", reject);
    });

    // Now messages[] contains the full lifecycle
    expect(messages.length).toBeGreaterThan(0);

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    expect(firstMessage.type).toBe("snapshot");
    expect(lastMessage.status === "failed").toBe(true);
    expect(lastMessage.error.includes("Slippage tolerance")).toBe(true);
  });

  it("reject when old order try to connect through websocket", async () => {
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

    let messages: any[] = [];
    let err = false;

    // Collect messages until socket closes
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (msg) => {
        const text = JSON.parse(msg.toString());
        messages.push(text);
      });

      ws.on("close", () => {
        resolve();
      });

      ws.on("error", () => {
        err = true;
        reject();
      });
    });
    ws.close();

    // try for old order
    messages = [];
    err = false;
    const newWs = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      newWs.on("message", (msg) => {
        const text = JSON.parse(msg.toString());
        messages.push(text);
      });

      newWs.on("close", () => {
        resolve();
      });

      newWs.on("error", () => {
        err = true;
        reject();
      });
    });

    expect(messages[messages.length - 1].error).toBe("Order already processed");
    newWs.close();
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

describe("Order websocket api validation", () => {
  it("return Missing orderId", async () => {
    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/api/orders/ws?orderId=`;

    let message: any = null;
    let closed = false;
    let errorCaught: any = null;

    const ws = new WebSocket(wsUrl);

    // Prevent unhandled rejections/throws
    ws.on("error", (err) => {
      errorCaught = true;
    });

    ws.on("message", (msg) => {
      message = JSON.parse(msg.toString());
    });

    ws.on("close", () => {
      closed = true;
    });

    // Wait for events to happen or timeout
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Always close the socket to prevent events leaking after test ends
    ws.close();

    // If server sends an error message
    const messageHasOrderIdError =
      message && message.error === "Missing orderId";

    // The server must either close OR send an error
    expect(messageHasOrderIdError).toBe(true);
    expect(closed).toBe(true);
    expect(errorCaught).toBe(null);
  });

  it("return Order not found", async () => {
    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/api/orders/ws?orderId=random-orderId12121`;

    let message: any = null;
    let closed = false;
    let errorCaught: any = null;

    const ws = new WebSocket(wsUrl);

    // Prevent unhandled rejections/throws
    ws.on("error", (err) => {
      errorCaught = true;
    });

    ws.on("message", (msg) => {
      message = JSON.parse(msg.toString());
    });

    ws.on("close", () => {
      closed = true;
    });

    // Wait for events to happen or timeout
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Always close the socket to prevent events leaking after test ends
    ws.close();

    // If server sends an error message
    const messageHasError =
      message && message.error === "Order not found";

    // The server must either close OR send an error
    expect(messageHasError).toBe(true);
    expect(closed).toBe(true);
    expect(errorCaught).toBe(null);
  });
});

describe("All order detatils", () => {
  describe("GET /api/orders", () => {
    it("should return an array of orders", async () => {
      const res = await request(API_BASE_URL).get("/api/orders");

      expect(res.status).toBe(200);

      // Response must be an array
      expect(Array.isArray(res.body)).toBe(true);

      // If there are orders, check expected fields
      if (res.body.length > 0) {
        const order = res.body[0];

        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("status");
        expect(order).toHaveProperty("updated_at");
      }
    });
  });
})


