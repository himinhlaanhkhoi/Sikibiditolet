const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 DỮ LIỆU
// ============================================================
let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🤖 30 THUẬT TOÁN THÔNG MINH BẮT CẦU
// ============================================================

// ===== NHÓM 1: THUẬT TOÁN HỌC MÁY (15) =====

// 1. KNN - Láng Giềng Gần Nhất
class KNN {
    constructor(k = 7) {
        this.k = k;
        this.duLieu = [];
    }
    huanLuyen(duLieu) { this.duLieu = duLieu; }
    duDoan(dacTrung) {
        if (this.duLieu.length === 0) return null;
        const khoangCach = this.duLieu.map((item, idx) => {
            let dist = 0;
            for (let i = 0; i < dacTrung.length; i++) {
                dist += Math.pow(dacTrung[i] - item.dacTrung[i], 2);
            }
            return { idx, dist: Math.sqrt(dist), nhan: item.nhan };
        });
        khoangCach.sort((a, b) => a.dist - b.dist);
        const langGiang = khoangCach.slice(0, this.k);
        let t = 0, x = 0;
        for (const n of langGiang) {
            if (n.nhan === 'T') t++;
            else x++;
        }
        return t > x ? 'T' : 'X';
    }
}

// 2. Naive Bayes - Xác Suất Bayes
class NaiveBayes {
    constructor() {
        this.xacSuatLop = {};
        this.xacSuatDacTrung = {};
    }
    huanLuyen(duLieu) {
        const tong = duLieu.length;
        const demLop = {};
        const demDacTrung = {};
        for (const item of duLieu) {
            const nhan = item.nhan;
            demLop[nhan] = (demLop[nhan] || 0) + 1;
            for (let i = 0; i < item.dacTrung.length; i++) {
                const key = `${nhan}_${i}_${item.dacTrung[i]}`;
                demDacTrung[key] = (demDacTrung[key] || 0) + 1;
            }
        }
        for (const nhan in demLop) {
            this.xacSuatLop[nhan] = demLop[nhan] / tong;
        }
        for (const key in demDacTrung) {
            const parts = key.split('_');
            const nhan = parts[0];
            const idx = parts[1];
            const val = parts[2];
            if (!this.xacSuatDacTrung[nhan]) this.xacSuatDacTrung[nhan] = {};
            if (!this.xacSuatDacTrung[nhan][idx]) this.xacSuatDacTrung[nhan][idx] = {};
            this.xacSuatDacTrung[nhan][idx][val] = demDacTrung[key] / demLop[nhan];
        }
    }
    duDoan(dacTrung) {
        let nhanTotNhat = null;
        let xacSuatTotNhat = -Infinity;
        for (const nhan in this.xacSuatLop) {
            let prob = Math.log(this.xacSuatLop[nhan] || 0.01);
            for (let i = 0; i < dacTrung.length; i++) {
                const probs = this.xacSuatDacTrung[nhan]?.[i] || {};
                const p = probs[dacTrung[i]] || 0.01;
                prob += Math.log(p);
            }
            if (prob > xacSuatTotNhat) { xacSuatTotNhat = prob; nhanTotNhat = nhan; }
        }
        return nhanTotNhat;
    }
}

// 3. Decision Tree - Cây Quyết Định
class CayQuyetDinh {
    constructor(doSauToiDa = 6) {
        this.doSauToiDa = doSauToiDa;
        this.cay = null;
    }
    huanLuyen(duLieu, doSau = 0) {
        if (doSau >= this.doSauToiDa || duLieu.length === 0) return this.bieuQuyet(duLieu);
        const nhan = duLieu.map(d => d.nhan);
        const unique = [...new Set(nhan)];
        if (unique.length === 1) return unique[0];
        const totNhat = this.timChiaTotNhat(duLieu);
        if (!totNhat) return this.bieuQuyet(duLieu);
        return {
            dacTrung: totNhat.dacTrung,
            nguong: totNhat.nguong,
            trai: this.huanLuyen(totNhat.trai, doSau + 1),
            phai: this.huanLuyen(totNhat.phai, doSau + 1)
        };
    }
    timChiaTotNhat(duLieu) {
        const soDacTrung = duLieu[0].dacTrung.length;
        let loiGainTotNhat = -1;
        let chiaTotNhat = null;
        for (let f = 0; f < soDacTrung; f++) {
            const values = duLieu.map(d => d.dacTrung[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const nguong = (sorted[i] + sorted[i + 1]) / 2;
                const trai = duLieu.filter(d => d.dacTrung[f] <= nguong);
                const phai = duLieu.filter(d => d.dacTrung[f] > nguong);
                if (trai.length === 0 || phai.length === 0) continue;
                const gain = this.thongTinGain(duLieu, trai, phai);
                if (gain > loiGainTotNhat) {
                    loiGainTotNhat = gain;
                    chiaTotNhat = { dacTrung: f, nguong, trai, phai };
                }
            }
        }
        return chiaTotNhat;
    }
    thongTinGain(cha, trai, phai) {
        const entropy = (duLieu) => {
            const nhan = duLieu.map(d => d.nhan);
            const dem = {};
            for (const l of nhan) dem[l] = (dem[l] || 0) + 1;
            let e = 0;
            const tong = nhan.length;
            for (const l in dem) {
                const p = dem[l] / tong;
                e -= p * Math.log2(p || 1);
            }
            return e;
        };
        const pe = entropy(cha);
        const le = entropy(trai);
        const re = entropy(phai);
        const tong = cha.length;
        return pe - (trai.length / tong * le + phai.length / tong * re);
    }
    bieuQuyet(duLieu) {
        const nhan = duLieu.map(d => d.nhan);
        const dem = {};
        for (const l of nhan) dem[l] = (dem[l] || 0) + 1;
        let totNhat = null, demTotNhat = -1;
        for (const l in dem) {
            if (dem[l] > demTotNhat) { demTotNhat = dem[l]; totNhat = l; }
        }
        return totNhat;
    }
    duDoan(dacTrung, node = this.cay) {
        if (!node) return 'T';
        if (typeof node === 'string') return node;
        if (dacTrung[node.dacTrung] <= node.nguong) {
            return this.duDoan(dacTrung, node.trai);
        } else {
            return this.duDoan(dacTrung, node.phai);
        }
    }
}

// 4. Random Forest - Rừng Ngẫu Nhiên
class RungNgauNhien {
    constructor(soCay = 15, doSauToiDa = 5) {
        this.soCay = soCay;
        this.doSauToiDa = doSauToiDa;
        this.cay = [];
    }
    huanLuyen(duLieu) {
        for (let i = 0; i < this.soCay; i++) {
            const mau = this.layMauBootStrap(duLieu);
            const cay = new CayQuyetDinh(this.doSauToiDa);
            cay.cay = cay.huanLuyen(mau);
            this.cay.push(cay);
        }
    }
    layMauBootStrap(duLieu) {
        const mau = [];
        for (let i = 0; i < duLieu.length; i++) {
            mau.push(duLieu[Math.floor(Math.random() * duLieu.length)]);
        }
        return mau;
    }
    duDoan(dacTrung) {
        const phieu = { T: 0, X: 0 };
        for (const cay of this.cay) {
            const pred = cay.duDoan(dacTrung);
            phieu[pred] = (phieu[pred] || 0) + 1;
        }
        return phieu.T > phieu.X ? 'T' : 'X';
    }
}

// 5. Logistic Regression - Hồi Quy Logistic
class HoiQuyLogistic {
    constructor(tocDoHoc = 0.01, soVongLap = 150) {
        this.tocDoHoc = tocDoHoc;
        this.soVongLap = soVongLap;
        this.trongSo = [];
        this.lech = 0;
    }
    sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : 0);
        const n = dacTrung.length;
        const m = dacTrung[0].length;
        this.trongSo = new Array(m).fill(0);
        this.lech = 0;
        for (let epoch = 0; epoch < this.soVongLap; epoch++) {
            for (let i = 0; i < n; i++) {
                const z = this.lech + dacTrung[i].reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
                const pred = this.sigmoid(z);
                const loi = pred - nhan[i];
                for (let j = 0; j < m; j++) {
                    this.trongSo[j] -= this.tocDoHoc * loi * dacTrung[i][j];
                }
                this.lech -= this.tocDoHoc * loi;
            }
        }
    }
    duDoan(dacTrung) {
        const z = this.lech + dacTrung.reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
        return this.sigmoid(z) > 0.5 ? 'T' : 'X';
    }
}

// 6. SVM - Máy Hỗ Trợ Vector
class SVM {
    constructor(tocDoHoc = 0.01, soVongLap = 150) {
        this.tocDoHoc = tocDoHoc;
        this.soVongLap = soVongLap;
        this.trongSo = [];
        this.lech = 0;
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : -1);
        const n = dacTrung.length;
        const m = dacTrung[0].length;
        this.trongSo = new Array(m).fill(0);
        this.lech = 0;
        for (let epoch = 0; epoch < this.soVongLap; epoch++) {
            for (let i = 0; i < n; i++) {
                const quyetDinh = this.lech + dacTrung[i].reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
                if (nhan[i] * quyetDinh < 1) {
                    for (let j = 0; j < m; j++) {
                        this.trongSo[j] += this.tocDoHoc * (nhan[i] * dacTrung[i][j] - 0.01 * this.trongSo[j]);
                    }
                    this.lech += this.tocDoHoc * nhan[i];
                } else {
                    for (let j = 0; j < m; j++) {
                        this.trongSo[j] -= this.tocDoHoc * 0.01 * this.trongSo[j];
                    }
                }
            }
        }
    }
    duDoan(dacTrung) {
        const quyetDinh = this.lech + dacTrung.reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
        return quyetDinh > 0 ? 'T' : 'X';
    }
}

// 7. Gradient Boosting - Tăng Cường Gradient
class TangCuongGradient {
    constructor(soMau = 30, tocDoHoc = 0.1) {
        this.soMau = soMau;
        this.tocDoHoc = tocDoHoc;
        this.moHinh = [];
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : 0);
        let du = nhan.slice();
        const duDoanBanDau = nhan.reduce((a, b) => a + b, 0) / nhan.length;
        this.moHinh.push({ loai: 'ban_dau', giaTri: duDoanBanDau });
        for (let i = 0; i < this.soMau; i++) {
            const mau = this.huanLuyenNhanh(dacTrung, du);
            this.moHinh.push(mau);
            for (let j = 0; j < dacTrung.length; j++) {
                const pred = this.duDoanNhanh(mau, dacTrung[j]);
                du[j] -= this.tocDoHoc * pred;
            }
        }
    }
    huanLuyenNhanh(dacTrung, du) {
        let dacTrungTotNhat = 0;
        let nguongTotNhat = 0;
        let loiTotNhat = Infinity;
        for (let f = 0; f < dacTrung[0].length; f++) {
            const values = dacTrung.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const nguong = (sorted[i] + sorted[i + 1]) / 2;
                let loi = 0;
                for (let j = 0; j < dacTrung.length; j++) {
                    const pred = dacTrung[j][f] <= nguong ? 1 : -1;
                    loi += Math.pow(du[j] - pred, 2);
                }
                if (loi < loiTotNhat) {
                    loiTotNhat = loi;
                    dacTrungTotNhat = f;
                    nguongTotNhat = nguong;
                }
            }
        }
        return { loai: 'nhanh', dacTrung: dacTrungTotNhat, nguong: nguongTotNhat };
    }
    duDoanNhanh(mau, dacTrung) {
        if (mau.loai === 'ban_dau') return mau.giaTri;
        return dacTrung[mau.dacTrung] <= mau.nguong ? 1 : -1;
    }
    duDoan(dacTrung) {
        let tong = 0;
        for (const mau of this.moHinh) {
            if (mau.loai === 'ban_dau') {
                tong += mau.giaTri;
            } else {
                tong += this.tocDoHoc * (dacTrung[mau.dacTrung] <= mau.nguong ? 1 : -1);
            }
        }
        return tong > 0 ? 'T' : 'X';
    }
}

// 8. XGBoost - Tăng Cường Cực Đại
class XGBoost {
    constructor(soMau = 20, tocDoHoc = 0.1) {
        this.soMau = soMau;
        this.tocDoHoc = tocDoHoc;
        this.moHinh = [];
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : 0);
        let du = nhan.slice();
        const duDoanBanDau = nhan.reduce((a, b) => a + b, 0) / nhan.length;
        this.moHinh.push({ loai: 'ban_dau', giaTri: duDoanBanDau });
        for (let i = 0; i < this.soMau; i++) {
            const mau = this.huanLuyenCay(dacTrung, du);
            this.moHinh.push(mau);
            for (let j = 0; j < dacTrung.length; j++) {
                const pred = this.duDoanCay(mau, dacTrung[j]);
                du[j] -= this.tocDoHoc * pred;
            }
        }
    }
    huanLuyenCay(dacTrung, du) {
        let dacTrungTotNhat = 0, nguongTotNhat = 0, loiTotNhat = Infinity;
        for (let f = 0; f < dacTrung[0].length; f++) {
            const values = dacTrung.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const nguong = (sorted[i] + sorted[i + 1]) / 2;
                let loi = 0;
                for (let j = 0; j < dacTrung.length; j++) {
                    const pred = dacTrung[j][f] <= nguong ? 1 : -1;
                    loi += Math.pow(du[j] - pred, 2);
                }
                if (loi < loiTotNhat) {
                    loiTotNhat = loi;
                    dacTrungTotNhat = f;
                    nguongTotNhat = nguong;
                }
            }
        }
        return { loai: 'cay', dacTrung: dacTrungTotNhat, nguong: nguongTotNhat };
    }
    duDoanCay(mau, dacTrung) {
        if (mau.loai === 'ban_dau') return mau.giaTri;
        return dacTrung[mau.dacTrung] <= mau.nguong ? 1 : -1;
    }
    duDoan(dacTrung) {
        let tong = 0;
        for (const mau of this.moHinh) {
            if (mau.loai === 'ban_dau') {
                tong += mau.giaTri;
            } else {
                tong += this.tocDoHoc * (dacTrung[mau.dacTrung] <= mau.nguong ? 1 : -1);
            }
        }
        return tong > 0 ? 'T' : 'X';
    }
}

// 9. AdaBoost - Tăng Cường Thích Ứng
class AdaBoost {
    constructor(soMau = 20) {
        this.soMau = soMau;
        this.moHinh = [];
        this.alpha = [];
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : -1);
        let trongSo = new Array(duLieu.length).fill(1 / duLieu.length);
        for (let i = 0; i < this.soMau; i++) {
            const mau = this.huanLuyenNhanh(dacTrung, nhan, trongSo);
            let loi = 0;
            for (let j = 0; j < dacTrung.length; j++) {
                const pred = this.duDoanNhanh(mau, dacTrung[j]);
                if (pred !== nhan[j]) loi += trongSo[j];
            }
            if (loi > 0.5) break;
            const alpha = 0.5 * Math.log((1 - loi) / (loi + 1e-10));
            let tongTrongSo = 0;
            for (let j = 0; j < dacTrung.length; j++) {
                const pred = this.duDoanNhanh(mau, dacTrung[j]);
                trongSo[j] *= Math.exp(-alpha * nhan[j] * pred);
                tongTrongSo += trongSo[j];
            }
            for (let j = 0; j < dacTrung.length; j++) {
                trongSo[j] /= tongTrongSo;
            }
            this.moHinh.push(mau);
            this.alpha.push(alpha);
        }
    }
    huanLuyenNhanh(dacTrung, nhan, trongSo) {
        let dacTrungTotNhat = 0, nguongTotNhat = 0, loiTotNhat = Infinity;
        for (let f = 0; f < dacTrung[0].length; f++) {
            const values = dacTrung.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const nguong = (sorted[i] + sorted[i + 1]) / 2;
                let loi = 0;
                for (let j = 0; j < dacTrung.length; j++) {
                    const pred = dacTrung[j][f] <= nguong ? 1 : -1;
                    if (pred !== nhan[j]) loi += trongSo[j];
                }
                if (loi < loiTotNhat) {
                    loiTotNhat = loi;
                    dacTrungTotNhat = f;
                    nguongTotNhat = nguong;
                }
            }
        }
        return { dacTrung: dacTrungTotNhat, nguong: nguongTotNhat };
    }
    duDoanNhanh(mau, dacTrung) {
        return dacTrung[mau.dacTrung] <= mau.nguong ? 1 : -1;
    }
    duDoan(dacTrung) {
        let tong = 0;
        for (let i = 0; i < this.moHinh.length; i++) {
            const pred = this.duDoanNhanh(this.moHinh[i], dacTrung);
            tong += this.alpha[i] * pred;
        }
        return tong > 0 ? 'T' : 'X';
    }
}

// 10. LSTM - Bộ Nhớ Dài Hạn Ngắn Hạn
class LSTM {
    constructor() {
        this.boNho = new Map();
        this.chuoi = [];
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = item.dacTrung.slice(0, 3).join('|');
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
            this.chuoi.push({ dacTrung: item.dacTrung, nhan: item.nhan });
            if (this.chuoi.length > 200) this.chuoi.shift();
        }
    }
    duDoan(dacTrung) {
        const key = dacTrung.slice(0, 3).join('|');
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 11. Kalman Filter - Bộ Lọc Kalman
class BoLocKalman {
    constructor() {
        this.uocLuong = 0.5;
        this.saiSo = 0.1;
        this.nhieuQuaTrinh = 0.01;
        this.nhieuDoLuong = 0.1;
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const z = item.nhan === 'T' ? 1 : 0;
            this.saiSo += this.nhieuQuaTrinh;
            const kg = this.saiSo / (this.saiSo + this.nhieuDoLuong);
            this.uocLuong += kg * (z - this.uocLuong);
            this.saiSo = (1 - kg) * this.saiSo;
        }
    }
    duDoan(dacTrung) {
        return this.uocLuong > 0.5 ? 'T' : 'X';
    }
}

// 12. Neural Network - Mạng Nơ-ron Đơn Giản
class MangNoron {
    constructor() {
        this.trongSo1 = [];
        this.trongSo2 = [];
        this.lech1 = [];
        this.lech2 = [];
        this.kichThuocAn = 8;
        this.daHuan = false;
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : 0);
        const soDauVao = dacTrung[0].length;
        this.trongSo1 = Array.from({ length: soDauVao }, () => 
            Array.from({ length: this.kichThuocAn }, () => Math.random() * 0.2 - 0.1)
        );
        this.lech1 = new Array(this.kichThuocAn).fill(0);
        this.trongSo2 = new Array(this.kichThuocAn).fill(Math.random() * 0.2 - 0.1);
        this.lech2 = 0;
        
        const tocDoHoc = 0.01;
        for (let epoch = 0; epoch < 200; epoch++) {
            for (let i = 0; i < dacTrung.length; i++) {
                const an = this.kichThuocAn;
                const h = new Array(an);
                for (let j = 0; j < an; j++) {
                    let sum = this.lech1[j];
                    for (let k = 0; k < soDauVao; k++) {
                        sum += dacTrung[i][k] * this.trongSo1[k][j];
                    }
                    h[j] = Math.tanh(sum);
                }
                let dauRa = this.lech2;
                for (let j = 0; j < an; j++) {
                    dauRa += h[j] * this.trongSo2[j];
                }
                const pred = 1 / (1 + Math.exp(-dauRa));
                const loi = pred - nhan[i];
                
                const dDauRa = loi * pred * (1 - pred);
                for (let j = 0; j < an; j++) {
                    this.trongSo2[j] -= tocDoHoc * dDauRa * h[j];
                    const dAn = dDauRa * this.trongSo2[j] * (1 - h[j] * h[j]);
                    for (let k = 0; k < soDauVao; k++) {
                        this.trongSo1[k][j] -= tocDoHoc * dAn * dacTrung[i][k];
                    }
                    this.lech1[j] -= tocDoHoc * dAn;
                }
                this.lech2 -= tocDoHoc * dDauRa;
            }
        }
        this.daHuan = true;
    }
    duDoan(dacTrung) {
        if (!this.daHuan) return null;
        const an = this.kichThuocAn;
        const h = new Array(an);
        for (let j = 0; j < an; j++) {
            let sum = this.lech1[j];
            for (let k = 0; k < dacTrung.length; k++) {
                sum += dacTrung[k] * this.trongSo1[k][j];
            }
            h[j] = Math.tanh(sum);
        }
        let dauRa = this.lech2;
        for (let j = 0; j < an; j++) {
            dauRa += h[j] * this.trongSo2[j];
        }
        return 1 / (1 + Math.exp(-dauRa)) > 0.5 ? 'T' : 'X';
    }
}

// 13. Ensemble Voting - Bỏ Phiếu Tổng Hợp
class BoPhieuTongHop {
    constructor() {
        this.moHinh = [];
        this.trongSo = [];
    }
    themMoHinh(moHinh, trongSo = 1) {
        this.moHinh.push(moHinh);
        this.trongSo.push(trongSo);
    }
    huanLuyen(duLieu) {
        for (const moHinh of this.moHinh) {
            if (moHinh.huanLuyen) moHinh.huanLuyen(duLieu);
        }
    }
    duDoan(dacTrung) {
        let tPhieu = 0, xPhieu = 0;
        for (let i = 0; i < this.moHinh.length; i++) {
            const pred = this.moHinh[i].duDoan(dacTrung);
            if (pred === 'T') tPhieu += this.trongSo[i];
            else if (pred === 'X') xPhieu += this.trongSo[i];
        }
        return tPhieu > xPhieu ? 'T' : 'X';
    }
}

// 14. Q-Learning - Học Tăng Cường
class HocTangCuong {
    constructor() {
        this.bangQ = new Map();
        this.alpha = 0.1;
        this.gamma = 0.9;
        this.epsilon = 0.1;
    }
    layTrangThai(dacTrung) {
        return dacTrung.slice(0, 4).join('|');
    }
    layQ(trangThai, hanhDong) {
        const key = `${trangThai}_${hanhDong}`;
        return this.bangQ.get(key) || 0;
    }
    datQ(trangThai, hanhDong, giaTri) {
        const key = `${trangThai}_${hanhDong}`;
        this.bangQ.set(key, giaTri);
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const trangThai = this.layTrangThai(item.dacTrung);
            const hanhDong = item.nhan;
            const thuong = 1;
            const qMaxKe = Math.max(
                this.layQ(trangThai, 'T'),
                this.layQ(trangThai, 'X')
            );
            const qHienTai = this.layQ(trangThai, hanhDong);
            const qMoi = qHienTai + this.alpha * (thuong + this.gamma * qMaxKe - qHienTai);
            this.datQ(trangThai, hanhDong, qMoi);
        }
    }
    duDoan(dacTrung) {
        const trangThai = this.layTrangThai(dacTrung);
        const qT = this.layQ(trangThai, 'T');
        const qX = this.layQ(trangThai, 'X');
        if (qT === 0 && qX === 0) return null;
        return qT > qX ? 'T' : 'X';
    }
}

// 15. Linear Regression - Hồi Quy Tuyến Tính
class HoiQuyTuyenTinh {
    constructor() {
        this.trongSo = [];
        this.lech = 0;
        this.daHuan = false;
    }
    huanLuyen(duLieu) {
        const dacTrung = duLieu.map(d => d.dacTrung);
        const nhan = duLieu.map(d => d.nhan === 'T' ? 1 : 0);
        const n = dacTrung.length;
        const m = dacTrung[0].length;
        this.trongSo = new Array(m).fill(0);
        this.lech = 0;
        const tocDoHoc = 0.001;
        for (let epoch = 0; epoch < 200; epoch++) {
            for (let i = 0; i < n; i++) {
                const pred = this.lech + dacTrung[i].reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
                const loi = pred - nhan[i];
                for (let j = 0; j < m; j++) {
                    this.trongSo[j] -= tocDoHoc * loi * dacTrung[i][j];
                }
                this.lech -= tocDoHoc * loi;
            }
        }
        this.daHuan = true;
    }
    duDoan(dacTrung) {
        if (!this.daHuan) return null;
        const pred = this.lech + dacTrung.reduce((sum, f, j) => sum + f * this.trongSo[j], 0);
        return pred > 0.5 ? 'T' : 'X';
    }
}

// ===== NHÓM 2: THUẬT TOÁN BẮT CẦU THÔNG MINH (15) =====

// 16. Bắt Cầu Bệt Thông Minh
class BatCauBet {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `${item.dacTrung[0]}_${item.dacTrung[1]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `${dacTrung[0]}_${dacTrung[1]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 17. Bắt Cầu Zigzag
class BatCauZigzag {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `${item.dacTrung[2]}_${item.dacTrung[3]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `${dacTrung[2]}_${dacTrung[3]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 18. Bắt Cầu Đảo 1-1
class BatCauDao11 {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `dao_${item.dacTrung[4]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `dao_${dacTrung[4]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 19. Bắt Cầu Đảo 2-2
class BatCauDao22 {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `dao22_${item.dacTrung[5]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `dao22_${dacTrung[5]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 20. Bắt Cầu Chu Kỳ
class BatCauChuKy {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `cycle_${item.dacTrung[6]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `cycle_${dacTrung[6]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 21. Bắt Cầu Xu Hướng
class BatCauXuHuong {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `trend_${item.dacTrung[7]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `trend_${dacTrung[7]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 22. Bắt Cầu Cân Bằng
class BatCauCanBang {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `balance_${item.dacTrung[8]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `balance_${dacTrung[8]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 23. Bắt Cầu Momentum
class BatCauMomentum {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `mom_${item.dacTrung[9]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `mom_${dacTrung[9]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 24. Bắt Cầu Biến Động
class BatCauBienDong {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `vol_${item.dacTrung[10]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `vol_${dacTrung[10]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 25. Bắt Cầu Fibonacci
class BatCauFibonacci {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = `fib_${item.dacTrung[11]}`;
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = `fib_${dacTrung[11]}`;
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// 26-30. Các bộ lọc thông minh khác
class BoLocThongMinh {
    constructor() {
        this.boNho = new Map();
    }
    huanLuyen(duLieu) {
        for (const item of duLieu) {
            const key = item.dacTrung.slice(0, 5).join('|');
            if (!this.boNho.has(key)) {
                this.boNho.set(key, { T: 0, X: 0 });
            }
            this.boNho.get(key)[item.nhan] = (this.boNho.get(key)[item.nhan] || 0) + 1;
        }
    }
    duDoan(dacTrung) {
        const key = dacTrung.slice(0, 5).join('|');
        const data = this.boNho.get(key);
        if (!data || data.T + data.X < 3) return null;
        return data.T > data.X ? 'T' : 'X';
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN VIP + 30 THUẬT TOÁN
// ============================================================
class SieuMayHocPredictor {
    constructor() {
        // Bộ nhớ
        this.boNhoChuoi = new Map();
        this.boNhoBet = new Map();
        this.boNhoBreak = new Map();
        this.boNhoMau = new Map();
        this.boNhoTrongSo = new Map();
        this.boNhoDoChinhXac = new Map();
        
        // 30 Models
        this.knn = new KNN(7);
        this.naiveBayes = new NaiveBayes();
        this.cayQuyetDinh = new CayQuyetDinh(6);
        this.rungNgauNhien = new RungNgauNhien(15, 5);
        this.hoiQuyLogistic = new HoiQuyLogistic(0.01, 150);
        this.svm = new SVM(0.01, 150);
        this.tangCuongGradient = new TangCuongGradient(30, 0.1);
        this.xgboost = new XGBoost(20, 0.1);
        this.adaboost = new AdaBoost(20);
        this.lstm = new LSTM();
        this.boLocKalman = new BoLocKalman();
        this.mangNoron = new MangNoron();
        this.boPhieuTongHop = new BoPhieuTongHop();
        this.hocTangCuong = new HocTangCuong();
        this.hoiQuyTuyenTinh = new HoiQuyTuyenTinh();
        
        // 15 bắt cầu
        this.batCauBet = new BatCauBet();
        this.batCauZigzag = new BatCauZigzag();
        this.batCauDao11 = new BatCauDao11();
        this.batCauDao22 = new BatCauDao22();
        this.batCauChuKy = new BatCauChuKy();
        this.batCauXuHuong = new BatCauXuHuong();
        this.batCauCanBang = new BatCauCanBang();
        this.batCauMomentum = new BatCauMomentum();
        this.batCauBienDong = new BatCauBienDong();
        this.batCauFibonacci = new BatCauFibonacci();
        this.boLoc1 = new BoLocThongMinh();
        this.boLoc2 = new BoLocThongMinh();
        this.boLoc3 = new BoLocThongMinh();
        this.boLoc4 = new BoLocThongMinh();
        this.boLoc5 = new BoLocThongMinh();
        
        this.duLieuML = [];
        this.daHuan = false;
        this.taiDuLieu();
    }

    // ============================================================
    // CHUẨN BỊ DỮ LIỆU
    // ============================================================
    chuanBiDuLieu(data) {
        const dacTrung = [];
        const nhan = [];
        for (let i = 6; i < data.length; i++) {
            const cuaSo = data.slice(i - 6, i);
            const mucTieu = data[i];
            const demT = cuaSo.filter(r => r === 'T').length;
            const thayDoi = cuaSo.filter((r, idx) => idx > 0 && r !== cuaSo[idx-1]).length;
            const xuHuong = demT / cuaSo.length;
            const cuoi = cuaSo[cuaSo.length - 1] === 'T' ? 1 : 0;
            const dau = cuaSo[0] === 'T' ? 1 : 0;
            let cap = 0;
            for (let j = 0; j < cuaSo.length - 1; j++) {
                if (cuaSo[j] === cuaSo[j+1]) cap++;
            }
            let zigzag = 0;
            for (let j = 1; j < cuaSo.length - 1; j++) {
                if (cuaSo[j-1] !== cuaSo[j] && cuaSo[j] !== cuaSo[j+1]) zigzag++;
            }
            // Thêm nhiều đặc trưng hơn
            const doDai = cuaSo.length;
            const tyLeT = demT / doDai;
            const bienDong = thayDoi / doDai;
            const daoChieu = zigzag / doDai;
            const canBang = Math.abs(demT - (doDai - demT)) / doDai;
            
            dacTrung.push([demT, thayDoi, Math.round(xuHuong * 10), cuoi, dau, cap, zigzag, doDai, 
                          Math.round(tyLeT * 10), Math.round(bienDong * 10), Math.round(daoChieu * 10), 
                          Math.round(canBang * 10)]);
            nhan.push(mucTieu);
        }
        return { dacTrung, nhan };
    }

    // ============================================================
    // HUẤN LUYỆN 30 THUẬT TOÁN
    // ============================================================
    huanLuyen(game, data) {
        if (data.length < 25) return;
        const { dacTrung, nhan } = this.chuanBiDuLieu(data);
        if (dacTrung.length < 15) return;
        
        const duLieuHuan = dacTrung.map((f, idx) => ({
            dacTrung: f,
            nhan: nhan[idx]
        }));
        
        try {
            this.knn.huanLuyen(duLieuHuan);
            this.naiveBayes.huanLuyen(duLieuHuan);
            this.cayQuyetDinh.cay = this.cayQuyetDinh.huanLuyen(duLieuHuan);
            this.rungNgauNhien.huanLuyen(duLieuHuan);
            this.hoiQuyLogistic.huanLuyen(duLieuHuan);
            this.svm.huanLuyen(duLieuHuan);
            this.tangCuongGradient.huanLuyen(duLieuHuan);
            this.xgboost.huanLuyen(duLieuHuan);
            this.adaboost.huanLuyen(duLieuHuan);
            this.lstm.huanLuyen(duLieuHuan);
            this.boLocKalman.huanLuyen(duLieuHuan);
            this.mangNoron.huanLuyen(duLieuHuan);
            this.hoiQuyTuyenTinh.huanLuyen(duLieuHuan);
            this.hocTangCuong.huanLuyen(duLieuHuan);
            
            // Bắt cầu
            this.batCauBet.huanLuyen(duLieuHuan);
            this.batCauZigzag.huanLuyen(duLieuHuan);
            this.batCauDao11.huanLuyen(duLieuHuan);
            this.batCauDao22.huanLuyen(duLieuHuan);
            this.batCauChuKy.huanLuyen(duLieuHuan);
            this.batCauXuHuong.huanLuyen(duLieuHuan);
            this.batCauCanBang.huanLuyen(duLieuHuan);
            this.batCauMomentum.huanLuyen(duLieuHuan);
            this.batCauBienDong.huanLuyen(duLieuHuan);
            this.batCauFibonacci.huanLuyen(duLieuHuan);
            this.boLoc1.huanLuyen(duLieuHuan);
            this.boLoc2.huanLuyen(duLieuHuan);
            this.boLoc3.huanLuyen(duLieuHuan);
            this.boLoc4.huanLuyen(duLieuHuan);
            this.boLoc5.huanLuyen(duLieuHuan);
            
            // Ensemble
            this.boPhieuTongHop.themMoHinh(this.knn, 1.0);
            this.boPhieuTongHop.themMoHinh(this.naiveBayes, 0.8);
            this.boPhieuTongHop.themMoHinh(this.cayQuyetDinh, 0.9);
            this.boPhieuTongHop.themMoHinh(this.rungNgauNhien, 1.1);
            this.boPhieuTongHop.themMoHinh(this.hoiQuyLogistic, 0.9);
            this.boPhieuTongHop.themMoHinh(this.svm, 0.9);
            this.boPhieuTongHop.themMoHinh(this.tangCuongGradient, 1.0);
            this.boPhieuTongHop.themMoHinh(this.xgboost, 1.0);
            this.boPhieuTongHop.themMoHinh(this.adaboost, 0.9);
            this.boPhieuTongHop.themMoHinh(this.lstm, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLocKalman, 0.7);
            this.boPhieuTongHop.themMoHinh(this.mangNoron, 0.9);
            this.boPhieuTongHop.themMoHinh(this.hoiQuyTuyenTinh, 0.8);
            this.boPhieuTongHop.themMoHinh(this.hocTangCuong, 0.7);
            this.boPhieuTongHop.themMoHinh(this.batCauBet, 0.9);
            this.boPhieuTongHop.themMoHinh(this.batCauZigzag, 0.85);
            this.boPhieuTongHop.themMoHinh(this.batCauDao11, 0.9);
            this.boPhieuTongHop.themMoHinh(this.batCauDao22, 0.85);
            this.boPhieuTongHop.themMoHinh(this.batCauChuKy, 0.8);
            this.boPhieuTongHop.themMoHinh(this.batCauXuHuong, 0.85);
            this.boPhieuTongHop.themMoHinh(this.batCauCanBang, 0.8);
            this.boPhieuTongHop.themMoHinh(this.batCauMomentum, 0.8);
            this.boPhieuTongHop.themMoHinh(this.batCauBienDong, 0.75);
            this.boPhieuTongHop.themMoHinh(this.batCauFibonacci, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLoc1, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLoc2, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLoc3, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLoc4, 0.8);
            this.boPhieuTongHop.themMoHinh(this.boLoc5, 0.8);
            
            this.boPhieuTongHop.huanLuyen(duLieuHuan);
            
            this.duLieuML = duLieuHuan;
            this.daHuan = true;
            console.log(`🧠 30 thuật toán đã huấn luyện cho ${game}`);
        } catch (e) {
            console.log(`⚠️ Lỗi huấn luyện: ${e.message}`);
        }
    }

    // ============================================================
    // DỰ ĐOÁN BẰNG 30 THUẬT TOÁN
    // ============================================================
    duDoanML(dacTrung) {
        if (!this.daHuan) return null;
        
        const ketQua = [];
        const trongSoMau = {
            'knn': 1.0, 'naiveBayes': 0.8, 'cayQuyetDinh': 0.9,
            'rungNgauNhien': 1.1, 'hoiQuyLogistic': 0.9, 'svm': 0.9,
            'tangCuongGradient': 1.0, 'xgboost': 1.0, 'adaboost': 0.9,
            'lstm': 0.8, 'boLocKalman': 0.7, 'mangNoron': 0.9,
            'hoiQuyTuyenTinh': 0.8, 'hocTangCuong': 0.7, 'boPhieuTongHop': 1.2,
            'batCauBet': 0.9, 'batCauZigzag': 0.85, 'batCauDao11': 0.9,
            'batCauDao22': 0.85, 'batCauChuKy': 0.8, 'batCauXuHuong': 0.85,
            'batCauCanBang': 0.8, 'batCauMomentum': 0.8, 'batCauBienDong': 0.75,
            'batCauFibonacci': 0.8, 'boLoc1': 0.8, 'boLoc2': 0.8,
            'boLoc3': 0.8, 'boLoc4': 0.8, 'boLoc5': 0.8
        };
        
        try {
            const duDoan = {
                knn: this.knn.duDoan(dacTrung),
                naiveBayes: this.naiveBayes.duDoan(dacTrung.map(v => Math.round(v * 10) / 10)),
                cayQuyetDinh: this.cayQuyetDinh.duDoan(dacTrung),
                rungNgauNhien: this.rungNgauNhien.duDoan(dacTrung),
                hoiQuyLogistic: this.hoiQuyLogistic.duDoan(dacTrung),
                svm: this.svm.duDoan(dacTrung),
                tangCuongGradient: this.tangCuongGradient.duDoan(dacTrung),
                xgboost: this.xgboost.duDoan(dacTrung),
                adaboost: this.adaboost.duDoan(dacTrung),
                lstm: this.lstm.duDoan(dacTrung),
                boLocKalman: this.boLocKalman.duDoan(dacTrung),
                mangNoron: this.mangNoron.duDoan(dacTrung),
                hoiQuyTuyenTinh: this.hoiQuyTuyenTinh.duDoan(dacTrung),
                hocTangCuong: this.hocTangCuong.duDoan(dacTrung),
                boPhieuTongHop: this.boPhieuTongHop.duDoan(dacTrung),
                batCauBet: this.batCauBet.duDoan(dacTrung),
                batCauZigzag: this.batCauZigzag.duDoan(dacTrung),
                batCauDao11: this.batCauDao11.duDoan(dacTrung),
                batCauDao22: this.batCauDao22.duDoan(dacTrung),
                batCauChuKy: this.batCauChuKy.duDoan(dacTrung),
                batCauXuHuong: this.batCauXuHuong.duDoan(dacTrung),
                batCauCanBang: this.batCauCanBang.duDoan(dacTrung),
                batCauMomentum: this.batCauMomentum.duDoan(dacTrung),
                batCauBienDong: this.batCauBienDong.duDoan(dacTrung),
                batCauFibonacci: this.batCauFibonacci.duDoan(dacTrung),
                boLoc1: this.boLoc1.duDoan(dacTrung),
                boLoc2: this.boLoc2.duDoan(dacTrung),
                boLoc3: this.boLoc3.duDoan(dacTrung),
                boLoc4: this.boLoc4.duDoan(dacTrung),
                boLoc5: this.boLoc5.duDoan(dacTrung)
            };
            
            let tPhieu = 0, xPhieu = 0;
            let tongTrongSo = 0;
            let soMau = 0;
            
            for (const [ten, pred] of Object.entries(duDoan)) {
                if (pred) {
                    const w = trongSoMau[ten] || 0.8;
                    if (pred === 'T') tPhieu += w;
                    else if (pred === 'X') xPhieu += w;
                    tongTrongSo += w;
                    soMau++;
                }
            }
            
            if (soMau < 5) return null;
            
            const doTinCay = Math.round(Math.max(tPhieu, xPhieu) / (tPhieu + xPhieu) * 100);
            return {
                duDoan: tPhieu > xPhieu ? 'T' : 'X',
                doTinCay: Math.min(98, Math.max(55, doTinCay)),
                soMau: soMau
            };
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    // HỌC
    // ============================================================
    hoc(game, ketQua, doTinCay, doDaiBet, loaiBreak) {
        if (!this.boNhoChuoi.has(game)) {
            this.boNhoChuoi.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [], last100: [],
                tai: 0, xiu: 0, tong: 0,
                demBet: 0, betThanhCong: 0, betThatBai: 0,
                demBreak: 0, breakThanhCong: 0, breakThatBai: 0
            });
        }
        const s = this.boNhoChuoi.get(game);
        s.tong++;
        if (ketQua === 'T') {
            s.tai++;
            s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        } else {
            s.xiu++;
            s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        }
        if (s.chuoi > s.totNhat) s.totNhat = s.chuoi;
        if (s.chuoi < s.teNhat) s.teNhat = s.chuoi;
        
        s.last5.push(ketQua);
        s.last10.push(ketQua);
        s.last20.push(ketQua);
        s.last50.push(ketQua);
        s.last100.push(ketQua);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        if (s.last100.length > 100) s.last100.shift();

        // Bet Memory
        if (doDaiBet > 0) {
            const betKey = `${game}_bet`;
            if (!this.boNhoBet.has(betKey)) {
                this.boNhoBet.set(betKey, {
                    doDai: [], ketQua: [], doChinhXac: 0.5,
                    thongKeDoDai: new Map()
                });
            }
            const bm = this.boNhoBet.get(betKey);
            bm.doDai.push(doDaiBet);
            bm.ketQua.push(ketQua);
            if (bm.doDai.length > 200) bm.doDai.shift();
            if (bm.ketQua.length > 200) bm.ketQua.shift();
            
            if (!bm.thongKeDoDai.has(doDaiBet)) {
                bm.thongKeDoDai.set(doDaiBet, { T: 0, X: 0, tong: 0 });
            }
            const ls = bm.thongKeDoDai.get(doDaiBet);
            ls[ketQua] = (ls[ketQua] || 0) + 1;
            ls.tong++;
            
            const ganDay = bm.ketQua.slice(-50);
            const dung = ganDay.filter(r => r === ketQua).length;
            bm.doChinhXac = ganDay.length > 0 ? dung / ganDay.length : 0.5;
            
            s.demBet++;
            if (ketQua === 'T') s.betThanhCong++;
            else s.betThatBai++;
        }

        // Sequence Memory
        const seqKey = `${game}_seq`;
        if (!this.boNhoMau.has(seqKey)) {
            this.boNhoMau.set(seqKey, new Map());
        }
        const seqMap = this.boNhoMau.get(seqKey);
        const last4 = s.last5.slice(0, 4).join('');
        if (last4.length === 4) {
            if (!seqMap.has(last4)) {
                seqMap.set(last4, { T: 0, X: 0 });
            }
            seqMap.get(last4)[ketQua]++;
        }

        this.luuDuLieu();
    }

    // ============================================================
    // PHÂN TÍCH BỆT
    // ============================================================
    phanTichBet(data, game) {
        if (data.length < 2) return null;
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }

        const betKey = `${game}_bet`;
        const bm = this.boNhoBet.get(betKey);
        const doChinhXac = bm ? bm.doChinhXac : 0.5;
        
        let doChinhXacDoDai = 0.5;
        if (bm && bm.thongKeDoDai.has(dem)) {
            const ls = bm.thongKeDoDai.get(dem);
            doChinhXacDoDai = ls.tong > 0 ? Math.max(ls.T, ls.X) / ls.tong : 0.5;
        }

        if (dem >= 14) {
            return { ten: `🔥 Bệt cực đại ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 80 };
        }
        if (dem >= 12) {
            return { ten: `🔥 Bệt siêu dài ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 70 };
        }
        if (dem >= 10) {
            if (doChinhXac > 0.55 || doChinhXacDoDai > 0.55) {
                return { ten: `🔥 Bệt dài ${dem} → BẺ (${Math.round(doChinhXac*100)}%)`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 60 };
            }
            return { ten: `🔥 Bệt dài ${dem} → Cân nhắc`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 45 };
        }
        if (dem >= 8) {
            if (doChinhXac > 0.6 || doChinhXacDoDai > 0.6) {
                return { ten: `⚡ Bệt dài ${dem} → BẺ (${Math.round(doChinhXac*100)}%)`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 50 };
            }
            return { ten: `⚡ Bệt dài ${dem} → Cân nhắc`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 35 };
        }
        if (dem >= 6) {
            if (doChinhXac > 0.65 || doChinhXacDoDai > 0.65) {
                return { ten: `📈 Bệt vừa ${dem} → BẺ (${Math.round(doChinhXac*100)}%)`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 40 };
            }
            return { ten: `📈 Bệt vừa ${dem} → Theo`, duDoan: cuoi, diem: 22 };
        }
        if (dem >= 4) {
            if (doChinhXac > 0.7 || doChinhXacDoDai > 0.7) {
                return { ten: `📊 Bệt ngắn ${dem} → BẺ (${Math.round(doChinhXac*100)}%)`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 28 };
            }
            return { ten: `📊 Bệt ngắn ${dem} → Theo`, duDoan: cuoi, diem: 16 };
        }
        if (dem >= 3) {
            return { ten: `📊 Bệt ${dem} → Theo`, duDoan: cuoi, diem: 10 };
        }
        if (dem >= 2) {
            return { ten: `📊 Bệt 2 → Theo`, duDoan: cuoi, diem: 6 };
        }
        return null;
    }

    // ============================================================
    // DỰ ĐOÁN CHÍNH
    // ============================================================
    duDoan(game, data) {
        if (!data || data.length < 2) {
            return this.fallback(game);
        }

        const lichSu = data.map(d => d === 'T' ? 'T' : 'X');
        let T = 0, X = 0;
        const mau = [];

        // Phân tích bệt
        const bet = this.phanTichBet(lichSu, game);
        if (bet) { mau.push(bet); if (bet.duDoan === 'T') T += bet.diem; else X += bet.diem; }

        // Phân tích zigzag
        let thayDoi = 0;
        for (let i = 1; i < Math.min(lichSu.length, 10); i++) {
            if (lichSu[i-1] !== lichSu[i]) thayDoi++;
        }
        if (thayDoi >= 8) {
            mau.push({ ten: `⚡ Zigzag ${thayDoi} → Bẻ`, duDoan: lichSu[0] === 'T' ? 'X' : 'T', diem: 40 });
            if (lichSu[0] === 'T') T += 40; else X += 40;
        } else if (thayDoi >= 5) {
            mau.push({ ten: `🌀 Zigzag ${thayDoi} → Bẻ`, duDoan: lichSu[0] === 'T' ? 'X' : 'T', diem: 25 });
            if (lichSu[0] === 'T') T += 25; else X += 25;
        }

        // ML Prediction
        if (lichSu.length >= 8) {
            const demT = lichSu.slice(0, 8).filter(r => r === 'T').length;
            const thayDoi2 = lichSu.slice(0, 8).filter((r, i) => i > 0 && r !== lichSu[i-1]).length;
            const xuHuong = demT / 8;
            const cuoi = lichSu[0] === 'T' ? 1 : 0;
            const dau = lichSu[lichSu.length - 1] === 'T' ? 1 : 0;
            let cap = 0;
            for (let i = 0; i < lichSu.length - 1; i++) {
                if (lichSu[i] === lichSu[i+1]) cap++;
            }
            let zigzag = 0;
            for (let i = 1; i < lichSu.length - 1; i++) {
                if (lichSu[i-1] !== lichSu[i] && lichSu[i] !== lichSu[i+1]) zigzag++;
            }
            const doDai = lichSu.length;
            const tyLeT = demT / doDai;
            const bienDong = thayDoi2 / doDai;
            const daoChieu = zigzag / doDai;
            const canBang = Math.abs(demT - (doDai - demT)) / doDai;
            
            const dacTrung = [demT, thayDoi2, Math.round(xuHuong * 10), cuoi, dau, cap, zigzag, doDai,
                             Math.round(tyLeT * 10), Math.round(bienDong * 10), Math.round(daoChieu * 10),
                             Math.round(canBang * 10)];
            
            const mlKetQua = this.duDoanML(dacTrung);
            if (mlKetQua) {
                const trongSoML = 1.3;
                if (mlKetQua.duDoan === 'T') {
                    T += 20 * trongSoML * (mlKetQua.doTinCay / 100);
                    mau.push({ ten: `🤖 ML (${mlKetQua.soMau} models) → Tài`, duDoan: 'T', diem: 20 });
                } else {
                    X += 20 * trongSoML * (mlKetQua.doTinCay / 100);
                    mau.push({ ten: `🤖 ML (${mlKetQua.soMau} models) → Xỉu`, duDoan: 'X', diem: 20 });
                }
            }
        }

        // Điều chỉnh theo chuỗi
        const s = this.boNhoChuoi.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { X *= 1.8; mau.push({ ten: '📊 Last5 Tài→Bẻ Xỉu', duDoan: 'X', diem: 30 }); }
                else if (demT <= 1) { T *= 1.8; mau.push({ ten: '📊 Last5 Xỉu→Bẻ Tài', duDoan: 'T', diem: 30 }); }
            }
            if (s.chuoi >= 6) {
                T *= 1.4; X *= 1.4;
                mau.push({ ten: '🔥 Bám bệt cực dài', duDoan: 'T', diem: 22 });
            } else if (s.chuoi >= 4) {
                T *= 1.2; X *= 1.2;
                mau.push({ ten: '🔥 Bám bệt dài', duDoan: 'T', diem: 14 });
            }
            if (s.chuoi <= -5) {
                const temp = T; T = X * 2.0; X = temp * 2.0;
                mau.push({ ten: '🔄 Bẻ bệt cực mạnh', duDoan: 'T', diem: 32 });
            } else if (s.chuoi <= -4) {
                const temp = T; T = X * 1.7; X = temp * 1.7;
                mau.push({ ten: '🔄 Bẻ bệt siêu mạnh', duDoan: 'T', diem: 25 });
            } else if (s.chuoi <= -3) {
                const temp = T; T = X * 1.4; X = temp * 1.4;
                mau.push({ ten: '🔄 Bẻ bệt mạnh', duDoan: 'T', diem: 18 });
            }
        }

        const tong = T + X;
        if (tong === 0) return this.fallback(game);

        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        if (mau.length >= 8) doTinCay = Math.min(99, doTinCay + 10);
        else if (mau.length >= 5) doTinCay = Math.min(99, doTinCay + 6);
        else if (mau.length >= 3) doTinCay = Math.min(99, doTinCay + 3);
        doTinCay = Math.min(99, Math.max(50, doTinCay));

        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        const thongTinBet = this.layThongTinBet(lichSu);
        this.hoc(game, ketQua, doTinCay, thongTinBet.doDai, null);

        const chiTiet = mau.map(p => p.ten).slice(0, 4).join(' • ');

        return {
            duDoan: duDoan,
            doTinCay: doTinCay,
            chiTiet: chiTiet || 'Phân tích siêu chính xác',
            soMau: mau.length,
            doDaiBet: thongTinBet.doDai || 0
        };
    }

    layThongTinBet(data) {
        if (data.length < 2) return { doDai: 0, loai: null };
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }
        return { doDai: dem, loai: cuoi };
    }

    fallback(game) {
        const s = this.boNhoChuoi.get(game);
        if (s && s.chuoi >= 5) return { duDoan: 'TÀI', doTinCay: 65, chiTiet: '🔥 Bám bệt dài' };
        if (s && s.chuoi <= -4) return { duDoan: 'TÀI', doTinCay: 65, chiTiet: '🔄 Bẻ bệt siêu mạnh' };
        if (s && s.chuoi <= -3) return { duDoan: 'TÀI', doTinCay: 58, chiTiet: '🔄 Bẻ bệt mạnh' };
        if (s && s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) return { duDoan: 'XỈU', doTinCay: 62, chiTiet: '📊 Last5 Tài→Xỉu' };
            if (demT <= 1) return { duDoan: 'TÀI', doTinCay: 62, chiTiet: '📊 Last5 Xỉu→Tài' };
        }
        const seed = Date.now() % 3;
        const cacDuDoan = ['TÀI', 'XỈU', 'TÀI'];
        return { duDoan: cacDuDoan[seed], doTinCay: 50, chiTiet: '📊 Phân tích cơ bản' };
    }

    luuDuLieu() {
        try {
            const data = {
                chuoi: Object.fromEntries(this.boNhoChuoi),
                bet: Object.fromEntries(this.boNhoBet),
                mau: Object.fromEntries(this.boNhoMau),
                daHuan: this.daHuan
            };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    taiDuLieu() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.chuoi) {
                    for (const [k, v] of Object.entries(data.chuoi)) {
                        this.boNhoChuoi.set(k, v);
                    }
                }
                if (data.bet) {
                    for (const [k, v] of Object.entries(data.bet)) {
                        this.boNhoBet.set(k, v);
                    }
                }
                if (data.mau) {
                    for (const [k, v] of Object.entries(data.mau)) {
                        this.boNhoMau.set(k, v);
                    }
                }
                if (data.daHuan) {
                    this.daHuan = data.daHuan;
                }
            }
        } catch (e) {}
    }

    layThongKe(game) {
        const s = this.boNhoChuoi.get(game);
        const bm = this.boNhoBet.get(`${game}_bet`);
        return {
            chuoi: s ? s.chuoi : 0,
            chuoi_dai: s ? s.totNhat : 0,
            tong: s ? s.tong : 0,
            tai: s ? s.tai : 0,
            xiu: s ? s.xiu : 0,
            doChinhXacBet: bm ? Math.round(bm.doChinhXac * 100) : 0,
            doDaiBetTB: bm && bm.doDai.length > 0 ? Math.round(bm.doDai.reduce((a,b) => a+b, 0) / bm.doDai.length) : 0,
            daHuanML: this.daHuan
        };
    }
}

const predictor = new SieuMayHocPredictor();

// ============================================================
// 📊 QUẢN LÝ LỊCH SỬ
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0],
        dice2: item.dices[1],
        dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(url, { timeout: 10000 });
        return transformData(r.data);
    } catch (e) { return null; }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history = data.history || { hu: [], md5: [] };
            stats = data.stats || stats;
            lastPhien = data.lastPhien || { hu: null, md5: null };
        }
    } catch (e) {}
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history, stats, lastPhien, updated: new Date().toISOString() }, null, 2));
    } catch (e) {}
}

function updateStats(type, dung) {
    const s = stats[type];
    s.total++;
    if (dung) {
        s.dung++;
        s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        if (s.chuoi > s.chuoi_dai) s.chuoi_dai = s.chuoi;
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
    }
    s.tyle = s.total > 0 ? Math.round((s.dung / s.total) * 100) : 0;
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0) return;
    let updated = 0;
    for (const r of history[type]) {
        if (r.status && r.status !== '') continue;
        const actual = data.find(d => d.phien.toString() === r.phien_hien_tai);
        if (actual) {
            const dung = r.prediction === actual.result;
            r.status = dung ? '✅' : '❌';
            r.actual = actual.result;
            updateStats(type, dung);
            updated++;
        }
    }
    if (updated > 0) saveHistory();
}

// ============================================================
// ⚡ TỰ ĐỘNG
// ============================================================

async function autoProcess() {
    try {
        const dHu = await fetchData('hu');
        if (dHu && dHu.length > 0) {
            const cur = dHu[0].phien;
            if (lastPhien.hu !== cur) {
                verifyAndUpdate('hu', dHu);
                const exist = history.hu.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dHu.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    if (history.hu.length > 20) {
                        const trainData = history.hu.map(r => r.actual === 'TÀI' ? 'T' : 'X');
                        predictor.huanLuyen('hu', trainData);
                    }
                    const result = predictor.duDoan('hu', data);
                    const record = {
                        phien: dHu[0].phien,
                        phien_hien_tai: (dHu[0].phien + 1).toString(),
                        dice: `${dHu[0].dice1}-${dHu[0].dice2}-${dHu[0].dice3}`,
                        total: dHu[0].total,
                        actual: dHu[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0
                    };
                    history.hu.unshift(record);
                    if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
                    lastPhien.hu = cur;
                    lastPred.hu = result;
                    console.log(`[HU] ${result.duDoan} (${result.doTinCay}%) - Bệt:${result.doDaiBet||0} - ${result.soMau||0} patterns`);
                }
            }
        }

        const dMd5 = await fetchData('md5');
        if (dMd5 && dMd5.length > 0) {
            const cur = dMd5[0].phien;
            if (lastPhien.md5 !== cur) {
                verifyAndUpdate('md5', dMd5);
                const exist = history.md5.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dMd5.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    if (history.md5.length > 20) {
                        const trainData = history.md5.map(r => r.actual === 'TÀI' ? 'T' : 'X');
                        predictor.huanLuyen('md5', trainData);
                    }
                    const result = predictor.duDoan('md5', data);
                    const record = {
                        phien: dMd5[0].phien,
                        phien_hien_tai: (dMd5[0].phien + 1).toString(),
                        dice: `${dMd5[0].dice1}-${dMd5[0].dice2}-${dMd5[0].dice3}`,
                        total: dMd5[0].total,
                        actual: dMd5[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0
                    };
                    history.md5.unshift(record);
                    if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
                    lastPhien.md5 = cur;
                    lastPred.md5 = result;
                    console.log(`[MD5] ${result.duDoan} (${result.doTinCay}%) - Bệt:${result.doDaiBet||0} - ${result.soMau||0} patterns`);
                }
            }
        }

        saveHistory();
    } catch (e) {}
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🌐 GIAO DIỆN VIP ĐỘC QUYỀN
// ============================================================

function generateVIPHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 25);
    const learning = predictor.layThongKe(type);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        const betTag = r.betLength && r.betLength >= 3 ? '🔥' : '';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${cls}">${txt}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail ? r.detail.substring(0, 20) + (r.detail.length > 20 ? '...' : '') : '-'} ${betTag}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX UNIVERSE - ANH KHÔI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #7b2ffc;
            --secondary: #00d4ff;
            --success: #4ade80;
            --danger: #f87171;
            --warning: #fb923c;
            --bg: #050510;
            --card: rgba(255,255,255,0.03);
            --border: rgba(255,255,255,0.06);
            --text: #e8e8e8;
            --text-secondary: #667788;
            --text-muted: #334455;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .bg-vip {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(123, 47, 252, 0.12) 0%, transparent 55%),
                radial-gradient(ellipse at 90% 70%, rgba(0, 212, 255, 0.08) 0%, transparent 55%),
                radial-gradient(ellipse at 50% 100%, rgba(123, 47, 252, 0.05) 0%, transparent 35%);
            overflow: hidden;
        }
        
        .bg-vip::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(1.5px 1.5px at 10px 20px, rgba(255,255,255,0.08), transparent),
                radial-gradient(1.5px 1.5px at 30px 60px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1.5px 1.5px at 50px 140px, rgba(255,255,255,0.07), transparent),
                radial-gradient(1.5px 1.5px at 80px 30px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1.5px 1.5px at 120px 90px, rgba(255,255,255,0.07), transparent),
                radial-gradient(1.5px 1.5px at 180px 50px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1.5px 1.5px at 250px 110px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1.5px 1.5px at 320px 70px, rgba(255,255,255,0.05), transparent);
            background-size: 400px 400px;
            animation: starDrift 60s linear infinite;
        }
        
        @keyframes starDrift {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-50px, -30px); }
        }
        
        .bg-vip::after {
            content: '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦';
            position: absolute;
            top: 3%;
            right: 3%;
            font-size: 80px;
            color: rgba(123, 47, 252, 0.02);
            letter-spacing: 30px;
            animation: spinSlow 80s linear infinite;
            white-space: nowrap;
        }
        
        @keyframes spinSlow {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.05); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px;
        }
        
        .header-vip {
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.10), rgba(0, 212, 255, 0.05));
            border-radius: 20px;
            padding: 18px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(123, 47, 252, 0.12);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-vip::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(123, 47, 252, 0.04), transparent, rgba(0, 212, 255, 0.04), transparent);
            animation: spinConic 40s linear infinite;
        }
        
        @keyframes spinConic {
            100% { transform: rotate(360deg); }
        }
        
        .header-vip .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-vip {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .logo-vip .icon {
            font-size: 34px;
            animation: glowPulse 2.5s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15));
        }
        
        @keyframes glowPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(123, 47, 252, 0.3)); }
        }
        
        .logo-vip .ten {
            font-family: 'Orbitron', monospace;
            font-size: 24px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #00d4ff, #7b2ffc);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmerGrad 3.5s ease-in-out infinite;
        }
        
        @keyframes shimmerGrad {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-vip .sub {
            font-size: 11px;
            color: var(--text-secondary);
            letter-spacing: 3px;
            font-weight: 300;
        }
        
        .header-vip .info {
            text-align: right;
        }
        
        .badge-vip {
            display: inline-block;
            padding: 5px 20px;
            border-radius: 30px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.12), rgba(0, 212, 255, 0.06));
            border: 1px solid rgba(123, 47, 252, 0.12);
            color: #a78bfa;
            backdrop-filter: blur(10px);
        }
        
        .badge-vip .live {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 8px;
            animation: livePulse 0.8s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.15);
        }
        
        @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
        }
        
        .badge-vip .version {
            color: var(--text-muted);
            font-weight: 400;
            letter-spacing: 1px;
        }
        
        .stats-vip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 10px;
            margin-bottom: 16px;
        }
        
        .stat-vip {
            background: var(--card);
            border-radius: 14px;
            padding: 12px 16px;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .stat-vip:hover {
            transform: translateY(-3px) scale(1.02);
            border-color: rgba(123, 47, 252, 0.15);
            box-shadow: 0 8px 30px rgba(123, 47, 252, 0.04);
        }
        
        .stat-vip .label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--text-muted);
            font-weight: 700;
            position: relative;
            z-index: 1;
        }
        
        .stat-vip .value {
            font-size: 20px;
            font-weight: 800;
            margin-top: 2px;
            font-family: 'Orbitron', monospace;
            position: relative;
            z-index: 1;
        }
        
        .stat-vip .value.xanh { color: var(--success); }
        .stat-vip .value.do { color: var(--danger); }
        .stat-vip .value.cam { color: var(--warning); }
        .stat-vip .value.xanh-duong { color: #60a5fa; }
        .stat-vip .value.tim { color: #a78bfa; }
        .stat-vip .value.cyan { color: #22d3ee; }
        .stat-vip .value.vang { color: #fbbf24; }
        
        .stat-vip .sub {
            font-size: 9px;
            color: var(--text-muted);
            margin-top: 2px;
            position: relative;
            z-index: 1;
        }
        
        .table-vip {
            background: var(--card);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
        }
        
        .table-vip .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 18px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-vip .header h3 {
            font-size: 14px;
            font-weight: 700;
            color: #d0d0d0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-vip .header .count {
            font-size: 11px;
            color: var(--text-muted);
        }
        
        .table-vip .header .ml-badge {
            font-size: 10px;
            color: #a78bfa;
            background: rgba(123, 47, 252, 0.1);
            padding: 2px 12px;
            border-radius: 12px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        
        th {
            background: rgba(255,255,255,0.02);
            padding: 8px 12px;
            text-align: left;
            font-weight: 700;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
        }
        
        td {
            padding: 7px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        
        tr:hover td {
            background: rgba(255,255,255,0.015);
        }
        
        .phien {
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            color: var(--text-secondary);
        }
        
        .du-doan {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 11px;
        }
        
        .du-doan.tai {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .du-doan.xiu {
            background: rgba(248, 113, 113, 0.08);
            color: var(--danger);
        }
        
        .do-tin {
            font-weight: 700;
            color: #60a5fa;
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .trang-thai.dung {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .trang-thai.sai {
            background: rgba(248, 113, 113, 0.08);
            color: var(--danger);
        }
        
        .trang-thai.cho {
            background: rgba(251, 146, 60, 0.08);
            color: var(--warning);
        }
        
        .chi-tiet {
            font-size: 10px;
            color: var(--text-muted);
            max-width: 180px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .footer-vip {
            text-align: center;
            padding: 14px;
            color: var(--text-muted);
            font-size: 10px;
            border-top: 1px solid var(--border);
            margin-top: 16px;
        }
        
        .footer-vip .highlight {
            color: #a78bfa;
        }
        
        .footer-vip .heart {
            color: var(--danger);
            animation: heartBeat 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .footer-vip .ml-tag {
            color: #22d3ee;
        }
        
        @media (max-width: 768px) {
            .header-vip { padding: 14px; }
            .header-vip .content { flex-direction: column; align-items: flex-start; }
            .header-vip .info { text-align: left; width: 100%; }
            .stats-vip { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-vip .value { font-size: 16px; }
            .logo-vip .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 5px 6px; }
            .chi-tiet { max-width: 60px; }
        }
        
        @media (max-width: 480px) {
            .stats-vip { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-vip .ten { font-size: 14px; }
            .logo-vip .icon { font-size: 24px; }
            .du-doan { font-size: 9px; padding: 1px 8px; }
            .trang-thai { font-size: 7px; padding: 1px 6px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(123, 47, 252, 0.12); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(123, 47, 252, 0.25); }
    </style>
</head>
<body>
    <div class="bg-vip"></div>
    
    <div class="container">
        <div class="header-vip">
            <div class="content">
                <div class="logo-vip">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX UNIVERSE</div>
                        <div class="sub">BỞI ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-vip">
                        <span class="live"></span>
                        ${type.toUpperCase()} • TRỰC TIẾP
                        <span class="version">v14.0</span>
                    </div>
                    <div style="font-size:9px;color:var(--text-muted);margin-top:3px;">
                        ${new Date().toLocaleString('vi-VN')} • 30 Thuật Toán
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-vip">
            <div class="stat-vip">
                <div class="label">Tổng Dự Đoán</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">${type.toUpperCase()}</div>
            </div>
            <div class="stat-vip">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.dung}</div>
                <div class="sub">${s.tyle}%</div>
            </div>
            <div class="stat-vip">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.sai}</div>
                <div class="sub">${100 - s.tyle}%</div>
            </div>
            <div class="stat-vip">
                <div class="label">📊 Tỷ Lệ Đúng</div>
                <div class="value ${s.tyle >= 65 ? 'xanh' : s.tyle >= 55 ? 'cam' : 'do'}">${s.tyle}%</div>
                <div class="sub">${s.tyle >= 65 ? '🌟 Xuất sắc' : s.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-vip">
                <div class="label">⚡ Chuỗi Hiện Tại</div>
                <div class="value ${s.chuoi > 0 ? 'xanh' : s.chuoi < 0 ? 'do' : 'cam'}">${s.chuoi > 0 ? '✅ +' + s.chuoi : s.chuoi < 0 ? '❌ ' + s.chuoi : '0'}</div>
                <div class="sub">${s.chuoi > 0 ? '🔥 Đang thắng' : s.chuoi < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-vip">
                <div class="label">🏆 Chuỗi Dài Nhất</div>
                <div class="value cyan">${s.chuoi_dai}</div>
                <div class="sub">${s.chuoi_dai >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <div class="table-vip">
            <div class="header">
                <h3>📋 LỊCH SỬ DỰ ĐOÁN</h3>
                <span class="count">${h.length} phiên • Hiển thị ${Math.min(25, h.length)} gần nhất</span>
                <span class="ml-badge">🤖 30 Thuật Toán</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự Đoán</th>
                        <th>Độ Tin</th>
                        <th>Kết Quả</th>
                        <th>Thực Tế</th>
                        <th>Phân Tích</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang chờ dữ liệu...</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="footer-vip">
            <span style="color:var(--text-muted);">🌌 TX Universe Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            Phiên bản 14.0 • 
            <span class="ml-tag">🤖 30 Thuật Toán</span> • 
            Tự động cập nhật 5s
            <br>
            <span style="font-size:8px;color:var(--text-muted);">
                <span class="heart">❤️</span> 15 ML + 15 Bắt Cầu • KNN • Bayes • Cây • Rừng • Logistic • SVM • Gradient • XGBoost • AdaBoost • LSTM • Kalman • Nơ-ron • Ensemble • Q-Learning • Hồi Quy • Bệt • Zigzag • Đảo 1-1 • Đảo 2-2 • Chu Kỳ • Xu Hướng • Cân Bằng • Momentum • Biến Động • Fibonacci
            </span>
        </div>
    </div>
    
    <script>
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Universe', version: '14.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.fallback('hu');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (history.hu.length > 20) {
            const trainData = history.hu.map(r => r.actual === 'TÀI' ? 'T' : 'X');
            predictor.huanLuyen('hu', trainData);
        }
        const result = predictor.duDoan('hu', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.duDoan,
            confidence: result.doTinCay,
            detail: result.chiTiet,
            status: '',
            timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0
        };
        history.hu.unshift(record);
        if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            const result = predictor.fallback('md5');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (history.md5.length > 20) {
            const trainData = history.md5.map(r => r.actual === 'TÀI' ? 'T' : 'X');
            predictor.huanLuyen('md5', trainData);
        }
        const result = predictor.duDoan('md5', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.duDoan,
            confidence: result.doTinCay,
            detail: result.chiTiet,
            status: '',
            timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0
        };
        history.md5.unshift(record);
        if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateVIPHTML('hu'));
});

app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateVIPHTML('md5'));
});

app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const dung = stats.hu.dung + stats.md5.dung;
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: { total, dung, sai: total - dung, tyle: total > 0 ? Math.round((dung / total) * 100) : 0 },
        learning: {
            hu: predictor.layThongKe('hu'),
            md5: predictor.layThongKe('md5')
        },
        lastPred
    });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
        md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
    };
    lastPhien = { hu: null, md5: null };
    lastPred = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   🌌  TX UNIVERSE v14.0 - ANH KHÔI                          ║');
    console.log('║                                                               ║');
    console.log('║   🚀 30 THUẬT TOÁN THÔNG MINH                               ║');
    console.log('║   🎯 15 ML + 15 BẮT CẦU                                    ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🤖 15 THUẬT TOÁN HỌC MÁY:                                 ║');
    console.log('║   1. KNN - Láng Giềng Gần Nhất                               ║');
    console.log('║   2. Naive Bayes - Xác Suất Bayes                            ║');
    console.log('║   3. Cây Quyết Định                                          ║');
    console.log('║   4. Rừng Ngẫu Nhiên                                         ║');
    console.log('║   5. Hồi Quy Logistic                                        ║');
    console.log('║   6. SVM - Máy Hỗ Trợ Vector                                 ║');
    console.log('║   7. Tăng Cường Gradient                                     ║');
    console.log('║   8. XGBoost - Tăng Cường Cực Đại                            ║');
    console.log('║   9. AdaBoost - Tăng Cường Thích Ứng                         ║');
    console.log('║  10. LSTM - Bộ Nhớ Dài Hạn Ngắn Hạn                          ║');
    console.log('║  11. Bộ Lọc Kalman                                           ║');
    console.log('║  12. Mạng Nơ-ron                                             ║');
    console.log('║  13. Bỏ Phiếu Tổng Hợp                                       ║');
    console.log('║  14. Học Tăng Cường - Q-Learning                             ║');
    console.log('║  15. Hồi Quy Tuyến Tính                                      ║');
    console.log('║                                                               ║');
    console.log('║   🎯 15 THUẬT TOÁN BẮT CẦU:                                 ║');
    console.log('║   16. Bắt Cầu Bệt                                            ║');
    console.log('║   17. Bắt Cầu Zigzag                                         ║');
    console.log('║   18. Bắt Cầu Đảo 1-1                                        ║');
    console.log('║   19. Bắt Cầu Đảo 2-2                                        ║');
    console.log('║   20. Bắt Cầu Chu Kỳ                                         ║');
    console.log('║   21. Bắt Cầu Xu Hướng                                       ║');
    console.log('║   22. Bắt Cầu Cân Bằng                                       ║');
    console.log('║   23. Bắt Cầu Momentum                                       ║');
    console.log('║   24. Bắt Cầu Biến Động                                      ║');
    console.log('║   25. Bắt Cầu Fibonacci                                      ║');
    console.log('║   26-30. Bộ Lọc Thông Minh (5)                               ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
