// src/server.js - HTTP Server for Render
const http = require('http');
const path = require('path');

console.log('🌐 Starting HTTP server for Render...');

// Simple stats storage
let botStats = {
  status: 'starting',
  startTime: new Date(),
  uptime: 0,
  errors: [],
  botOnline: false
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`📡 ${req.method} ${req.url} from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
  
  // Update uptime
  botStats.uptime = Math.floor((Date.now() - botStats.startTime.getTime()) / 1000);
  
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'RedAlert Security Bot v2.0',
      version: '2.0.0',
      uptime: botStats.uptime,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      bot: {
        online: botStats.botOnline,
        status: botStats.status
      },
      monitoring: {
        aiAnalysis: process.env.OPENAI_API_KEY ? 'enabled' : 'disabled',
        emergencySystem: 'ready'
      }
    }));
  } else if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'RedAlert Security Bot',
      uptime: botStats.uptime,
      botStatus: botStats.status,
      botOnline: botStats.botOnline,
      errors: botStats.errors.slice(-5), // Last 5 errors
      timestamp: new Date().toISOString(),
      platform: {
        node: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    }));
  } else if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');
  } else if (req.url === '/favicon.ico') {
    res.writeHead(404);
    res.end();
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      service: 'RedAlert Security Bot',
      availableEndpoints: [
        'GET /health - Health check',
        'GET /stats - Bot statistics', 
        'GET /ping - Simple ping'
      ],
      timestamp: new Date().toISOString()
    }));
  }
});

// Start server
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📈 Stats: http://localhost:${port}/stats`);
  console.log(`🏓 Ping: http://localhost:${port}/ping`);
  
  botStats.status = 'server_ready';
});

// Keep-alive ping (for free tier)
setInterval(() => {
  console.log('🔄 Keep-alive ping...');
}, 14 * 60 * 1000); // Every 14 minutes

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  botStats.errors.push({
    type: 'uncaughtException',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  botStats.errors.push({
    type: 'unhandledRejection', 
    message: String(reason),
    timestamp: new Date().toISOString()
  });
});

// Update bot status function
global.updateBotStatus = (status, online = false) => {
  botStats.status = status;
  botStats.botOnline = online;
  console.log(`📱 Bot status updated: ${status} (online: ${online})`);
};

console.log('🤖 Starting RedAlert bot...');

// Start the main bot
try {
  require('./index.js');
} catch (error) {
  console.error('❌ Failed to start bot:', error.message);
  botStats.status = 'bot_failed';
  botStats.errors.push({
    type: 'startup_error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
}