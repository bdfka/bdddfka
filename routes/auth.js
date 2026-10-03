const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_LONG_RANDOM';

function genKey() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const g = () => Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
    return `AFFIT-${g()}-${g()}-${g()}`;
}

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.length < 3) return res.status(400).json({ error: 'Имя короткое' });
        if (!password || password.length < 4) return res.status(400).json({ error: 'Пароль короткий' });
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Только буквы/цифры/_' });

        const ex = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (ex) return res.status(409).json({ error: 'Пользователь существует' });

        const hash = await bcrypt.hash(password, 10);
        let key;
        let a = 0;
        do { key = genKey(); a++; if (a > 10) throw new Error('Key gen fail'); }
        while (db.prepare('SELECT id FROM users WHERE license_key = ?').get(key));

        const isFirst = db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0;
        const role = isFirst ? 'admin' : 'user';
        const approved = isFirst ? 1 : 0;

        db.prepare('INSERT INTO users (username, password_hash, license_key, role, approved) VALUES (?,?,?,?,?)')
            .run(username, hash, key, role, approved);

        res.json({
            success: true,
            message: approved ? 'Ты администратор!' : 'Жди одобрения',
            licenseKey: approved ? key : null,
        });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) return res.status(404).json({ error: 'Не найден' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный пароль' });
        if (!user.approved) return res.status(403).json({ error: 'Не одобрен' });

        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        db.prepare('INSERT INTO login_logs (username, action, ip) VALUES (?,?,?)')
            .run(username, 'login', req.ip);

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role },
            JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true, token,
            user: { username: user.username, role: user.role, licenseKey: user.license_key },
        });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/verify', (req, res) => {
    try {
        const { licenseKey } = req.body;
        if (!licenseKey) return res.status(400).json({ error: 'Нет ключа' });
        const user = db.prepare('SELECT * FROM users WHERE license_key = ?').get(licenseKey);
        if (!user) return res.status(404).json({ error: 'Ключ не найден' });
        if (!user.approved) return res.status(403).json({ error: 'Не одобрен' });
        res.json({ success: true, username: user.username, role: user.role });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/change-password', (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
        let d;
        try { d = jwt.verify(auth.substring(7), JWT_SECRET); }
        catch { return res.status(401).json({ error: 'Плохой токен' }); }

        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Короткий пароль' });

        bcrypt.hash(newPassword, 10).then(h => {
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(h, d.id);
            res.json({ success: true, message: 'Пароль изменён' });
        });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка' }); }
});

router.get('/me', (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
        let d;
        try { d = jwt.verify(auth.substring(7), JWT_SECRET); }
        catch { return res.status(401).json({ error: 'Плохой токен' }); }

        const u = db.prepare('SELECT username, role, license_key, approved, created_at FROM users WHERE id = ?').get(d.id);
        if (!u) return res.status(404).json({ error: 'Не найден' });

        res.json({ success: true, user: {
            username: u.username, role: u.role, licenseKey: u.license_key,
            approved: u.approved === 1, createdAt: u.created_at,
        }});
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;