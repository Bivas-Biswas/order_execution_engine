import { redisSub } from "../../config/redis";
import { FastifyInstance } from "fastify";

export function registerOrderSubscriber(fastify: FastifyInstance, wsClients: Map<string, Set<any>>) {
    redisSub.on("message", (channel, message) => {
        if (channel !== "order_updates") return;

        try {
            const payload = JSON.parse(message);
            const { orderId } = payload;
            const clients = wsClients.get(orderId); // muticlient for same order
            if (!clients) return;

            for (const conn of clients) {
                conn.send(JSON.stringify(payload));
                if (payload.status === "confirmed" || payload.status === "failed") conn.close(); // close all client
            }
        } catch (err) {
            fastify.log.error(err, "Invalid worker message");
        }
    });

    redisSub.subscribe("order_updates");
}
