/**
 * k6 duman testi: API ayaktayken
 *   k6 run tests/load/health.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const health = http.get(`${BASE}/api/v1/health`);
  check(health, { 'health 200': (res) => res.status === 200 });
  sleep(1);
}
