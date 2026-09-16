const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const baseDir = path.join(__dirname, 'krillion-mirror/krillion.io');
const chunksDir = path.join(baseDir, '_next/static/chunks');

function collectChunkRefs(text, set) {
    const re = /\/_next\/static\/chunks\/([^"'?\s]+)/g;
    let m;
    while ((m = re.exec(text))) set.add(m[1]);
}

function fetchMissingChunks() {
    if (!fs.existsSync(chunksDir)) return;
    const dplMatch = (function() {
        try {
            const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
            return html.match(/dpl=([^"&\s]+)/);
        } catch { return null; }
    })();
    const q = dplMatch ? `?dpl=${dplMatch[1]}` : '';

    for (let round = 0; round < 3; round++) {
        const refs = new Set();
        function walk(dir) {
            if (!fs.existsSync(dir)) return;
            for (const f of fs.readdirSync(dir)) {
                const p = path.join(dir, f);
                if (fs.statSync(p).isDirectory()) walk(p);
                else if (/\.(html|js|css)$/.test(f)) {
                    collectChunkRefs(fs.readFileSync(p, 'utf8'), refs);
                }
            }
        }
        walk(baseDir);
        let fetched = 0;
        for (const f of refs) {
            const dest = path.join(chunksDir, f);
            if (fs.existsSync(dest)) continue;
            try {
                execFileSync('curl', ['-fsSL', `https://krillion.io/_next/static/chunks/${f}${q}`, '-o', dest], { timeout: 30000 });
                console.log('Fetched missing chunk: ' + f);
                fetched++;
            } catch (e) {
                console.warn('Could not fetch chunk: ' + f);
            }
        }
        if (!fetched) break;
    }
}

function processChunks() {
    if (!fs.existsSync(chunksDir)) {
        console.error("Chunks directory not found: " + chunksDir);
        return;
    }
    
    fs.readdirSync(chunksDir).forEach(f => {
        if (!f.includes('.js')) return;
        let c = fs.readFileSync(path.join(chunksDir, f), 'utf8');
        let originalC = c;
        
        // 1. Menu replacements
        const oldMenu = `let c=[{href:"/",label:"Daily dive",icon:"daily"},{href:"/unlimited/classic",label:"Unlimited",icon:"unlimited"},{href:"/archive",label:"Archive",icon:"archive"},{href:"/packs",label:"Themed packs",icon:"packs"},{href:"/account",label:"My Krillion",icon:"account"},{href:"/friends",label:"Friends",icon:"friends"}];`;
        const newMenu = `let c=[{href:"/",label:"Daily dive",icon:"daily"},{href:"/leaderboard",label:"Leaderboard",icon:"friends"},{href:"/account",label:"Account",icon:"account"}];`;
        c = c.replace(oldMenu, newMenu);
        
        // 2. Remove FAQ
        const faqJSX = `,(0,t.jsxs)(n.default,{href:"/faq",prefetch:!1,onNavigate:()=>b("/faq"),"aria-current":"/faq"===v?"page":void 0,children:[(0,t.jsx)(d,{name:"faq"}),(0,t.jsx)("span",{children:"FAQ"})]})`;
        c = c.replace(faqJSX, '');
        
        // 3. Remove "Unlock the depths" premium footer
        const oldLockHtml = `className:"ds-boot-title",children:e.lockTitle}),e.payUrl?(0,t.jsx)("a",{href:e.payUrl,className:"ds-next-btn",children:e.lockCta})`;
        const newLockHtml = `className:"ds-boot-title",children:e.lockTitle}),e.payUrl?null`;
        c = c.replace(oldLockHtml, newLockHtml);
        
        // 4. Remove footer links
        if (c.includes('found a bug? lost an unlock?')) {
            c = c.replace(/found a bug\? lost an unlock\?/g, '');
            c = c.replace(/>contact us</g, '><');
            c = c.replace(/>tell us what to ask</g, '><');
            c = c.replace(/>privacy</g, '><');
            c = c.replace(/> \xb7 </g, '><');
            c = c.replace(/> \xc2\xb7 </g, '><');
            c = c.replace(/> · </g, '><');
        }

        // 5. Timer and Text patches
        c = c.replace(/25e3/g, '99e8');
        c = c.replace(/The clock starts in /g, 'Starting in ');
        c = c.replace(/the clock starts in /g, 'starting in ');
        c = c.replace(/the clock beat you to it\./g, 'you skipped this one.');
        c = c.replace(/25 seconds each/g, 'no timer');
        c = c.replace(/25 seconds to name one thing\./g, 'take your time to name one thing.');
        c = c.replace(/7 prompts · rarer answers sink deeper/g, '7 prompts · no timer · rarer answers sink deeper');
        c = c.replace(/7 scenes · rarer answers drive farther/g, '7 scenes · no timer · rarer answers drive farther');
        c = c.replace(/7 rounds · rarer answers run farther/g, '7 rounds · no timer · rarer answers run farther');
        c = c.replace(/>Name one thing\.</g, '>take your time to name one thing.<');
        c = c.replace(/children:"Name one thing\."/g, 'children:"take your time to name one thing."');
        c = c.replace(/Your timer keeps running while the menu is open\./g, 'one in a krillion.');

        if (c !== originalC) {
            fs.writeFileSync(path.join(chunksDir, f), c);
            console.log(`Updated chunk: ${f}`);
        }
    });
}

function processHTML() {
    if (!fs.existsSync(baseDir)) {
        console.error("Base directory not found: " + baseDir);
        return;
    }

    // Copy local-auth.js
    const authSrc = path.join(__dirname, 'local-auth.js');
    const authDest = path.join(baseDir, 'local-auth.js');
    if (fs.existsSync(authSrc)) {
        fs.copyFileSync(authSrc, authDest);
        console.log("Copied local-auth.js to krillion.io/");
    }

    // Inject into all HTML files
    fs.readdirSync(baseDir).forEach(f => {
        if (!f.endsWith('.html')) return;
        const filePath = path.join(baseDir, f);
        let c = fs.readFileSync(filePath, 'utf8');
        if (!c.includes('local-auth.js')) {
            c = c.replace(/<\/body>/g, '<script src="/local-auth.js?v=12"></script></body>');
            fs.writeFileSync(filePath, c);
            console.log(`Injected auth script into: ${f}`);
        }
    });
}

fetchMissingChunks();
processChunks();
processHTML();
console.log("Mods applied successfully.");
