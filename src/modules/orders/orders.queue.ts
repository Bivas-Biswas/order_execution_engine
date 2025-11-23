import { Queue } from "bullmq";
import { env } from "../../config/env";

export const ordersQueue = new Queue("orders", { connection: env.redis });
