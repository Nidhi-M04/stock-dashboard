document.addEventListener('DOMContentLoaded', () => {
  const socket = io("https://stock-dashboard-sth3.onrender.com", {
  transports: ["websocket"]
});

  let isLoggedIn = false;
  let subscribedTickers = [];
  let latestPrices = {};
  let previousPrices = {};
  const priceHistory = {}; // ticker -> [{ time: Date, price: number }]
  let chart = null;

  // Sections
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const dashboardSection = document.getElementById('dashboard-section');

  // Login form
  const authForm = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const authMessage = document.getElementById('auth-message');

  // Captcha elements
  const captchaCanvas = document.getElementById('captcha-canvas');
  const captchaInputEl = document.getElementById('captcha-input');
  const refreshCaptchaBtn = document.getElementById('refresh-captcha');
  let currentCaptcha = '';

  // Register form
  const registerForm = document.getElementById('register-form');
  const regFirstName = document.getElementById('reg-firstname');
  const regLastName = document.getElementById('reg-lastname');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const registerMessage = document.getElementById('register-message');

  // Toggle links
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');

  // Dashboard elements
  const userInfo = document.getElementById('user-info');
  const subscriptionForm = document.getElementById('subscription-form');
  const stocksBody = document.getElementById('stocks-body');
  const lastUpdated = document.getElementById('last-updated');
  const socketStatus = document.getElementById('socket-status');
  const socketStatusText = document.getElementById('socket-status-text');

  // Chart elements
  const chartSection = document.getElementById('chart-section');
  const chartTickerSelect = document.getElementById('chart-ticker-select');

  // Alerts elements
  const alertsForm = document.getElementById('alerts-form');
  const alertsTickerSelect = document.getElementById('alerts-ticker');
  const alertsDirectionSelect = document.getElementById('alerts-direction');
  const alertsPriceInput = document.getElementById('alerts-price');
  const alertsListEl = document.getElementById('alerts-list');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  let allTickers = []; // from server on login
  let alerts = []; // { id, ticker, direction, price, active, triggered }
  let alertIdCounter = 1;

  function setStatus(connected) {
    if (connected) {
      socketStatus.classList.add('online');
      socketStatusText.textContent = 'Live';
    } else {
      socketStatus.classList.remove('online');
      socketStatusText.textContent = 'Disconnected';
    }
  }

  setStatus(false);

  // Connection status
  socket.on('connect', () => setStatus(true));
  socket.on('disconnect', () => setStatus(false));

  function setAuthMessage(msg, type) {
    authMessage.textContent = msg || '';
    authMessage.className = 'auth-message';
    if (type === 'error') authMessage.classList.add('error');
    if (type === 'success') authMessage.classList.add('success');
  }

  function setRegisterMessage(msg, type) {
    registerMessage.textContent = msg || '';
    registerMessage.className = 'auth-message';
    if (type === 'error') registerMessage.classList.add('error');
    if (type === 'success') registerMessage.classList.add('success');
  }

  function randomColor(alpha = 1) {
    const r = 100 + Math.floor(Math.random() * 155);
    const g = 100 + Math.floor(Math.random() * 155);
    const b = 100 + Math.floor(Math.random() * 155);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function showToast(message, type = 'success') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = type === 'success' ? 'Price Alert Hit' : 'Notification';

    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = 'Dismiss';
    closeBtn.addEventListener('click', () => {
      hideToast(toast);
    });

    toast.appendChild(title);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);

    toastContainer.appendChild(toast);

    // Auto-hide after 4 seconds
    setTimeout(() => hideToast(toast), 4000);
  }

  function hideToast(toast) {
    if (!toast) return;
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }

  function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let value = '';
    for (let i = 0; i < 5; i++) {
      value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = value;

    if (!captchaCanvas) return;

    const ctx = captchaCanvas.getContext('2d');
    const width = captchaCanvas.width;
    const height = captchaCanvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Random noise lines
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = randomColor();
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // Draw characters with random rotation/position
    const charSpacing = width / (value.length + 1);
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];

      const fontSize = 24 + Math.random() * 6;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = randomColor();

      const x = charSpacing * (i + 1);
      const y = height / 2 + (Math.random() * 10 - 5);

      const angle = (Math.random() - 0.5) * 0.7; // rotation between -0.35 and +0.35 rad

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(ch, -fontSize / 3, fontSize / 3);
      ctx.restore();
    }

    // Extra noise dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = randomColor(0.7);
      ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    // Reset input
    if (captchaInputEl) {
      captchaInputEl.value = '';
    }
  }

  if (refreshCaptchaBtn) {
    refreshCaptchaBtn.addEventListener('click', () => {
      generateCaptcha();
    });
  }

  // initial captcha on page load
  generateCaptcha();

  // Toggle to register
  showRegisterBtn.addEventListener('click', () => {
    loginSection.classList.add('hidden');
    registerSection.classList.remove('hidden');
    setAuthMessage('', '');
  });

  // Toggle to login
  showLoginBtn.addEventListener('click', () => {
    registerSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    setRegisterMessage('', '');
    generateCaptcha();
  });

  // Register submit
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const firstName = regFirstName.value.trim();
    const lastName = regLastName.value.trim();
    const email = regEmail.value.trim();
    const password = regPassword.value;

    if (!firstName || !lastName || !email || !password) {
      setRegisterMessage('Please fill all fields.', 'error');
      return;
    }

    socket.emit(
      'register',
      { firstName, lastName, email, password },
      (response) => {
        if (response && response.success) {
          setRegisterMessage(
            response.message || 'Registration successful. Please login.',
            'success'
          );
        } else {
          setRegisterMessage(response?.error || 'Registration failed.', 'error');
        }
      }
    );
  });

  // Login submit (with captcha)
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const captchaValue = captchaInputEl ? captchaInputEl.value.trim() : '';

    if (!email || !password) {
      setAuthMessage('Please enter email and password.', 'error');
      return;
    }

    if (!captchaValue) {
      setAuthMessage('Please enter the captcha.', 'error');
      return;
    }

    if (captchaValue.toUpperCase() !== currentCaptcha) {
      setAuthMessage('Captcha does not match. Please try again.', 'error');
      generateCaptcha();
      return;
    }

    socket.emit('login', { email, password }, (response) => {
      if (response && response.success) {
        isLoggedIn = true;
        setAuthMessage('', '');
        loginSection.classList.add('hidden');
        registerSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');

        // show only name
        userInfo.textContent = `${response.firstName} ${response.lastName}`;

        // store all tickers list from server (for alerts dropdown)
        if (Array.isArray(response.stocks)) {
          allTickers = response.stocks;
        }

        // restore subscriptions from server
        subscribedTickers = Array.isArray(response.subscriptions)
          ? response.subscriptions
          : [];
        syncSubscriptionCheckboxes();
        renderTable();
        updateChartTickerOptions();

        populateAlertsTickerOptions();
        initChart();
      } else {
        setAuthMessage(response?.error || 'Login failed.', 'error');
        generateCaptcha();
      }
    });
  });

  // Handle subscription changes
  subscriptionForm.addEventListener('change', (e) => {
    if (!isLoggedIn) {
      e.target.checked = false;
      alert('Please login first.');
      return;
    }

    if (e.target && e.target.type === 'checkbox') {
      const ticker = e.target.value;
      if (e.target.checked) {
        socket.emit('subscribe', ticker);
      } else {
        socket.emit('unsubscribe', ticker);
      }
    }
  });

  // Update subscription list from server
  socket.on('subscribed', (list) => {
    subscribedTickers = list;
    syncSubscriptionCheckboxes();
    renderTable();
    updateChartTickerOptions();
    if (!allTickers || !allTickers.length) {
      populateAlertsTickerOptions();
    }
  });

  // Receive price updates from server
  socket.on('priceUpdate', (prices) => {
    previousPrices = { ...latestPrices };
    latestPrices = prices;
    updateTimestamp();
    updateHistory(prices);
    renderTable();
    updateChart();
    checkAlerts(prices);
  });

  function syncSubscriptionCheckboxes() {
    const checkboxes = subscriptionForm.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.checked = subscribedTickers.includes(cb.value);
    });
  }

  function updateTimestamp() {
    const now = new Date();
    lastUpdated.textContent = 'Last updated: ' + now.toLocaleTimeString();
  }

  function renderTable() {
    stocksBody.innerHTML = '';

    if (!subscribedTickers.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty-state';
      td.textContent =
        'Select one or more stocks on the left to start streaming prices.';
      tr.appendChild(td);
      stocksBody.appendChild(tr);
      chartSection.classList.add('hidden');
      return;
    }

    chartSection.classList.remove('hidden');

    subscribedTickers.forEach((ticker) => {
      const tr = document.createElement('tr');

      const price = latestPrices[ticker];
      const prev = previousPrices[ticker];
      let change = '';

      if (price && prev) {
        const diff = (parseFloat(price) - parseFloat(prev)).toFixed(2);
        const sign = diff > 0 ? '+' : '';
        change = sign + diff;
      }

      tr.innerHTML = `
        <td>${ticker}</td>
        <td>${price ? '$' + price : '--'}</td>
        <td class="${
          change.startsWith('+') ? 'pos' : change.startsWith('-') ? 'neg' : ''
        }">
          ${change || '--'}
        </td>
      `;

      stocksBody.appendChild(tr);
    });
  }

  // ----- CHART / HISTORY LOGIC -----

  function initChart() {
    if (chart) return; // only once

    const ctx = document.getElementById('price-chart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: '',
            data: [],
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            ticks: { autoSkip: true, maxTicksLimit: 8 }
          },
          y: {
            beginAtZero: false
          }
        }
      }
    });

    chartTickerSelect.addEventListener('change', updateChart);
  }

  function updateHistory(prices) {
    const now = new Date();

    Object.keys(prices).forEach((ticker) => {
      const price = parseFloat(prices[ticker]);
      if (!priceHistory[ticker]) {
        priceHistory[ticker] = [];
      }
      priceHistory[ticker].push({ time: now, price });

      // keep last 60 points
      if (priceHistory[ticker].length > 60) {
        priceHistory[ticker].shift();
      }
    });
  }

  function updateChartTickerOptions() {
    chartTickerSelect.innerHTML = '';

    if (!subscribedTickers.length) {
      chartSection.classList.add('hidden');
      return;
    }

    chartSection.classList.remove('hidden');

    subscribedTickers.forEach((ticker) => {
      const opt = document.createElement('option');
      opt.value = ticker;
      opt.textContent = ticker;
      chartTickerSelect.appendChild(opt);
    });

    updateChart();
  }

  function updateChart() {
    if (!chart || !subscribedTickers.length) return;

    let selectedTicker = chartTickerSelect.value;
    if (!selectedTicker || !subscribedTickers.includes(selectedTicker)) {
      selectedTicker = subscribedTickers[0];
      chartTickerSelect.value = selectedTicker;
    }

    const history = priceHistory[selectedTicker] || [];
    const labels = history.map((p) => p.time.toLocaleTimeString());
    const data = history.map((p) => p.price);

    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].label = selectedTicker;
    chart.update();
  }

  // ----- PRICE ALERTS LOGIC -----

  function populateAlertsTickerOptions() {
    if (!alertsTickerSelect) return;

    alertsTickerSelect.innerHTML = '';

    const source = allTickers && allTickers.length ? allTickers : subscribedTickers;

    if (!source || !source.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No tickers';
      alertsTickerSelect.appendChild(opt);
      return;
    }

    source.forEach((ticker) => {
      const opt = document.createElement('option');
      opt.value = ticker;
      opt.textContent = ticker;
      alertsTickerSelect.appendChild(opt);
    });
  }

  if (alertsForm) {
    alertsForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const ticker = alertsTickerSelect.value;
      const direction = alertsDirectionSelect.value; // 'above' or 'below'
      const priceStr = alertsPriceInput.value;
      const price = parseFloat(priceStr);

      if (!ticker) {
        alert('Please select a ticker.');
        return;
      }
      if (!priceStr || isNaN(price) || price <= 0) {
        alert('Please enter a valid price.');
        return;
      }

      const alertObj = {
        id: alertIdCounter++,
        ticker,
        direction,
        price,
        active: true,
        triggered: false
      };

      alerts.push(alertObj);
      renderAlerts();
      alertsPriceInput.value = '';
    });
  }

  function renderAlerts() {
    if (!alertsListEl) return;

    alertsListEl.innerHTML = '';

    if (!alerts.length) {
      const li = document.createElement('li');
      li.className = 'alerts-empty';
      li.textContent = 'No alerts yet. Create one above.';
      alertsListEl.appendChild(li);
      return;
    }

    alerts.forEach((a) => {
      const li = document.createElement('li');
      li.className = 'alert-item';

      const desc = document.createElement('span');
      desc.textContent = `${a.ticker} ${a.direction.toUpperCase()} ${a.price.toFixed(
        2
      )}`;

      const status = document.createElement('span');
      status.className = 'alert-pill ' + (a.triggered ? 'triggered' : 'active');
      status.textContent = a.triggered ? 'Triggered' : 'Active';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'alert-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        alerts = alerts.filter((al) => al.id !== a.id);
        renderAlerts();
      });

      li.appendChild(desc);
      li.appendChild(status);
      li.appendChild(removeBtn);

      alertsListEl.appendChild(li);
    });
  }

  function checkAlerts(prices) {
    alerts.forEach((a) => {
      if (!a.active || a.triggered) return;

      const current = parseFloat(prices[a.ticker]);
      if (!current || isNaN(current)) return;

      if (a.direction === 'above' && current >= a.price) {
        a.triggered = true;
        a.active = false;
        showToast(
          `${a.ticker} is ABOVE ${a.price.toFixed(
            2
          )} (current: ${current.toFixed(2)})`,
          'success'
        );
      } else if (a.direction === 'below' && current <= a.price) {
        a.triggered = true;
        a.active = false;
        showToast(
          `${a.ticker} is BELOW ${a.price.toFixed(
            2
          )} (current: ${current.toFixed(2)})`,
          'success'
        );
      }
    });

    renderAlerts();
  }
});
