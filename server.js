const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const licenseRoutes = require('./routes/license');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/license', licenseRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'AffitCrash Server', version: '1.0.0', time: new Date().toISOString() });
});

app.get('/ping', (req, res) => res.json({ pong: true }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
    console.log(`✅ AffitCrash Server на порту ${PORT}`);
});