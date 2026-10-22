const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_LONG_RANDOM';

function auth(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
    try {
        req.user = jwt.verify(h.substring(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Неверный токен' });
    }
}

// --- News ---
router.get('/news', async (req, res) => res.json({ success: true, news: await db.getNews() }));

// --- Me ---
router.get('/me', auth, async (req, res) => {
    const user = await db.getUserById(req.user.id);
    const configs = await db.getUserConfigs(req.user.id);
    res.json({ 
        success: true, 
        balance: user.balance || 0, 
        configs,
        is_pro: user.is_pro,
        last_pro_bonus: user.last_pro_bonus
    });
});

// --- Promo ---
router.post('/promo', auth, async (req, res) => {
    const { code } = req.body;
    const promo = await db.getPromo(code.toLowerCase());
    if (!promo) return res.status(404).json({ error: 'Не найден' });
    
    const used = await db.isPromoUsed(req.user.id, code.toLowerCase());
    if (used) return res.status(400).json({ error: 'Уже использован' });

    await db.usePromo(req.user.id, code.toLowerCase(), promo.reward);
    res.json({ success: true, message: `+${promo.reward} Аффитов!` });
});

// --- Shop ---
router.get('/shop', async (req, res) => res.json({ success: true, configs: await db.getShopConfigs() }));

router.post('/buy', auth, async (req, res) => {
    const { name } = req.body;
    const config = await db.getShopConfig(name);
    if (!config) return res.status(404).json({ error: 'Не найден' });

    const user = await db.getUserById(req.user.id);
    const owned = (await db.getUserConfigs(req.user.id)).includes(name);
    if (owned) return res.status(400).json({ error: 'Уже куплен' });

    if (config.pro_only && !user.is_pro) return res.status(403).json({ error: 'Только для Pro!' });
    if ((user.balance || 0) < config.price) return res.status(400).json({ error: 'Мало Аффитов' });

    await db.addBalance(req.user.id, -config.price);
    await db.giveConfig(req.user.id, name);
    await db.addBalance(req.user.id, 10); // Бонус

    res.json({ success: true, message: `Куплен ${name}. +10 Аффитов!` });
});

router.get('/config/:name', auth, async (req, res) => {
    const name = req.params.name;
    const owned = (await db.getUserConfigs(req.user.id)).includes(name);
    if (!owned) return res.status(403).json({ error: 'Не куплен' });

    const config = await db.getShopConfig(name);
    if (!config) return res.status(404).json({ error: 'Не найден' });

    res.json({ success: true, content: config.content });
});

// --- Pro ---
router.post('/buy-pro', auth, async (req, res) => {
    const user = await db.getUserById(req.user.id);
    if (user.is_pro) return res.status(400).json({ error: 'Уже есть Pro' });

    const PRO_PRICE = 500;
    if ((user.balance || 0) < PRO_PRICE) return res.status(400).json({ error: 'Мало Аффитов' });

    await db.addBalance(req.user.id, -PRO_PRICE);
    await db.setPro(req.user.id, true);
    res.json({ success: true, message: 'Добро пожаловать в Pro!' });
});

router.post('/pro-bonus', auth, async (req, res) => {
    const user = await db.getUserById(req.user.id);
    if (!user.is_pro) return res.status(403).json({ error: 'Нужна Pro' });

    if (user.last_pro_bonus) {
        const diff = new Date().getTime() - new Date(user.last_pro_bonus).getTime();
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return res.status(400).json({ error: 'Рано' });
        }
    }

    await db.claimProBonus(req.user.id);
    res.json({ success: true, message: '+100 Аффитов!' });
});

// --- Forum ---
router.get('/forum', async (req, res) => {
    try {
        const threads = await db.getThreads();
        res.json({ success: true, threads });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.get('/forum/:id', async (req, res) => {
    try {
        const thread = await db.getThread(req.params.id);
        const posts = await db.getPosts(req.params.id);
        if (!thread) return res.status(404).json({ error: 'Тема не найдена' });
        res.json({ success: true, thread, posts });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/forum', auth, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || title.length < 3) return res.status(400).json({ error: 'Название короткое' });
        const thread = await db.createThread(title, req.user.username);
        res.json({ success: true, thread });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

router.post('/forum/:id/reply', auth, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Пустое сообщение' });
        const post = await db.createPost(req.params.id, req.user.username, content);
        res.json({ success: true, post });
    } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
});

module.exports = router;
