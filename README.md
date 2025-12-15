# BrokerView – Real-Time Stock Dashboard

BrokerView is a real-time stock broker client web dashboard that allows users to register, log in securely, subscribe to stocks, and view live stock price updates without refreshing the page.

**Live Website:** https://brokerview-stock.netlify.app
**GitHub Repository:** https://github.com/Nidhi-M04/stock-dashboard  

## Project Overview
- Frontend built using HTML, CSS, JavaScript, and Chart.js
- Backend implemented in `server.js` using Node.js, Express, and Socket.IO
- `server.js` generates random stock prices every second and broadcasts updates to connected clients using WebSockets
- Multiple users are supported concurrently with independent stock subscriptions

## Features
- User registration and login with CAPTCHA
- Subscribe to stocks (GOOG, TSLA, AMZN, META, NVDA)
- Real-time stock price updates without page refresh
- Live price history charts
- Price alerts with notifications

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express (`server.js`)
- Real-time Communication: Socket.IO
- Deployment: Netlify (frontend), Render (backend)

## Note
Stock prices are randomly generated for demonstration purposes only.



