import IORedis from 'ioredis';

import { env } from './env';

export const redis = new IORedis(env.redis);
export const redisSub = new IORedis(env.redis);
