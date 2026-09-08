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

// ============ CẤU HÌNH WEBSOCKET SUNWIN ============
// Token + signature mới nhất (cập nhật 08/09/2026)
const WS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXZ1YXR4MjgwOSIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjMzMTAwMDE4MiwiYWZmSWQiOiJjMTE4NWMxOGM5ZjFlYzQ5NjQ5MDdmNjA1MzA4MjU2MiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoic3VuLndpbiIsImVtYWlsIjoiIiwidGltZXN0YW1wIjoxNzg4ODQyNDIwNzA4LCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0Ijp0cnVlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjQwNTo0ODAyOmE2M2Q6YWQxMDpjOGY3OjNjODI6ODc3Yzo0YmIiLCJtdXRlIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2ltYWdlcy5zd2luc2hvcC5uZXQvaW1hZ2VzL2F2YXRhci9hdmF0YXJfMDYucG5nIiwicGxhdGZvcm1JZCI6NSwidXNlcklkIjoiNzgyZWViZDUtZjgzMi00MzJhLWJmNGUtNDc1ODM4MTg3NTY2IiwiZW1haWxWZXJpZmllZCI6bnVsbCwicmVnVGltZSI6MTc2NjExOTYzNzMxNCwicGhvbmUiOiIiLCJkZXBvc2l0IjpmYWxzZSwidXNlcm5hbWUiOiJTQ19waGFtbWluaGxvbmcyMDEzIn0.kgQ2HjLygw1mpDpbPQzWq1gSHfrxJtWZV63k_2ETxJQ";

let CURRENT_WEBSOCKET_URL = `wss://ws-lby.azhkthg1.net/wsbinary?token=${WS_TOKEN}`;

const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win",
    "Sec-WebSocket-Protocol": "binary"
};

const initialMessages = [
    // Login packet đầy đủ (info + signature) — channel "Simms"
    [1, "MiniGame", "GM_56dtybiuijn", "", {
        "info": "{\"ipAddress\":\"2405:4802:a63d:ad10:c8f7:3c82:877c:4bb\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXZ1YXR4MjgwOSIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjMzMTAwMDE4MiwiYWZmSWQiOiJjMTE4NWMxOGM5ZjFlYzQ5NjQ5MDdmNjA1MzA4MjU2MiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoic3VuLndpbiIsImVtYWlsIjoiIiwidGltZXN0YW1wIjoxNzg4ODQyNDIwNzA4LCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0Ijp0cnVlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjQwNTo0ODAyOmE2M2Q6YWQxMDpjOGY3OjNjODI6ODc3Yzo0YmIiLCJtdXRlIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2ltYWdlcy5zd2luc2hvcC5uZXQvaW1hZ2VzL2F2YXRhci9hdmF0YXJfMDYucG5nIiwicGxhdGZvcm1JZCI6NSwidXNlcklkIjoiNzgyZWViZDUtZjgzMi00MzJhLWJmNGUtNDc1ODM4MTg3NTY2IiwiZW1haWxWZXJpZmllZCI6bnVsbCwicmVnVGltZSI6MTc2NjExOTYzNzMxNCwicGhvbmUiOiIiLCJkZXBvc2l0IjpmYWxzZSwidXNlcm5hbWUiOiJTQ19waGFtbWluaGxvbmcyMDEzIn0.kgQ2HjLygw1mpDpbPQzWq1gSHfrxJtWZV63k_2ETxJQ\",\"locale\":\"vi\",\"userId\":\"782eebd5-f832-432a-bf4e-475838187566\",\"username\":\"SC_phamminhlong2013\",\"timestamp\":1788842420720,\"refreshToken\":\"9252158e0fb04d7e983141a57039e491.a9ca13cdfdbf4e3a9c6d5c3f7216b702\"}",
        "signature": "328A7A57902ADA305443A30F8FF5FACCF578E27FE28036C0656FFC40E90652311FD04C093C4F5BF1C3636DDD89901367F84A482B52B5861F8E2C92634A3316E5AD09C29E715ADAC60DC8F612C7FE77EA25D9BB787B4A0D07EED36AD7AFEAEF15D9AA14F2D95385A7E729E393A202233B8D4837A052F60BD30137581D199E2515",
        "pid": 5,
        "subi": true
    }],
    // Subscribe Tài Xỉu
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    // Subscribe Lobby
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
        console.log('[✅] WebSocket đã kết nối thành công!');
        reconnectAttempts = 0;
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const packed = msgpack ? msgpack.encode(msg) : JSON.stringify(msg);
                    ws.send(packed);
                    console.log('[📤] Đã gửi:', JSON.stringify(msg).slice(0, 80) + '...');
                }
            }, i * 80);
        });

        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try { ws.ping(); } catch (_) {}
            }
        }, 10000);

        clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    const pingMsg = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
                    const packed = msgpack ? msgpack.encode(pingMsg) : JSON.stringify(pingMsg);
                    ws.send(packed);
                } catch (_) {}
            }
        }, 5000);
    });

    ws.on('message', (rawMessage) => {
        let data;
        try {
            if (msgpack && Buffer.isBuffer(rawMessage)) {
                data = msgpack.decode(rawMessage);
            } else {
                data = JSON.parse(rawMessage.toString('utf8'));
            }
        } catch (err) {
            return;
        }

        if (!data) return;

        // Log raw data để debug (chỉ log object có dữ liệu quan trọng)
        const dataStr = JSON.stringify(data);
        if (dataStr.includes('sid') || dataStr.includes('d1') || dataStr.includes('cmd')) {
            console.log('[📥] Nhận:', dataStr.slice(0, 300));
        }

        // Chuẩn hóa payload
        let items = [];
        if (Array.isArray(data)) {
            // Có thể là [cmd, channel, plugin, payload] hoặc mảng object
            for (const item of data) {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    items.push(item);
                } else if (Array.isArray(item) && item.length >= 4 && typeof item[3] === 'object') {
                    items.push(item[3]);
                }
            }
            // Trường hợp data là mảng protocol dạng [6, "MiniGame", "taixiuPlugin", {...}]
            if (data.length >= 4 && typeof data[3] === 'object') {
                items.push(data[3]);
            }
        } else if (typeof data === 'object') {
            items.push(data);
        }

        for (const payload of items) {
            if (!payload || typeof payload !== 'object') continue;

            // Lấy sid (phiên)
            if (payload.sid !== undefined && payload.d1 === undefined) {
                if (currentSessionId !== payload.sid) {
                    currentSessionId = payload.sid;
                    console.log('[🎲] Phiên mới:', currentSessionId);
                }
            }

            // Lấy xúc xắc
            const d1 = payload.d1 ?? payload.dice1 ?? payload.xx1;
            const d2 = payload.d2 ?? payload.dice2 ?? payload.xx2;
            const d3 = payload.d3 ?? payload.dice3 ?? payload.xx3;

            if (d1 !== undefined && d2 !== undefined && d3 !== undefined) {
                const targetSid = payload.sid || currentSessionId;
                if (targetSid && apiResponseData.phien !== targetSid) {
                    const total = Number(d1) + Number(d2) + Number(d3);
                    const result = total >= 11 ? "Tài" : "Xỉu";

                    const newSession = {
                        id: "@emhancute",
                        phien: targetSid,
                        xuc_xac1: Number(d1),
                        xuc_xac2: Number(d2),
                        xuc_xac3: Number(d3),
                        tong: total,
                        ket_qua: result,
                        server_time: new Date().toISOString(),
                        update_count: (apiResponseData.update_count || 0) + 1
                    };

                    history.unshift(newSession);
                    if (history.length > MAX_HISTORY) history.pop();
                    apiResponseData = newSession;
                    currentSessionId = null;

                    console.log(`[🎯] Kết quả phiên ${targetSid}: ${d1}-${d2}-${d3} = ${total} → ${result}`);
                }
            }
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[❌] WebSocket đóng. Code: ${code}`);
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
