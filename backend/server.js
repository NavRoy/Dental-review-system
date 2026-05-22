require('dotenv').config();
console.log(process.env.DATABASE_URL);
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
origin:[
'https://dental-review-page.onrender.com',
'https://dental-admin-dashboard.onrender.com',
'http://localhost:4000',
'http://localhost:5500'
],
credentials:true
}));
// In production, set your frontend URL
app.use(express.json());

// Routes
app.use('/review', require('./routes/reviews'));   // Employee-facing
app.use('/admin', require('./routes/admin'));       // Admin dashboard
app.use('/auth', require('./routes/auth'));         // Login

// Health check
app.get('/', (req, res) => res.json({ status: 'Dental Review System running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));


process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});