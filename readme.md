# Order Execution Engine

An mock order execution engine that processes Marker Order type with mockDEX routing and WebSocket status updates.

## Engine in Action

![System Demo](./images/order_demo.gif)

[Click here to see the whole demo video](youtube.com/watch?v=hnhcxS_VFW4)

## How to Run

1. Build and Start the Docker compose

```
sudo docker compose up --build
```

2. Now server is running at `localhost:3000`

3. Run the examples
   - Web UI open this file in the browser

   ```
   examples/index.html
   ```

   - standalone client node

   ```
   node examples/client.js
   ```

## How to run test

1. First run the server as mentioned above because all test are integration test

2. Run the test runner
   ```
   pnpm run test
   ```

## Design Decisions

- **Select Order Type as Market Order**
  It is most important and heavily used, in any Order Execution Engine. Also other two type of order Limit and Sniper are layer top of this.

- **Separation of concern + scalability**
  Backend, worker, Postgres, and Redis run as independent services, each in its own container, allowing them to scale independently based on load.

- **Redis usage**
  - Stores active orders with TTL for fast existence checks
  - Acts as the BullMQ backing store (queue + retries + job state)
  - Provides a pub/sub channel (`order_updates`) where the worker publishes lifecycle events and the backend WebSocket server subscribes

- **WebSocket behavior after order completion**
  To handle clients connecting after an order is already confirmed/failed, Redis is used to keep a temporary key. if the key exists, the backend serves the snapshot, and if it expired, the WebSocket connection is rejected immediately, preventing stale or invalid listeners.

- **All tests are integration tests**
  This system’s behavior depends on how the backend, worker, Redis, and Postgres interact, so full integration tests provide far more value than isolated unit tests.

- **Order creation happen in postgresql before sent the orderId to the client**
  In my current flow when client post order it insert inside the postgress, then add to the queue. This

## How my current design adaptable to other two order type:

1. **Limit Order — Execute when target price is reached**
   - Fits naturally into the existing API/worker split: store target price, let the worker watch quotes, and trigger execution when the condition is met.
   - Reuses the same routing and execution path as market orders.
     **Challenges:** designing the price watcher, choosing where to store pending orders, and handling many orders triggering at once.

2. **Sniper Order — Execute on token launch/migration**
   - Worker listens for on-chain events (liquidity added, pool created) and fires the order instantly.
   - Reuses the same execution pipeline as market orders.
     **Challenges:** building a fast event watcher and managing bursts of simultaneous triggers.

Both order types simply add a small condition layer on top of the existing market order execution engine.

## Additional Deliverables

1. Fully containerized setup — the entire system runs easily on any machine via Docker.
2. 15+ integration tests covering backend, worker, Redis, Postgres, and WebSocket flows.
3. GitHub Actions CI pipeline for automated formatter, linting, testing check on every push and pull request.
4. Simple Web UI included for testing and demonstration of order flow.

## System Diagrams and API

1. [System Architecture](./images/system_architecture.png)

2. [Market Order Flow](./images/post_order_flow.png)

3. [WebSocket Order Flow](./images/ws_order_flow.png)

4. [Postman API Collection](https://martian-escape-203806.postman.co/workspace/Order-Execution-Engine~2829cea7-132b-4dee-a974-ae2f3b863c13/collection/17405007-dfd4637c-7c7d-4dd0-bfe8-c5c2d6094970?action=share&creator=17405007&active-environment=17405007-bb2a3440-e63a-44a6-adf7-fae5a1056a1c)

## Technology used

- **Node.js (Fastify)** — High-performance backend API for order creation and WebSocket streaming.
- **BullMQ** — Job queue for asynchronous order execution handled by the worker.
- **Redis** — Used for active order tracking (TTL), BullMQ storage, and pub/sub updates.
- **PostgreSQL** — Durable storage for final order state, execution results, and error logs.
- **WebSockets** — Real-time order lifecycle updates to the client.
- **Docker & Docker Compose** — Containerized environment for backend, worker, Redis, and Postgres.
- **pnpm** — Fast and efficient package manager.
- **Vitest + Supertest** — Integration testing of API + WebSocket + worker flows.
- **TypeScript** — Strong typing and safer API/worker code.

## My Humble experience

1. This is the first time I've coded up a system from scratch in terms of scale and adaptivity. Before this, I had only theoretical knowledge of the system.
2. I used redis's multiple features all togethers so much.
3. Also, first-time experience of Fastify, Bullmq.
4. Enjoy the last 15+hrs to building this.
5. All this is possible because of ChatGPT, which reduces the research time.
