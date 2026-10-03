const express = require('express');
const db = require('../db');

const router = express.Router();

// Публичная проверка ключа (без токена)
router.post('/check', (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ valid: false, error: 'Нет ключа' });

        const user = db.prepare('SELECT username, role, approved FROM users WHERE license_key = ?').get(key);
        if (!user) return res.json({ valid: false, error: 'Ключ не найден' });
        if (!user.approved) return res.json({ valid: false, error: 'Не одобрен' });

        res.json({ valid: true, username: user.username, role: user.role });
    } catch (e) { console.error(e); res.status(500).json({ valid: false, error: 'Ошибка' }); }
});

module.exports = router;