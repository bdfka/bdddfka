const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

module.exports = {
    getUser: async (username) => {
        const r = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return r.rows[0] || null;
    },
    getUserById: async (id) => {
        const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return r.rows[0] || null;
    },
    getUserByKey: async (key) => {
        const r = await pool.query('SELECT * FROM users WHERE license_key = $1', [key]);
        return r.rows[0] || null;
    },
    getAllUsers: async () => {
        const r = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return r.rows;
    },
    countUsers: async () => {
        const r = await pool.query('SELECT COUNT(*) as c FROM users');
        return parseInt(r.rows[0].c);
    },
    createUser: async (user) => {
        const r = await pool.query(`
            INSERT INTO users (username, password_hash, license_key, role, approved)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [user.username, user.password_hash, user.license_key, user.role, user.approved]);
        return r.rows[0];
    },
    updateUser: async (id, patch) => {
        const keys = Object.keys(patch);
        const values = Object.values(patch);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const r = await pool.query(
            `UPDATE users SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
            [...values, id]);
        return r.rows[0];
    },
    deleteUser: async (id) => {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
    },
    addLog: async (username, action, ip) => {
        await pool.query(
            'INSERT INTO login_logs (username, action, ip) VALUES ($1, $2, $3)',
            [username, action, ip]);
    },
    getLogs: async () => {
        const r = await pool.query('SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 200');
        return r.rows;
    },
};
