import IORedis from "ioredis";
import pg from "pg";

// -------------------------------------------------------
// Redis connections
// -------------------------------------------------------
const redisConn = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: +(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

const redis = new IORedis(redisConn);
const redisPub = new IORedis(redisConn);

// -------------------------------------------------------
// Postgres pool
// -------------------------------------------------------
const dbPool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@postgres:5432/postgres"
});

export { redis, redisPub, dbPool, redisConn };