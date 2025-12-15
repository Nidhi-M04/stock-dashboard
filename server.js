const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// IMPORTANT: allow Netlify (different domain) to connect
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Supported stocks
const SUPPORTED_STOCKS = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'];

// In-memory accounts: email -> { password, firstName, lastName, subscriptions: [] }
const accounts = {};

// In-memory stock prices
let stockPrices = {};
SUPPORTED_STOCKS.forEach((ticker) => {
  stockPrices[ticker] = 100 + Math.random() * 1000;
});

// Logged-in users by socket.id
const users = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Register
  socket.on('register', (data, callback) => {
    try {
      const email = String(data.email || '').toLowerCase().trim();
      const password = String(data.password || '');
      const firstName = String(data.firstName || '').trim();
      const lastName = String(data.lastName || '').trim();

      if (!email || !password || !firstName || !lastName) {
        return callback?.({
          success: false,
          error: 'First name, last name, email and password are required.'
        });
      }

      if (accounts[email]) {
        return callback?.({
          success: false,
          error: 'Account already exists. Please login.'
        });
      }

      accounts[email] = { password, firstName, lastName, subscriptions: [] };

      console.log(`Registered new account: ${email}`);
      return callback?.({
        success: true,
        message: 'Registration successful. Please login.'
      });
    } catch (e) {
      console.error(e);
      return callback?.({ success: false, error: 'Registration failed.' });
    }
  });

  // Login
  socket.on('login', (data, callback) => {
    try {
      const email = String(data.email || '').toLowerCase().trim();
      const password = String(data.password || '');

      if (!email || !password) {
        return callback?.({
          success: false,
          error: 'Email and password are required.'
        });
      }

      const account = accounts[email];
      if (!account) {
        return callback?.({
          success: false,
          error: 'Account not found. Please create an account.'
        });
      }

      if (account.password !== password) {
        return callback?.({
          success: false,
          error: 'Invalid password.'
        });
      }

      const subs = Array.isArray(account.subscriptions) ? account.subscriptions : [];

      users[socket.id] = {
        email,
        firstName: account.firstName,
        lastName: account.lastName,
        subscriptions: new Set(subs)
      };

      console.log(`User logged in: ${email} (${socket.id})`);

      return callback?.({
        success: true,
        email,
        firstName: account.firstName,
        lastName: account.lastName,
        stocks: SUPPORTED_STOCKS,
        subscriptions: subs
      });
    } catch (e) {
      console.error(e);
      return callback?.({ success: false, error: 'Login failed.' });
    }
  });

  // Subscribe
  socket.on('subscribe', (ticker) => {
    const user = users[socket.id];
    if (!user) return;

    if (SUPPORTED_STOCKS.includes(ticker)) {
      user.subscriptions.add(ticker);

      const account = accounts[user.email];
      if (account) {
        account.subscriptions = Array.from(user.subscriptions);
      }

      socket.emit('subscribed', Array.from(user.subscriptions));
    }
  });

  // Unsubscribe
  socket.on('unsubscribe', (ticker) => {
    const user = users[socket.id];
    if (!user) return;

    user.subscriptions.delete(ticker);

    const account = accounts[user.email];
    if (account) {
      account.subscriptions = Array.from(user.subscriptions);
    }

    socket.emit('subscribed', Array.from(user.subscriptions));
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    console.log('Client disconnected:', socket.id);
  });
});

// Price update loop (every 1 second)
setInterval(() => {
  SUPPORTED_STOCKS.forEach((ticker) => {
    const change = (Math.random() - 0.5) * 5;
    stockPrices[ticker] = Math.max(1, stockPrices[ticker] + change);
  });

  const snapshot = {};
  SUPPORTED_STOCKS.forEach((ticker) => {
    snapshot[ticker] = stockPrices[ticker].toFixed(2);
  });

  io.emit('priceUpdate', snapshot);
}, 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
