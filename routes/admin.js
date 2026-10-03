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

router.get('/users', requireAdmin, (req, res) => {
    res.json({ success: true, users: db.getAllUsers() });
});

router.post('/approve', requireAdmin, (req, res) => {
    const { username, approved } = req.body;
    const u = db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    db.updateUser(u.id, { approved: approved ? 1 : 0 });
    db.addLog(req.user.username, `${approved ? 'approve' : 'revoke'}:${username}`, req.ip);
    res.json({ success: true });
});

router.post('/set-role', requireAdmin, (req, res) => {
    const { username, role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Плохая роль' });
    const u = db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    db.updateUser(u.id, { role });
    db.addLog(req.user.username, `setrole:${username}:${role}`, req.ip);
    res.json({ success: true });
});

router.post('/delete', requireAdmin, (req, res) => {
    const { username } = req.body;
    if (username === req.user.username) return res.status(400).json({ error: 'Себя нельзя' });
    const u = db.getUser(username);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    db.deleteUser(u.id);
    db.addLog(req.user.username, `delete:${username}`, req.ip);
    res.json({ success: true });
});

router.get('/logs', requireAdmin, (req, res) => {
    res.json({ success: true, logs: db.getLogs() });
});

router.get('/stats', requireAdmin, (req, res) => {
    const users = db.getAllUsers();
    const total = users.length;
    const approved = users.filter(u => u.approved).length;
    const admins = users.filter(u => u.role === 'admin').length;
    res.json({ success: true, stats: { total, approved, admins } });
});

module.exports = router;
