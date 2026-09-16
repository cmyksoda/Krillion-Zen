const unwantedTexts = [
  'Sign in with Google',
  'playing as a guest',
  'connect to Google',
  'Keep your dives together',
  'Your purchases come with you',
  'AT THE MOVIES',
  'SPORTS',
  'GEOGRAPHY',
  'Words & Language',
  'THE ENDLESS DIVE',
  'NO ADS'
];

const observer = new MutationObserver(() => {
  // 1. Ensure our global CSS hacks are always present
  if (!document.getElementById('krillion-hacks')) {
    const style = document.createElement('style');
    style.id = 'krillion-hacks';
    style.textContent = `
      a[href$="unlimited"], a[href$="archive"], a[href$="packs"], a[href$="friends"], a[href^="https://shop.krillion.io"], a[href$="unlimited/classic"], a[href$="faq"], a[href$="privacy"] { display: none !important; }
      button[aria-label="Share via apps"] { display: none !important; }
      .kr-ad-results, .kr-ad-privacy, .kr-ad-placeholder, .kr-ad-placement,
      aside[aria-label="Results advertisement"], aside[aria-label="Advertisement"] { display: none !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; }
      
      .ds-time-wrap, .ds-sonar-wrap, .ds-time-digits, .ds-fuse { display: none !important; }
      .ds-mascot { display: block !important; visibility: visible !important; opacity: 1 !important; }
      
      /* Symmetry & Centering Fixes */
      .ds-dive-btn, #krillion-skip-btn { width: 86px !important; text-align: center !important; flex: none !important; }
      .ds-preview-pill { text-align: center !important; }
      #local-username { width: 100%; max-width: 320px; margin: 0 auto; }
      #local-username input, #local-username button { border-radius: 0 !important; width: 100%; }
    `;
    document.head.appendChild(style);

    const style2 = document.createElement('style');
    style2.id = 'krillion-hacks-has';
    style2.textContent = `
      /* Hide Bug/Support Footer (isolated so :has doesn't break older Safari) */
      p:has(a[href="mailto:support@krillion.io"]) { display: none !important; }
      form:has(#suggest-question) { display: none !important; }
      /* Hide Friends Section on Account page */
      section[aria-label="Friends"] { display: none !important; }
      /* Hide the entire Completed Dives section */
      section[aria-labelledby="history-title"] { display: none !important; }
    `;
    document.head.appendChild(style2);
  }

  // 2. Hide unwanted text nodes instantly
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walk.nextNode()) {
    if (n.textContent === 'Account & purchases') {
      n.textContent = 'Account';
    }
    if (n.textContent === 'On this device') {
      n.textContent = 'Across all devices';
    }
    if (n.textContent && n.textContent.includes('the clock starts in')) {
      n.textContent = n.textContent.replace(/the clock starts in /g, 'starting in ');
    }
    if (n.textContent && n.textContent.includes('the clock beat you to it')) {
      n.textContent = n.textContent.replace(/the clock beat you to it\./g, 'you skipped this one.');
    }
    if (n.textContent && n.textContent.includes('Your timer keeps running')) {
      n.textContent = 'one in a krillion.';
    }
    if (n.textContent && (n.textContent.includes('25 seconds') || n.textContent.includes('7 prompts · rarer answers') || n.textContent.trim() === 'Name one thing.')) {
      n.textContent = n.textContent
        .replace(/25 seconds each/g, 'no timer')
        .replace(/25 seconds to name one thing\./g, 'take your time to name one thing.')
        .replace(/7 prompts · rarer answers sink deeper/g, '7 prompts · no timer · rarer answers sink deeper')
        .replace(/Name one thing\./g, 'take your time to name one thing.');
    }
    if (n.textContent && n.textContent.includes('Archive replays')) {
      n.textContent = n.textContent.replace('Archive replays don’t extend your streak.', '').replace('Archive replays don\'t extend your streak.', '').trim();
    }
    if (unwantedTexts.some(t => n.textContent.includes(t)) || n.textContent.includes('found a bug?')) {
      let parent = n.parentElement;
      if (parent && parent.tagName !== 'BODY' && parent.style.display !== 'none') {
        if (parent.closest && parent.closest('[class*="historyRow"]')) {
            parent.closest('[class*="historyRow"]').style.display = 'none';
        } else if (n.textContent.includes('found a bug?')) {
            const container = parent.closest('p');
            if (container) container.style.display = 'none';
        } else {
            parent.style.display = 'none';
        }
      }
    }
  }

  // Hide the "suggest a question" form completely
  const suggestLabel = document.querySelector('label[for="suggest-question"]');
  if (suggestLabel) {
    const suggestForm = suggestLabel.closest('form');
    if (suggestForm) suggestForm.style.display = 'none';
  }

  document.querySelectorAll('.ds-done .flex.flex-col').forEach(el => {
    const visible = [...el.children].some(c => getComputedStyle(c).display !== 'none');
    if (!visible) el.style.display = 'none';
  });

  // 3. Replace Google button with local login
  const buttons = Array.from(document.querySelectorAll('button'));

  const googleBtn = buttons.find(b => b.textContent && b.textContent.includes('Google'));
  
  if (googleBtn && !document.getElementById('local-username')) {
    googleBtn.style.display = 'none';
    const container = googleBtn.parentElement;
    
    const localUser = localStorage.getItem('local_username');
    const div = document.createElement('div');
    div.id = 'local-username';
    if (localUser) {
        div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%; text-align:center;">
          <div>Logged in as <b style="color:#00ffff">${localUser}</b></div>
          <button class="btn-descend w-full" onclick="window.localLogout()">Log Out</button>
        </div>`;
    } else {
        div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <input id="local-username-input" type="text" placeholder="Enter Username" class="ds-input" style="padding:12px; font-size:16px; border-radius:0; border:1px solid #555; background: #000; color: white;" />
            <button class="btn-descend w-full" onclick="window.localLogin()">Log In</button>
        </div>`;
    }
    container.appendChild(div);
    [...container.children].forEach(ch => {
      if (ch.id !== 'local-username') ch.style.display = 'none';
    });
  }

  // 4. Add symmetric Skip button
  const dockInner = document.querySelector('.ds-dock-inner');
  if (dockInner && !document.getElementById('krillion-skip-btn')) {
    const submitBtn = dockInner.querySelector('.ds-dive-btn');
    if (submitBtn) {
      // Hide the blue fuse bar underneath the input
      const fuse = dockInner.querySelector('.ds-fuse');
      if (fuse) {
          fuse.style.display = 'none';
      }

      const skipBtn = submitBtn.cloneNode(true);
      skipBtn.id = 'krillion-skip-btn';
      skipBtn.type = 'button';
      
      skipBtn.innerHTML = 'SKIP';
      skipBtn.setAttribute('aria-label', 'Skip answer');
      // Fix any disabled state from cloning
      skipBtn.removeAttribute('disabled');
      skipBtn.style.opacity = '1';
      
      if (!window.__krSkip) {
        const nativeNow = Date.now.bind(Date);
        let extra = 0;
        Date.now = () => nativeNow() + extra;
        window.__krSkip = { add(ms) { extra += ms; } };
      }
      skipBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.__krSkip.add(99e8 + 1e4);
      };
      
      dockInner.insertBefore(skipBtn, dockInner.firstChild);
    }
  }

  // 5. Hide Restore and Share from Settings Menu
  const restoreLinks = document.querySelectorAll('a[href="/restore"], a[href="restore"]');

  restoreLinks.forEach(link => {
      const parentDiv = link.parentElement;
      if (parentDiv && parentDiv.tagName === 'DIV') {
          parentDiv.style.display = 'none';
      }
  });

  const prefs = document.querySelectorAll('label[class*="preference"]');
  prefs.forEach(p => {
    if (p.textContent.includes('Share link') && !p.hasAttribute('data-reset-injected')) {
      p.setAttribute('data-reset-injected', 'true');
      p.innerHTML = `
        <span class="SettingsControl-module__MfdTzG__preferenceCopy">
          <span class="SettingsControl-module__MfdTzG__preferenceLabel" style="color: #ff5252">Reset Progress</span>
          <span class="SettingsControl-module__MfdTzG__preferenceDescription">Wipe all local scores, stats, and streaks.</span>
        </span>
        <button style="background: #03070f; color: #ff5252; padding: 0 16px; border: none; height: 30px; font-weight: 600; font-family: var(--font-mono-ui), monospace; letter-spacing: 0.1em; cursor: pointer; box-shadow: inset 0 3px 5px rgba(0,0,0,0.9), 0 0 0 2px #060d1a, 0 0 0 3px #1b3050; border-radius: 0;">RESET</button>
      `;
      const btn = p.querySelector('button');
      if (btn) {
          btn.onclick = (e) => {
              e.preventDefault();
              if (confirm('ARE YOU SURE?\n\nThis will erase all data associated with your user permanently')) {
                  // Keep the local_username if they are logged in, so they don't have to re-login
                  const user = localStorage.getItem('local_username');
                  localStorage.clear();
                  if (user) {
                      localStorage.setItem('local_username', user);
                      // Force an immediate sync of empty data to clear the server DB
                      fetch('/local-api/sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ username: user, data: {} })
                      }).then(() => window.location.reload());
                  } else {
                      window.location.reload();
                  }
              }
          };
      }
    }
  });
});

observer.observe(document.documentElement, {
 childList: true, subtree: true, characterData: true });

// Run it once immediately just in case
observer.takeRecords();

window.localLogin = async function() {
    const username = document.getElementById('local-username-input').value.trim();
    if (!username) return;
    
    // We send current token to backend, or if backend has it, we get it
    const payload = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('krillion:')) {
            payload[key] = localStorage.getItem(key);
        }
    }
    
    try {
        const res = await fetch('/local-api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, data: payload })
        });
        
        const result = await res.json();
        if (result.data) {
            // Overwrite local storage with server data
            for (const key in result.data) {
                localStorage.setItem(key, result.data[key]);
            }
        }
        
        localStorage.setItem('local_username', result.casedUsername || username);
        window.location.reload();
    } catch (err) {
        alert("Login failed");
    }
};

window.localLogout = function() {
    localStorage.removeItem('local_username');
    // Clear tokens so a fresh one is generated
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key.startsWith('krillion:')) {
            localStorage.removeItem(key);
        }
    }
    window.location.reload();
};

// Auto-sync localStorage changes to DB for the logged-in user
setInterval(async () => {
    const localUser = localStorage.getItem('local_username');
    if (!localUser) return;
    
    const payload = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('krillion:')) {
            payload[key] = localStorage.getItem(key);
        }
    }
    
    // We can just use the login endpoint to update data if we add an update query
    fetch('/local-api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: localUser, data: payload })
    }).catch(()=>{});
}, 5000);
 