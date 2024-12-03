const CONFIG = {
    CONTRACT: {
        ADDR: '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',
        ABI: [
            {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},
            {"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
        ]
    },
    API_URL: 'https://api.scan.pulsechain.com/api/v2/addresses/',
    BATCH: 100,
    MIN: 10,
    MAX_REQ: 3,
    TTL: 300000,
    STORE: 'newsItems',
    LIMIT: 50
};

class App {
    constructor() {
        this.eth = window.ethers;
        this.cache = new Map();
        this.state = { i: [], l: false, n: false, s: false, p: null, r: new Set() };
        this.$ = id => this._els?.[id] || (this._els = {})[id] || (this._els[id] = document.getElementById(id));
        this.init();
    }

    async init() {
        this.events();
        await this.load();
        this.feed();
        setInterval(() => this.clean(), CONFIG.TTL);
    }

    events() {
        document.addEventListener('click', e => {
            const t = e.target;
            const acts = { connectWallet: this.connect, publishStory: this.submit, loadMoreButton: () => this.feed() };
            if (acts[t.id]) acts[t.id].call(this);
            else if (t.matches('.action-btn')) this.act(t);
        });

        const s = this.$('searchInput');
        let st;
        s?.addEventListener('input', () => {
            clearTimeout(st);
            st = setTimeout(() => this.search(), 300);
        });

        const r = this.$('reportContent');
        r && new ResizeObserver(() => requestAnimationFrame(() => {
            r.style.height = 'auto';
            r.style.height = r.scrollHeight + 'px';
        })).observe(r);
    }

    async getTx(p) {
        const k = JSON.stringify(p);
        if (this.cache.has(k)) return this.cache.get(k);

        const url = `${CONFIG.API_URL}${CONFIG.CONTRACT.ADDR}/transactions?filter=to&sort=desc&limit=${CONFIG.BATCH}${p ? '&' + new URLSearchParams(p) : ''}`;
        if (this.state.r.has(url)) {
            await new Promise(r => setTimeout(r, 100));
            return this.getTx(p);
        }

        this.state.r.add(url);
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            this.cache.set(k, d);
            return d;
        } finally {
            this.state.r.delete(url);
        }
    }

    async procTx(b) {
        if (!b?.items?.length) {
            this.state.n = true;
            return [];
        }

        const items = await Promise.all(b.items
            .filter(t => t.method === 'submitValue' && t.decoded_input?.parameters?.length >= 4)
            .map(async t => {
                try {
                    const [y, b] = this.eth.utils.defaultAbiCoder.decode(['string', 'bytes'], t.decoded_input.parameters[3].value);
                    if (y !== "StringQuery") return null;
                    const c = await this.decode(b);
                    return c.trim() ? {
                        content: c,
                        reporter: t.from.hash || t.from,
                        timestamp: t.timestamp || t.block_timestamp,
                        queryId: t.decoded_input.parameters[0].value
                    } : null;
                } catch (e) {
                    console.warn("Tx error:", e);
                    return null;
                }
            }));

        this.state.p = b.next_page_params || null;
        this.state.n = !this.state.p;
        return items.filter(Boolean);
    }

    async decode(b) {
        const k = b.toString();
        if (this.cache.has(k)) return this.cache.get(k);
        try {
            let e = b.length;
            while (e > 0 && b[e - 1] === 0) e--;
            const c = this.eth.utils.toUtf8String(b.slice(0, e));
            this.cache.set(k, c);
            return c;
        } catch (e) {
            const c = this.eth.utils.toUtf8String(b.slice(0, e.offset), true);
            this.cache.set(k, c);
            return c;
        }
    }

    async feed(reset) {
        if (this.state.l || (this.state.n && !reset)) return;
        
        this.state.l = true;
        this.toggle(true);

        if (reset) {
            this.state.i = [];
            this.state.n = false;
            this.state.p = null;
            this.$('newsFeed').textContent = '';
        }

        try {
            const q = [], ni = [];
            while (ni.length < CONFIG.MIN && !this.state.n) {
                q.push(this.getTx(this.state.p));
                if (q.length >= CONFIG.MAX_REQ) {
                    const i = await this.procTx(await q.shift());
                    ni.push(...i);
                }
            }

            while (q.length) {
                const i = await this.procTx(await q.shift());
                ni.push(...i);
            }

            if (ni.length) {
                this.state.i = reset ? ni : [...this.state.i, ...ni];
                await this.render(ni, !reset);
                localStorage.setItem(CONFIG.STORE, JSON.stringify(this.state.i.slice(0, CONFIG.LIMIT)));
            }
            
            this.$('loadMoreButton').style.display = this.state.n ? 'none' : 'block';
        } catch (e) {
            console.error('Feed:', e);
        } finally {
            this.state.l = false;
            this.toggle(false);
        }
    }

    render(items, append) {
        if (!items.length && !append) {
            this.$('newsFeed').innerHTML = '<p>No items</p>';
            return;
        }

        const f = document.createDocumentFragment();
        const t = document.createElement('template');

        items.forEach(i => {
            t.innerHTML = `
                <article class="news-item">
                    <div class="reporter-info">
                        <img src="newTRBphoto.jpg" alt="Reporter" class="avatar">
                        <div class="reporter-details">
                            <span class="reporter-name">${this.short(i.reporter)}</span>
                            <span class="report-timestamp">· ${this.date(i.timestamp)}</span>
                        </div>
                    </div>
                    <div class="report-content">${i.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>
                    <div class="report-actions" data-reporter="${i.reporter}" data-query-id="${i.queryId}" data-timestamp="${i.timestamp}">
                        <button class="action-btn" data-action="comment">Comment</button>
                        <button class="action-btn" data-action="like">Like</button>
                        <button class="action-btn" data-action="dispute">Dispute</button>
                        <button class="action-btn" data-action="vote">Vote</button>
                    </div>
                </article>
            `.trim();
            f.appendChild(t.content.firstChild);
        });

        requestAnimationFrame(() => {
            const nf = this.$('newsFeed');
            if (!append) nf.textContent = '';
            nf.appendChild(f);
            nf.style.visibility = 'visible';
        });
    }

    search() {
        const t = this.$('searchInput').value.toLowerCase();
        if (!t) {
            this.state.s = false;
            this.render(this.state.i);
            this.$('loadMoreButton').style.display = 'block';
            return;
        }

        const f = this.state.i.filter(i => 
            this.short(i.reporter).toLowerCase().includes(t) || 
            i.content.toLowerCase().includes(t)
        );

        this.render(f);
        this.state.s = true;
        this.$('loadMoreButton').style.display = 'none';
    }

    async connect() {
        try {
            if (!window.ethereum) throw new Error("Install MetaMask");
            const p = new this.eth.providers.Web3Provider(window.ethereum);
            await p.send("eth_requestAccounts", []);
            const s = p.getSigner();
            const a = await s.getAddress();
            this.$('connectWallet').style.display = 'none';
            this.$('walletInfo').style.display = 'block';
            this.$('walletAddress').textContent = this.short(a);
            this.$('publishStory').disabled = false;
            this.contract = new this.eth.Contract(CONFIG.CONTRACT.ADDR, CONFIG.CONTRACT.ABI, s);
        } catch (e) {
            console.error('Wallet:', e);
        }
    }

    async submit() {
        const c = this.$('reportContent').value.trim();
        if (!c) return;
        
        this.$('publishStory').disabled = true;
        this.toggle(true);
        
        try {
            if (!this.contract) throw new Error("Connect wallet");
            const qd = this.eth.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", this.eth.utils.toUtf8Bytes(c)]);
            const qid = this.eth.utils.keccak256(qd);
            const n = await this.contract.getNewValueCountbyQueryId(qid);
            const v = this.eth.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", this.eth.utils.toUtf8Bytes(c)]);
            const g = await this.contract.estimateGas.submitValue(qid, v, n, qd);
            const tx = await this.contract.submitValue(qid, v, n, qd, { gasLimit: g.mul(120).div(100) });
            await tx.wait();
            
            const ni = {
                content: c,
                reporter: await this.contract.signer.getAddress(),
                timestamp: new Date().toISOString(),
                queryId: qid
            };
            
            this.state.i.unshift(ni);
            this.render([ni], true);
            this.$('reportContent').value = '';
            localStorage.setItem(CONFIG.STORE, JSON.stringify(this.state.i.slice(0, CONFIG.LIMIT)));
        } catch (e) {
            console.error('Submit:', e);
        } finally {
            this.$('publishStory').disabled = false;
            this.toggle(false);
        }
    }

    short = a => a?.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : (a || 'Unknown');
    date = t => new Date(t).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
    toggle = s => this.$('loadingOverlay').style.display = s ? 'flex' : 'none';
    clean = () => { this.cache.clear(); if (this.state.i.length > CONFIG.LIMIT * 2) this.state.i = this.state.i.slice(0, CONFIG.LIMIT); };
    load = async () => { try { const s = localStorage.getItem(CONFIG.STORE); if (s) this.state.i = JSON.parse(s); } catch (e) { console.warn('Storage:', e); } };
    act = b => {
        const c = b.closest('.report-actions');
        const { reporter, queryId, timestamp } = c.dataset;
        const a = b.dataset.action;
        a === 'dispute' ? window.disputeNews?.(reporter, queryId, timestamp) : console.log(`${a} by: ${this.short(reporter)}`);
    };
}

document.addEventListener('DOMContentLoaded', () => new App());
