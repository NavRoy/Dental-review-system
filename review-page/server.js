// =============================================
// REVIEW PAGE SERVER
// This is the lightweight server that serves /r/:slug
// Deploy this on your main domain (e.g. yoursite.com)
// =============================================
const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for ALL routes — slug is read by the frontend JS
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Review page running on port ${PORT}`));