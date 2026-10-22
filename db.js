const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

module.exports = {
    // --- Users ---
    getUser: async (u) => (await pool.query('SELECT * FROM users WHERE username = $1', [u])).rows[0] || null,
    getUserById: async (id) => (await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0] || null,
    getUserByKey: async (k) => (await pool.query('SELECT * FROM users WHERE license_key = $1', [k])).rows[0] || null,
    getAllUsers: async () => (await pool.query('SELECT * FROM users ORDER BY created_at DESC')).rows,
    countUsers: async () => parseInt((await pool.query('SELECT COUNT(*) as c FROM users')).rows[0].c),
    createUser: async (u) => (await pool.query(
        'INSERT INTO users (username, password_hash, license_key, role, approved) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [u.username, u.password_hash, u.license_key, u.role, u.approved]
    )).rows[0],
    updateUser: async (id, patch) => {
        const keys = Object.keys(patch);
        const values = Object.values(patch);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        return (await pool.query(`UPDATE users SET ${set} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])).rows[0];
    },
    deleteUser: async (id) => await pool.query('DELETE FROM users WHERE id = $1', [id]),
    addLog: async (u, a, ip) => await pool.query('INSERT INTO login_logs (username, action, ip) VALUES ($1, $2, $3)', [u, a, ip]),

    // --- Balance / Pro ---
    addBalance: async (id, amount) => (await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance', [amount, id])).rows[0].balance,
    setPro: async (id, isPro) => await pool.query('UPDATE users SET is_pro = $1 WHERE id = $2', [isPro, id]),
    claimProBonus: async (id) => {
        await pool.query('UPDATE users SET last_pro_bonus = NOW() WHERE id = $1', [id]);
        await pool.query('UPDATE users SET balance = balance + 100 WHERE id = $1', [id]);
    },

    // --- Shop ---
    getShopConfigs: async () => (await pool.query('SELECT id, name, description, price, author, pro_only FROM configs_shop ORDER BY created_at DESC')).rows,
    getShopConfig: async (name) => (await pool.query('SELECT * FROM configs_shop WHERE name = $1', [name])).rows[0],
    getUserConfigs: async (userId) => (await pool.query('SELECT config_name FROM user_configs WHERE user_id = $1', [userId])).rows.map(x => x.config_name),
    giveConfig: async (userId, name) => await pool.query('INSERT INTO user_configs (user_id, config_name) VALUES ($1, $2)', [userId, name]),

    // --- Promo ---
    getPromo: async (code) => (await pool.query('SELECT * FROM promocodes WHERE code = $1', [code])).rows[0],
    isPromoUsed: async (userId, code) => (await pool.query('SELECT 1 FROM promocodes_used WHERE user_id = $1 AND code = $2', [userId, code])).rowCount > 0,
    usePromo: async (userId, code, reward) => {
        await pool.query('INSERT INTO promocodes_used (user_id, code) VALUES ($1, $2)', [userId, code]);
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [reward, userId]);
    },

    // --- News ---
    getNews: async () => (await pool.query('SELECT * FROM news ORDER BY created_at DESC')).rows,
    createNews: async (title, content, author) => (await pool.query('INSERT INTO news (title, content, author) VALUES ($1, $2, $3) RETURNING *', [title, content, author])).rows[0],
    deleteNews: async (id) => await pool.query('DELETE FROM news WHERE id = $1', [id]),

    // --- Forum ---
    getThreads: async () => (await pool.query('SELECT * FROM forum_threads ORDER BY last_activity DESC')).rows,
    getThread: async (id) => (await pool.query('SELECT * FROM forum_threads WHERE id = $1', [id])).rows[0],
    createThread: async (title, author) => (await pool.query('INSERT INTO forum_threads (title, author) VALUES ($1, $2) RETURNING *', [title, author])).rows[0],
    getPosts: async (threadId) => (await pool.query('SELECT * FROM forum_posts WHERE thread_id = $1 ORDER BY created_at ASC', [threadId])).rows,
    createPost: async (threadId, author, content) => {
        const post = (await pool.query('INSERT INTO forum_posts (thread_id, author, content) VALUES ($1, $2, $3) RETURNING *', [threadId, author, content])).rows[0];
        await pool.query('UPDATE forum_threads SET last_activity = NOW() WHERE id = $1', [threadId]);
        return post;
    },
    deleteThread: async (id) => await pool.query('DELETE FROM forum_threads WHERE id = $1', [id]),
};
