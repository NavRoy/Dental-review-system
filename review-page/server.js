// =============================================
// REVIEW PAGE SERVER
// This is the lightweight server that serves /r/:slug
// Deploy this on your main domain (e.g. yoursite.com)
// =============================================
const express = require('express');
const path = require('path');

const app = express();

// Serve static files (index.html, any CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Route /r/:slug → serve index.html (JS handles the slug extraction)
app.get('/r/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all
app.get('/*path', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Review page server running on http://localhost:${PORT}`));
