import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { API_BASE_URL } from './setup';

describe('Basic API Test (real container)', () => {
  it('GET /api/test returns working message', async () => {
    const res = await request(API_BASE_URL).get('/api/test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ msg: 'Server working!' });
  });
});
