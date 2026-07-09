import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';

const users = new SharedArray('users', function () {
    return open('./users.csv')
        .trim()
        .split('\n')
        .slice(1)
        .map((line) => {
            const [email, password] = line.split(',');
            return { email, password };
        });
});

// Custom counters
const successCounter = new Counter('login_success');
const rateLimitCounter = new Counter('login_429');
const serverErrorCounter = new Counter('login_500');
const otherErrorCounter = new Counter('login_other');

export const options = {
    scenarios: {
        login: {
            executor: 'ramping-vus',
            stages: [
                { duration: '30s', target: 50 },
                { duration: '1m', target: 100 },
                { duration: '2m', target: 250 },
                { duration: '2m', target: 500 },
                { duration: '2m', target: 1000 },
                { duration: '2m', target: 1500 },
                { duration: '2m', target: 2000 },
                { duration: '1m', target: 0 },
            ],
        },
    },

    thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.05'], // Allow up to 5% failures before threshold fails
    },
};

export default function () {

    const user = users[(__VU - 1) % users.length];

    const payload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const res = http.post(
        'https://ourguided.tech/api/auth/login',
        payload,
        {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: '30s',
        }
    );

    if (res.status === 200) {
        successCounter.add(1);
    } else if (res.status === 429) {
        rateLimitCounter.add(1);
    } else if (res.status >= 500) {
        serverErrorCounter.add(1);
    } else {
        otherErrorCounter.add(1);

        console.log(
            `[VU ${__VU}] Status=${res.status} Body=${res.body.substring(0, 300)}`
        );
    }

    check(res, {
        'HTTP 200': (r) => r.status === 200,
        'Not 429': (r) => r.status !== 429,
        'Not 500': (r) => r.status < 500,
        'Cookie Received': (r) =>
            r.cookies && Object.keys(r.cookies).length > 0,
    });

    // Keep hammering the login endpoint to find its maximum capacity
    sleep(5);
}