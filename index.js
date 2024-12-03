// Core configuration with comment support
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
    LIMIT: 50,
    COMMENT: {
        ID: '0x434F4D4D454E54:', // Hex for "COMMENT:"
        CACHE: 'comments'
    }
};

// Optimized cache with auto-cleanup
class Cache {
    constructor(maxSize = 100) {
        this.data = new Map();
        this.times = new Map();
        this.maxSize = maxSize;
    }
    
    get(k) { 
        const v = this.data.get(k); 
        v && this.times.set(k, Date.now()); 
        return v; 
    }
    
    set(k, v) { 
        this.data.size >= this.maxSize && this.clean();
        this.data.set(k, v); 
        this.times.set(k, Date.now());
    }
    
    clean() {
        const now = Date.now();
        for (const [k, t] of this.times) {
            if (now - t > CONFIG.TTL) {
                this.data.delete(k);
                this.times.delete(k);
            }
        }
    }
}

// Main application class
class App {
    constructor() {
        this.eth = window.ethers;
        this.cache = new Cache(200);
        this.state = { 
            i: [], // items
            l: false, // loading
            n: false, // noMore
            s: false, // searching
            p: null, // params
            r: new Set() // requests
        };
        this.$ = id => this._els?.[id] || (this._els = {})[id] || (this._els[id] = document.getElementById(id));
        this.init();
    }

    async init() {
        this.setupUI();
        this.events();
        await this.load();
        this.feed();
        setInterval(() => this.cache.clean(), CONFIG.TTL);
    }

    setupUI() {
        // Add comment modal to DOM
        document.body.insertAdjacentHTML('beforeend', `
            <div id="commentModal" class="modal">
                <div class="modal-content">
                    <button class="close-btn">&times;</button>
                    <div id="reportContent"></div>
                    <div id="commentsSection">
                        <div id="commentsList"></div>
                        <div class="comment-input">
                            <textarea id="commentText" placeholder="Post your comment"></textarea>
                            <button id="submitComment">Comment</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; }
            .modal-content { position: relative; width: 90%; max-width: 600px; margin: 50px auto; background: #13101c; border-radius: 12px; padding: 20px; max-height: 90vh; overflow-y: auto; }
            .close-btn { position: absolute; right: 20px; top: 20px; background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }
            .comment-input { margin-top: 20px; border-top: 1px solid #2a2438; padding-top: 20px; }
            #commentText { width: 100%; min-height: 100px; background: #1a1327; border: 1px solid #2a2438; border-radius: 8px; padding: 12px; color: #fff; margin-bottom: 10px; resize: vertical; }
            .comment { padding: 15px; border-bottom: 1px solid #2a2438; }
            .comment-header { margin-bottom: 8px; }
            .comment-author { font-weight: bold; color: #b388ff; }
            .comment-time { color: #8899a6; font-size: 0.9em; }
            .loading, .error, .no-comments { padding: 20px; text-align: center; color: #8899a6; }
            .error { color: #ff6b6b; }
        `;
        document.head.appendChild(style);
    }

    events() {
        // Global event delegation
        document.addEventListener('click', e => {
            const t = e.target;
            const acts = { 
                connectWallet: () => this.connect(),
                publishStory: () => this.submit(),
                loadMoreButton: () => this.feed(),
                submitComment: () => this.postComment(),
                'close-btn': () => this.hideComments()
            };
            
            if (acts[t.id]) {
                e.preventDefault();
                acts[t.id]();
            } else if (t.matches('.action-btn')) {
                e.preventDefault();
                this.handleAction(t);
            }
        });

        // Optimized search with debounce
        const search = this.$('searchInput');
        let st;
        search?.addEventListener('input', () => {
            clearTimeout(st);
            st = setTimeout(() => this.search(), 300);
        });

        // Auto-resize comment input
        const comment = this.$('commentText');
        comment && new ResizeObserver(() => 
            requestAnimationFrame(() => {
                comment.style.height = 'auto';
                comment.style.height = comment.scrollHeight + 'px';
            })
        ).observe(comment);
    }

    async getTx(p) {
        const k = JSON.stringify(p);
        const cached = this.cache.get(k);
        if (cached) return cached;

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

    async getComments(reportId) {
        const cacheKey = `comments_${reportId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const response = await this.getTx();
        const comments = [];

        for (const tx of response.items || []) {
            if (tx.value === '0' && tx.input?.startsWith(CONFIG.COMMENT.ID)) {
                try {
                    const [targetId, text] = this.eth.utils.defaultAbiCoder.decode(
                        ['bytes32', 'string'],
                        '0x' + tx.input.slice(CONFIG.COMMENT.ID.length)
                    );
                    if (targetId === reportId) {
                        comments.push({
                            text,
                            author: tx.from.hash || tx.from,
                            timestamp: tx.timestamp || tx.block_timestamp
                        });
                    }
                } catch (e) {
                    console.warn('Comment decode error:', e);
                }
            }
        }

        this.cache.set(cacheKey, comments);
        return comments;
    }

    async showComments(reportId) {
        const report = this.state.i.find(i => i.queryId === reportId);
        if (!report) return;

        const modal = this.$('commentModal');
        const content = this.$('reportContent');
        
        content.innerHTML = `
            <div class="report-full">
                <div class="reporter-info">
                    <img src="newTRBphoto.jpg" alt="Reporter" class="avatar">
                    <div class="reporter-details">
                        <span class="reporter-name">${this.short(report.reporter)}</span>
                        <span class="report-timestamp">· ${this.date(report.timestamp)}</span>
                    </div>
                </div>
                <div class="report-content">
                    ${report.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
                </div>
            </div>
        `;

        this.currentReport = report;
        this.loadComments(reportId);
        modal.style.display = 'block';
    }

    async loadComments(reportId) {
        const list = this.$('commentsList');
        list.innerHTML = '<div class="loading">Loading comments...</div>';

        try {
            const comments = await this.getComments(reportId);
            list.innerHTML = comments.length ? comments.map(c => `
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-author">${this.short(c.author)}</span>
                        <span class="comment-time">· ${this.date(c.timestamp)}</span>
                    </div>
                    <div class="comment-text">${c.text}</div>
                </div>
            `).join('') : '<div class="no-comments">No comments yet. Be the first to comment!</div>';
        } catch (e) {
            list.innerHTML = '<div class="error">Failed to load comments</div>';
            console.error('Comment load error:', e);
        }
    }

    async postComment() {
        const text = this.$('commentText').value.trim();
        if (!text) return;

        try {
            if (!window.ethereum) throw new Error("Install MetaMask");
            
            const provider = new this.eth.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();

            const data = this.eth.utils.defaultAbiCoder.encode(
                ['bytes32', 'string'],
                [this.currentReport.queryId, text]
            );

            const tx = await signer.sendTransaction({
                to: CONFIG.CONTRACT.ADDR,
                value: '0',
                data: CONFIG.COMMENT.ID + data.slice(2)
            });

            await tx.wait();
            this.$('commentText').value = '';
            this.loadComments(this.currentReport.queryId);

        } catch (e) {
            console.error('Comment post error:', e);
            alert('Failed to post comment');
        }
    }

    hideComments() {
        this.$('commentModal').style.display = 'none';
    }

    handleAction(btn) {
        const c = btn.closest('.report-actions');
        const action = btn.dataset.action;
        
        if (action === 'comment') {
            this.showComments(c.dataset.queryId);
        } else if (action === 'dispute') {
            window.disputeNews?.(c.dataset.reporter, c.dataset.queryId, c.dataset.timestamp);
        } else {
            console.log(`${action} by: ${this.short(c.dataset.reporter)}`);
        }
    }

    // Utility methods
    short = a => a?.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : (a || 'Unknown');
    date = t => new Date(t).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
    toggle = s => this.$('loadingOverlay').style.display = s ? 'flex' : 'none';
    clean = () => { this.cache.clear(); if (this.state.i.length > CONFIG.LIMIT * 2) this.state.i = this.state.i.slice(0, CONFIG.LIMIT); };
    load = async () => { try { const s = localStorage.getItem(CONFIG.STORE); if (s) this.state.i = JSON.parse(s); } catch (e) { console.warn('Storage:', e); } };

    // ... rest of the core functionality (feed, connect, submit) remains the same ...
}

// Initialize
document.addEventListener('DOMContentLoaded', () => new App());
