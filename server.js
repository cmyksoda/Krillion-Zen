const fs = require("fs");
const express = require('express');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./users.db');

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, data TEXT)");
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/local-api/login', (req, res) => {
  const { username, data } = req.body;
  if (!username) return res.status(400).json({ error: "Missing username" });

  db.get("SELECT data, username as storedUsername FROM users WHERE LOWER(username) = LOWER(?)", [username], (err, row) => {
    if (err) return res.status(500).json({ error: "DB Error" });
    
    if (row) {
      // User exists, return their data
      res.json({ data: JSON.parse(row.data), casedUsername: row.storedUsername });
    } else {
      // New user, save their current local storage data
      db.run("INSERT INTO users (username, data) VALUES (?, ?)", [username, JSON.stringify(data || {})], (err) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ data: data || {}, casedUsername: username });
      });
    }
  });
});

app.post("/local-api/sync", (req, res) => {
  const { username, data } = req.body;
  if (!username) return res.status(400).json({ error: "Missing username" });
  db.run("UPDATE users SET data = ? WHERE LOWER(username) = LOWER(?)", [JSON.stringify(data || {}), username], (err) => {
    if (err) return res.status(500).json({ error: "DB Error" });
    res.json({ success: true });
  });
});

app.use(["/packs", "/unlimited", "/movies", "/sports", "/geography", "/lexicon"], (req, res) => {
  res.redirect("/");
});

// Simple proxy for /api
app.use('/api', (req, res) => {
  if (req.originalUrl.includes('/announcements')) {
    return res.json([]);
  }

  const options = {
    hostname: 'krillion.io',
    port: 443,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'krillion.io',
      origin: 'https://krillion.io',
      referer: 'https://krillion.io/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  };

  // Remove headers that might cause issues
  delete options.headers['accept-encoding'];
  delete options.headers['connection'];

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    res.set(proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error(e);
    res.status(500).send('Proxy error');
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
    } else {
        req.pipe(proxyReq);
        return;
    }
    proxyReq.end();
  } else {
    proxyReq.end();
  }
});


app.get('/leaderboard', (req, res) => {
  let accountHtml = fs.readFileSync(path.join(__dirname, 'krillion-mirror/krillion.io/account.html'), 'utf8');
  
  db.all("SELECT username, data FROM users", [], (err, rows) => {
    if (err) return res.status(500).send("DB Error");
    
    let allUsers = [];
    let maxDay = 0;
    let maxDateStr = null;
    
    rows.forEach(row => {
      if (row.data) {
        try {
          const parsed = JSON.parse(row.data);
          const statsStr = parsed['krillion:stats:v1'];
          if (!statsStr) return;
          const stats = JSON.parse(statsStr);
          let history = stats.history || {};
          let bestScore = 0;
          let bestDay = null;
          let bestDate = null;
          
          for (const date in history) {
            let dayData = history[date];
            if (dayData.dayNumber > maxDay) { maxDay = dayData.dayNumber; maxDateStr = date; }
            if (dayData.score > bestScore) {
              bestScore = dayData.score;
              bestDay = dayData;
              bestDate = date;
            }
          }
          
          if (bestDay) {
            bestDay.dateStr = bestDate;
          }

          allUsers.push({
            username: row.username,
            bestScore,
            bestDay,
            history
          });
        } catch(e) {}
      }
    });
    
    allUsers.forEach(u => {
      u.todayDay = maxDateStr ? (u.history[maxDateStr] || null) : null;
      if (u.todayDay) u.todayDay.dateStr = maxDateStr;
      u.todayScore = u.todayDay ? u.todayDay.score : 0;
    });

    let staticHtml = accountHtml.replace(/\\"account\\"/g, '\\"leaderboard\\"');

    staticHtml = staticHtml.replace('</head>', `<style>
      main.AccountPage-module__SGy9WG__page:not(#custom-leaderboard) { display: none !important; }
      #custom-leaderboard { position: relative; z-index: 1; }
      .lb-tabs {
        display: flex;
        justify-content: center;
        gap: 20px;
        border-bottom: 1px solid var(--hairline);
        margin: 0 0 36px;
      }
    </style></head>`);

    staticHtml = staticHtml.replace('<a href="/account" aria-current="page">', '<a href="/account">');
    staticHtml = staticHtml.replace('<title>My Krillion</title>', '<title>Leaderboard</title>');

    const customUI = `
      <main id="custom-leaderboard" class="AccountPage-module__SGy9WG__page">
      <a class="AccountPage-module__SGy9WG__brand" href="/">KRILLION</a>
      <header class="AccountPage-module__SGy9WG__header">
        <p class="AccountPage-module__SGy9WG__eyebrow">DIVER RANKINGS</p>
        <h1>Leaderboard</h1>
        <p>Today's dive and all-time bests.</p>
      </header>

      <div class="lb-tabs">
        <button id="tab-today" class="tab-btn active" type="button">TODAY'S DIVE</button>
        <button id="tab-best" class="tab-btn" type="button">ALL-TIME BEST</button>
      </div>
      
      <div id="leaderboard-container"></div>
      </main>

      <script>
      const usersData = ${JSON.stringify(allUsers)};
      const months = ['jan.', 'feb.', 'mar.', 'apr.', 'may.', 'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.'];
      
      function renderTierTag(tier, score) {
        let colorVar = 'var(--color-tier-' + tier + ')';
        return '<span class="tier-tag" style="color: ' + colorVar + ';">' +
                 '<img src="/tiers/' + tier + '.png" style="filter: drop-shadow(0 0 2px ' + colorVar + ');">' +
                 score + ' pts &middot; ' + tier + 
               '</span>';
      }

      function renderList(mode) {
        const container = document.getElementById('leaderboard-container');
        
        let currentUser = localStorage.getItem("local_username");
        let hasPlayedToday = false;
        if (currentUser) {
           let currentUserData = usersData.find(u => u.username.toLowerCase() === currentUser.toLowerCase());
           if (currentUserData && currentUserData.todayDay) {
              hasPlayedToday = true;
           }
        }
        
        if (!hasPlayedToday) {
           container.innerHTML = '<div style="text-align: center; margin-top: 80px; margin-bottom: 80px; font-size: 24px; color: var(--color-foam); letter-spacing: 0.05em; text-transform: uppercase;">You have to do today&rsquo;s dive first!</div>';
           return;
        }

        let sorted = [...usersData];
        if (mode === 'today') {
          sorted = sorted.filter(u => u.todayDay).sort((a, b) => b.todayScore - a.todayScore);
        } else {
          sorted = sorted.filter(u => u.bestDay).sort((a, b) => b.bestScore - a.bestScore);
        }
        
        let html = '';
        sorted.forEach((user, index) => {
          let day = mode === 'today' ? user.todayDay : user.bestDay;
          let score = mode === 'today' ? user.todayScore : user.bestScore;
          
          let answersHtml = '';
          if (day && day.results) {
            day.results.forEach((res, i) => {
              let borderStyle = (i === day.results.length - 1) ? 'none' : '1px solid var(--hairline)';
              answersHtml += '<div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: ' + borderStyle + ';">' +
                '<div style="font-size: 14px; color: var(--color-drift); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.1em;">' + res.promptText + '</div>' +
                '<div style="font-size: 18px; color: var(--color-foam); margin-bottom: 5px;">' + res.answer + '</div>' +
                renderTierTag(res.tier, res.score) +
              '</div>';
            });
          }

          let dateSuffix = '';
          if (mode === 'best' && day && day.dateStr) {
             let parts = day.dateStr.split('-');
             if (parts.length === 3) {
                let m = parseInt(parts[1], 10) - 1;
                let d = parseInt(parts[2], 10);
                let y = parts[0];
                dateSuffix = ' &middot; ' + months[m] + ' ' + d + ', ' + y;
             }
          }

          
          function getOverallTier(s) {
            if (s >= 450) return 'krillion';
            if (s >= 351) return 'deepcut';
            if (s >= 251) return 'rare';
            if (s >= 151) return 'schooler';
            return 'plankton';
          }
          let overallTier = getOverallTier(score);
          let overallColorVar = 'var(--color-tier-' + overallTier + ')';
          let overallIconHtml = '<img src="/tiers/' + overallTier + '.png" style="width: 22px; height: 22px; filter: drop-shadow(0 0 2px ' + overallColorVar + '); margin-right: 6px; vertical-align: bottom;">';

          html += '<div style="background: var(--color-shallow); border: 1px solid var(--hairline); border-radius: 0px; padding: 20px; margin-bottom: 20px;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
              '<div style="color: var(--color-foam); font-size: 22px; text-transform: uppercase; letter-spacing: 0.05em;">#' + (index + 1) + ' ' + user.username + '</div>' +
              '<div style="color: ' + overallColorVar + '; text-shadow: 0 0 8px ' + overallColorVar + '; font-size: 22px;">' + overallIconHtml + score + ' PTS</div>' +
            '</div>' +

            '<div>' +
              '<h4 style="margin-bottom:15px; color:var(--color-drift); font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">' + (mode === 'today' ? "Today\'s Dive" : "Best Dive") + dateSuffix + '</h4>' +
              answersHtml +
            '</div>' +
          '</div>';
        });
        
        container.innerHTML = html;
      }

      window.switchTab = function(mode) {
        document.getElementById('tab-today').className = 'tab-btn ' + (mode === 'today' ? 'active' : '');
        document.getElementById('tab-best').className = 'tab-btn ' + (mode === 'best' ? 'active' : '');
        renderList(mode);
      }
      document.getElementById('tab-today').onclick = function() { switchTab('today'); };
      document.getElementById('tab-best').onclick = function() { switchTab('best'); };
      window.__lbMode = 'today';
      var _switchTab = window.switchTab;
      window.switchTab = function(mode) { window.__lbMode = mode; _switchTab(mode); };

      var navObserver = new MutationObserver(() => {
        const accountLink = document.querySelector('nav a[href="/account"]');
        if (accountLink) accountLink.removeAttribute('aria-current');
        const boardLink = document.querySelector('nav a[href="/leaderboard"]');
        if (boardLink) boardLink.setAttribute('aria-current', 'page');
      });
      navObserver.observe(document.body, { childList: true, subtree: true });

      renderList('today');

      (function persistLeaderboard() {
        var shell = document.getElementById('custom-leaderboard');
        if (!shell) return;
        var html = shell.outerHTML;
        function restore() {
          document.querySelectorAll('main.AccountPage-module__SGy9WG__page:not(#custom-leaderboard)').forEach(function(m) {
            m.style.setProperty('display', 'none', 'important');
          });
          if (!document.getElementById('custom-leaderboard')) {
            document.body.insertAdjacentHTML('beforeend', html);
            var t = document.getElementById('tab-today');
            var b = document.getElementById('tab-best');
            if (t) t.onclick = function() { switchTab('today'); };
            if (b) b.onclick = function() { switchTab('best'); };
            if (window.switchTab) switchTab(window.__lbMode || 'today');
          }
        }
        new MutationObserver(restore).observe(document.documentElement, { childList: true, subtree: true });
      })();
      </script>
    `;

    staticHtml = staticHtml.replace('</body>', customUI + '</body>');

    
    const styles = `
      <style>
        .tab-btn {
          background: none;
          border: none;
          font-family: var(--font-mono-ui), ui-monospace, monospace;
          font-size: 14px;
          letter-spacing: 0.1em;
          cursor: pointer;
          padding: 12px 24px;
          text-align: center;
          touch-action: manipulation;
        }
        .tab-btn.active {
          color: var(--color-foam);
          border-bottom: 2px solid var(--color-lumen-cyan);
        }
        .tab-btn:not(.active) {
          color: var(--color-drift);
          border-bottom: 2px solid transparent;
        }
        @media (hover: hover) {
          .tab-btn:hover:not(.active) {
            color: var(--color-lumen-cyan);
          }
        }
        .tier-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono-ui), monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 2px 6px;
          border-radius: 4px;
          background: #02050b;
          border: 1px solid #1b3050;
        }
        .tier-tag img {
          width: 12px;
          height: 12px;
        }
      </style>
    `;
    staticHtml = staticHtml.replace('</head>', styles + '</head>');

    res.send(staticHtml);
  });
});

// Strip query strings from URLs to match local files
app.use((req, res, next) => {
  if (req.url.includes('%3F')) req.url = req.url.split('%3F')[0];
  if (req.url.includes('?')) req.url = req.url.split('?')[0];
  next();
});

// Serve the modified static files
app.use(express.static(path.join(__dirname, 'krillion-mirror/krillion.io'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`Krillion (No Timer) is running at http://localhost:${PORT}`);
});
