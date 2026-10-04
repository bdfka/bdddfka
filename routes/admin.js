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
    try {
        const users = await db.getAllUsers();
        res.json({ success: true, users });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/approve', requireAdmin, async (req, res) => {
    try {
        const { username, approved } = req.body;
        const u = await db.getUser(username);
        if (!u) return res.status(404).json({ error: 'Не найден' });
        await db.updateUser(u.id, { approved: approved ? 1 : 0 });
        await db.addLog(req.user.username, `${approved ? 'approve' : 'revoke'}:${username}`, req.ip);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/set-role', requireAdmin, async (req, res) => {
    try {
        const { username, role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Плохая роль' });
        const u = await db.getUser(username);
        if (!u) return res.status(404).json({ error: 'Не найден' });
        await db.updateUser(u.id, { role });
        await db.addLog(req.user.username, `setrole:${username}:${role}`, req.ip);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/delete', requireAdmin, async (req, res) => {
    try {
        const { username } = req.body;
        if (username === req.user.username) return res.status(400).json({ error: 'Себя нельзя' });
        const u = await db.getUser(username);
        if (!u) return res.status(404).json({ error: 'Не найден' });
        await db.deleteUser(u.id);
        await db.addLog(req.user.username, `delete:${username}`, req.ip);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.get('/logs', requireAdmin, async (req, res) => {
    try {
        const logs = await db.getLogs();
        res.json({ success: true, logs });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const total = users.length;
        const approved = users.filter(u => u.approved).length;
        const admins = users.filter(u => u.role === 'admin').length;
        res.json({ success: true, stats: { total, approved, admins } });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;
