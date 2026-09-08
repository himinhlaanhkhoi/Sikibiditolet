// sunwin.js / gemwin.js - Tài xỉu Sunwin/GemWin (Tự động bypass msgpack, tách xúc xắc chuẩn hệ thống)
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const os = require('os');
const { execSync } = require('child_process');

let msgpack;
// Tự động cài đặt msgpack-lite với cờ fix lỗi symlink trên Termux
try {
    msgpack = require('msgpack-lite');
} catch (e) {
    console.log('[🔄] Chưa có msgpack-lite. Đang tự động cài đặt (fix lỗi Termux)...');
    try {
        execSync('npm install msgpack-lite --no-bin-links', { stdio: 'inherit' });
        msgpack = require('msgpack-lite');
        console.log('[✅] Tự động cài đặt xong! Đang khởi động server...');
    } catch (installErr) {
        console.error('[❌] Tự động cài thất bại. Vui lòng chạy lệnh thủ công: npm install msgpack-lite --no-bin-links');
        process.exit(1);
    }
}

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3014;

// ============ MIDDLEWARE LOG IP NGƯỜI GỌI ============
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
};

app.use((req, res, next) => {
    const clientIp = getClientIp(req);
    const time = new Date().toLocaleString('vi-VN');

    console.log(`[🌐 API CALL] ${time} | IP Khách: ${clientIp} | ${req.method} "${req.originalUrl}"`);
    next();
});

// ============ DỮ LIỆU GEMWIN ============
let apiResponseData = {
    id: "@emhancute",
    phien: null,
    xuc_xac1: null,
    xuc_xac2: null,
    xuc_xac3: null,
    tong: null,
    ket_qua: "",
    server_time: new Date().toISOString(),
    update_count: 0
};

let currentSessionId = null;
let history = [];
const MAX_HISTORY = 1000;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;

// ============ CẤU HÌNH WEBSOCKET GEMWIN ============
let CURRENT_WEBSOCKET_URL = "wss://websocket.azhkthg1.net/wsbinary?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJlbWFuaGxhbW9zcyIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjM2Mzk5OTk1OCwiYWZmSWQiOiJ6b3dpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiem8ud2luIiwiZW1haWwiOiIiLCJ0aW1lc3RhbXAiOjE3ODczNzc5NzAyOTUsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMTEzLjE2Ny4yNDEuMjQ2IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8xOS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiIxODgwYmNkYS1jYjA5LTQ3MGItODY4Yi1kMjVkYjEzOTU1MGYiLCJlbWFpbFZlcmlmaWVkIjpudWxsLCJyZWdUaW1lIjoxNzg3Mzc3OTI3MjY2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6Ilo4X2RpdGNvbm1lbWF5bmd1dmNsIn0.udnmW2Aop5TrS-f_SeHyO8GmZK0KqRPqPx7rn8PSFz8";

const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": "https://web.sunwin.jetzt",
    "Sec-WebSocket-Protocol": "binary"
};

const initialMessages = [
    [1, "MiniGame", "GM_56dtybiuijn", "", {
            "info": "{\"ipAddress\":\"14.247.165.71\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJxMndlenJzZmRjIiwiYm90IjowLCJpc01lcmNoYW50IjpmYWxzZSwidmVyaWZpZWRCYW5rQWNjb3VudCI6ZmFsc2UsInBsYXlFdmVudExvYmJ5IjpmYWxzZSwiY3VzdG9tZXJJZCI6MzYyMDYwNzYxLCJhZmZJZCI6IkdFTVdJTiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwiZW1haWwiOiIiLCJ0aW1lc3RhbXAiOjE3ODY0MzI4NDMxMjUsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMTQuMjQ3LjE2NS43MSIsIm11dGUiOmZhbHNlLCJhdmF0YXIiOiJodHRwczovL2ltYWdlcy5zd2luc2hvcC5uZXQvaW1hZ2VzL2F2YXRhci9hdmF0YXJfMTkucG5nIiwicGxhdGZvcm1JZCI6NCwidXNlcklkIjoiNDlhYTExY2ItZTc4Yi00MjRhLWJjMzQtM2U4NTFlY2JhYzI0IiwiZW1haWxWZXJpZmllZCI6bnVsbCwicmVnVGltZSI6MTc4NjQzMjYzMjQwMCwicGhvbmUiOiIiLCJkZXBvc2l0IjpmYWxzZSwidXNlcm5hbWUiOiJHTV81NmR0eWJpdWlqbiJ9.Vttddm7WuMkEJNdSfkHkJDcoWgOt2LDka6vJGw8U0dI\",\"locale\":\"vi\",\"userId\":\"49aa11cb-e78b-424a-bc34-3e851ecbac24\",\"username\":\"GM_56dtybiuijn\",\"timestamp\":1786432843136,\"refreshToken\":\"cb2f293c26fa4f4a8450e4b5778f03bc.3e5ebc6c99a847239b05effa79337171\"}",
            "signature": "3F57D00BC5848F36BDE971952AE5016329C88149DF0362BC951B9588C9FF3B37D813A70F270E07702D36D5E6E27A7D8E04799B08222F2E0745E2BE5B028B660AFCBEA04501AF71B24F00CBBDFC272005EED13E884AF036C0A3727D4E3D24F9177981DB653877194FF8DDBB36B0AA659B1557CA9AAD8D0CDCEED56678A7F1A5A8"
        }
    ],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

let ws = null;
let pingInterval = null;
let heartbeatInterval = null;
let reconnectTimer = null;
let isManualClose = false;

function connectWebSocket() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    if (ws) {
        ws.removeAllListeners();
        try { ws.terminate(); } catch (_) {}
    }

    reconnectAttempts++;
    try {
        ws = new WebSocket(CURRENT_WEBSOCKET_URL, { headers: WS_HEADERS, handshakeTimeout: 10000 });
    } catch (err) {
        scheduleReconnect();
        return;
    }

    ws.on('open', () => {
        reconnectAttempts = 0;
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const packed = msgpack ? msgpack.encode(msg) : JSON.stringify(msg);
                    ws.send(packed);
                }
            }, i * 50);
        });

        clearInterval(pingInterval);
        pingInterval = setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) { try { ws.ping(); } catch (_) {} } }, 10000);

        clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    const pingMsg = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
                    const packed = msgpack ? msgpack.encode(pingMsg) : JSON.stringify(pingMsg);
                    ws.send(packed);
                } catch (_) {}
            }
        }, 3000);
    });

    ws.on('message', (rawMessage) => {
        let data;
        try {
            if (msgpack && Buffer.isBuffer(rawMessage)) data = msgpack.decode(rawMessage);
            else data = JSON.parse(rawMessage.toString('utf8'));
        } catch (err) { return; }

        if (!data) return;

        let payloads = [];
        if (Array.isArray(data)) payloads = data.filter(item => typeof item === 'object' && item !== null);
        else if (typeof data === 'object') payloads = [data];

        for (const payload of payloads) {
            const { sid, d1, d2, d3 } = payload;
            if (sid !== undefined && d1 === undefined) {
                if (currentSessionId !== sid) currentSessionId = sid;
            }

            if (d1 !== undefined && d2 !== undefined && d3 !== undefined) {
                const targetSid = sid || currentSessionId;
                if (targetSid && apiResponseData.phien !== targetSid) {
                    const total = d1 + d2 + d3;
                    const result = (total > 10) ? "Tài" : "Xỉu";
                    const newSession = {
                        id: "@emhancute",
                        phien: targetSid,
                        xuc_xac1: d1,
                        xuc_xac2: d2,
                        xuc_xac3: d3,
                        tong: total,
                        ket_qua: result,
                        server_time: new Date().toISOString(),
                        update_count: (apiResponseData.update_count || 0) + 1
                    };

                    history.unshift(newSession);
                    if (history.length > MAX_HISTORY) history.pop();
                    apiResponseData = newSession;
                    currentSessionId = null;
                }
            }
        }
    });

    ws.on('close', () => {
        clearInterval(pingInterval);
        clearInterval(heartbeatInterval);
        if (!isManualClose) scheduleReconnect();
    });

    ws.on('error', () => {
        if (ws && ws.readyState !== WebSocket.CLOSED) { try { ws.terminate(); } catch (_) {} }
    });
}

function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    const delay = Math.min(2000 * (reconnectAttempts + 1), 20000);
    reconnectTimer = setTimeout(connectWebSocket, delay);
}

// ============ ROUTE API ============
app.get('/api/tx', (req, res) => res.json(apiResponseData));
app.get('/his/tx', (req, res) => {
    let limit = parseInt(req.query.limit) || 50;
    if (limit > MAX_HISTORY) limit = MAX_HISTORY;
    res.json(history.slice(0, limit));
});

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Sunwin/GemWin Tài Xỉu API',
        author: '@emhancute',
        endpoints: {
            current: '/api/tx',
            history: '/his/tx?limit=50'
        }
    });
});

connectWebSocket();

// Start server (required for Render / production)
app.listen(PORT, () => {
    console.log(`[✅] Server đang chạy tại port ${PORT}`);
    console.log(`[📡] API: http://localhost:${PORT}/api/tx`);
});

module.exports = app;
