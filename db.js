const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_FILE = path.join(dataDir, 'affitcrash.json');

let data = { users: [], logs: [], nextId: 1 };

function load() {
    if (fs.existsSync(DB_FILE)) {
        try {
            data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            if (!data.users) data.users = [];
            if (!data.logs) data.logs = [];
            if (!data.nextId) data.nextId = 1;
        } catch (e) { console.error('DB load error:', e); }
    }
}

function save() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('DB save error:', e); }
}

load();

module.exports = {
    // === USERS ===
    getUser: (username) => data.users.find(u => u.username === username) || null,
    getUserById: (id) => data.users.find(u => u.id === id) || null,
    getUserByKey: (key) => data.users.find(u => u.license_key === key) || null,
    getAllUsers: () => data.users,
    countUsers: () => data.users.length,

    createUser: (user) => {
        user.id = data.nextId++;
        user.created_at = new Date().toISOString();
        user.last_login = null;
        data.users.push(user);
        save();
        return user;
    },

    updateUser: (id, patch) => {
        const u = data.users.find(x => x.id === id);
        if (u) { Object.assign(u, patch); save(); }
        return u;
    },

    deleteUser: (id) => {
        const i = data.users.findIndex(x => x.id === id);
        if (i >= 0) { data.users.splice(i, 1); save(); }
    },

    // === LOGS ===
    addLog: (username, action, ip) => {
        data.logs.unshift({
            username, action, ip,
            timestamp: new Date().toISOString(),
        });
        if (data.logs.length > 500) data.logs.length = 500;
        save();
    },
    getLogs: () => data.logs.slice(0, 200),
};
