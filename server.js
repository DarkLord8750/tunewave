import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all API handlers
import streamHandler from './api/stream.js';
import proxyHandler from './api/proxy.js';
import searchHandler from './api/search.js';
import relatedHandler from './api/related.js';
import trendingHandler from './api/trending.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS if needed (Render will put it behind their load balancer, but good to have)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  next();
});

// Middleware to polyfill Vercel-style res.status().json() if handlers expect it
app.use((req, res, next) => {
  const originalStatus = res.status.bind(res);
  res.status = (code) => {
    originalStatus(code);
    return res;
  };
  next();
});

// API Routes
app.get('/api/stream', (req, res) => streamHandler(req, res));
app.get('/api/proxy', (req, res) => proxyHandler(req, res));
app.get('/api/search', (req, res) => searchHandler(req, res));
app.get('/api/related', (req, res) => relatedHandler(req, res));
app.get('/api/trending', (req, res) => trendingHandler(req, res));

// Serve static files from the React build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For any other route, serve the React app (Client-Side Routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
});
