import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

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
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<1000'],
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
        }
    );

    check(res, {
        'status 200': (r) => r.status === 200,
        'received cookie': (r) => r.cookies && Object.keys(r.cookies).length > 0,
    });

    sleep(5);
}