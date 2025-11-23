export const env = {
    port: +(process.env.PORT || 3000),
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: +(process.env.REDIS_PORT || 6379),
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    },
    db: {
        url: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/'
    }
};
