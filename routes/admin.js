const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_LONG_RANDOM';

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
    try {
        const d = jwt.verify(auth.substring(7), JWT_SECRET);
        if (d.role !== 'admin') return res.status(403).json({ error: 'Не админ' });
        req.user = d;
        next();
    } catch { return res.status(401).json({ error: 'Плохой токен' }); }
}

router.get('/users', requireAdmin, async (req, res) => {
    res.json({ success: true, users: await db.getAllUsers() });
});

router.post('/approve', requireAdmin, async (req, res) => {
    const { username, approved } = req.body;
    const u = await db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    await db.updateUser(u.id, { approved: approved ? 1 : 0 });
    res.json({ success: true });
});

router.post('/set-role', requireAdmin, async (req, res) => {
    const { username, role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Плохая роль' });
    const u = await db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    await db.updateUser(u.id, { role });
    res.json({ success: true });
});

router.post('/delete', requireAdmin, async (req, res) => {
    const { username } = req.body;
    if (username === req.user.username) return res.status(400).json({ error: 'Себя нельзя' });
    const u = await db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    await db.deleteUser(u.id);
    res.json({ success: true });
});

// --- News ---
router.get('/news', requireAdmin, async (req, res) => {
    res.json({ success: true, news: await db.getNews() });
});

router.post('/news', requireAdmin, async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Заполни все поля' });
    const n = await db.createNews(title, content, req.user.username);
    res.json({ success: true, news: n });
});

// --- Forum (delete) ---
router.delete('/forum/:id', requireAdmin, async (req, res) => {
    await db.deleteThread(req.params.id);
    res.json({ success: true });
});

module.exports = router;
