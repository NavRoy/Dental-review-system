// =============================================
// REVIEW PAGE SERVER
// This is the lightweight server that serves /r/:slug
// Deploy this on your main domain (e.g. yoursite.com)
// =============================================
const express = require('express');
const path    = require('path');
const app     = express();

// Serve static assets (css, js, fonts etc) but NOT index.html directly
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ALL routes serve index.html — slug is read by frontend JS
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Review page running on port ${PORT}`));