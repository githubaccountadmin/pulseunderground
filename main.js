const ethers = window.ethers;
const defaultAbiCoder = ethers.defaultAbiCoder;
const utils = ethers.utils;

// Constants for Tellor Oracle and other contract interactions
const D = {
    A: '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',
    B: [
        {inputs: [{name: "_queryId", type: "bytes32"}, {name: "_value", type: "bytes"}, {name: "_nonce", type: "uint256"}, {name: "_queryData", type: "bytes"}], name: "submitValue", outputs: [], stateMutability: "nonpayable", type: "function"},
        {inputs: [{name: "_queryId", type: "bytes32"}], name: "getNewValueCountbyQueryId", outputs: [{name: "", type: "uint256"}], stateMutability: "view", type: "function"},
        {inputs: [], name: "getStakeAmount", outputs: [{name: "", type: "uint256"}], stateMutability: "view", type: "function"},
        {inputs: [{name: "_stakerAddress", type: "address"}], name: "getStakerInfo", outputs: [{name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "uint256"}, {name: "", type: "bool"}], stateMutability: "view", type: "function"}
    ],
    u: 'api.scan.pulsechain.com/api/v2/addresses/',
    b: 100,
    m: 10,
    r: 3,
    t: 3e5,
    c: '0x434F4D4D454E54'
};

// Governance and Token contract details for disputes
const governanceContractAddress = '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00';
const tokenContractAddress = '0x7CdD7A0963A92bA1D98f6173214563EE0EBd9921';
const governanceContractABI = [
    {"inputs": [{"name": "_queryId", "type": "bytes32"}, {"name": "_timestamp", "type": "uint256"}], "name": "beginDispute", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "disputeFee", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"}
];
const tokenABI = ["function approve(address spender, uint256 amount) public returns (bool)"];

// Cache configuration
const C = {
    n: 'PUCache',
    v: 1,
    s: {n: 'news', c: 'comments', r: 'reporters'},
    t: 3e5,
    k: {c: 'cached', t: 'timestamp', q: 'queryId', r: 'reporter'}
};

// Helper functions
const sh = (a) => a?.length > 10 ? a.slice(0, 6) + '...' + a.slice(-4) : a || '-';
const dt = (t) => new Date(t).toLocaleString('en', {month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'});
const displayStatus = (m) => {
    const o = document.getElementById('o');
    o.textContent = m;
    o.style.display = 'block';
    setTimeout(() => o.style.display = 'none', 3e3);
};
const toggleLoading = (s) => {
    const l = document.getElementById('loadingOverlay');
    l && (l.style.display = s ? 'flex' : 'none');
};
const hideModal = () => {
    document.getElementById('m').style.display = 'none';
    document.body.style.overflow = '';
    const t = document.getElementById('t');
    t && (t.value = '');
};

class Cache {
    constructor() {
        this.db = null;
        this.memoryCache = new Map();
        this.pendingRequests = new Set();
        this.init();
    }

    async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const openDB = indexedDB.open(C.n, C.v);
            openDB.onerror = () => reject(openDB.error);
            openDB.onsuccess = () => {this.db = openDB.result; resolve(this.db)};
            openDB.onupgradeneeded = e => {
                const db = e.target.result, keys = C.k;
                if (!db.objectStoreNames.contains(C.s.n)) {
                    const store = db.createObjectStore(C.s.n, {keyPath: keys.q});
                    store.createIndex(keys.t, keys.t, {unique: false});
                    store.createIndex(keys.r, keys.r, {unique: false});
                }
                // Additional stores creation for comments and reporters...
            };
        });
    }

    async transaction(storeName, mode, callback) {
        const db = await this.init();
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        try {
            return await callback(store, transaction);
        } catch (e) {
            transaction.abort();
            throw e;
        }
    }

    async saveNews(items) {
        const timestamp = Date.now();
        await this.transaction(C.s.n, 'readwrite', async (store) => {
            const promises = items.map(item => store.put({...item, [C.k.c]: timestamp}));
            await Promise.all(promises);
        });
    }

    async getNews(options = {}) {
        const {limit = 50, offset = 0, reporter} = options;
        const now = Date.now();
        const news = [];
        return this.transaction(C.s.n, 'readonly', async (store) => {
            const index = reporter ? store.index(C.k.r) : store.index(C.k.t);
            await new Promise((resolve, reject) => {
                let count = 0;
                const request = index.openCursor(reporter || null, 'prev');
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (!cursor || news.length >= limit) {
                        resolve();
                        return;
                    }
                    if (count < offset) {
                        count++;
                        cursor.continue();
                        return;
                    }
                    if (cursor.value[C.k.c] > now - C.t) {
                        news.push(cursor.value);
                    }
                    cursor.continue();
                };
            });
            return news;
        });
    }

    // Other cache methods like for comments could be added here if needed
}

class App {
    constructor() {
        this.e = ethers;
        this.state = {items: [], loading: 0, noMore: 0, page: null, requests: new Set(), lastUpdate: 0, searchActive: 0};
        this.$ = document.getElementById.bind(document);
        this.setup();
        this.cache = new Cache();
        this.cache.init().then(() => this.fetch(true)).catch(console.error);
    }

    setup() {
        document.body.insertAdjacentHTML('beforeend', '<div id="m" class="modal"><div id="n" class="modal-content"><button class="x">×</button><div id="r" class="original-post"></div><div id="s" class="comments-section"><div id="l" class="comments-list"></div><div class="i"><textarea id="t" placeholder="Write a comment..."></textarea><button id="cs">💬</button></div></div></div><div id="o" class="status-message"></div>');
        document.addEventListener('click', e => {
            const target = e.target;
            if (!target) return;
            if (target.classList.contains('x')) { this.hideModal(); }
            else if (target.matches('.action-btn')) {
                const actions = target.closest('.report-actions')?.dataset;
                if (actions) {
                    if (target.dataset.action === 'comment') this.showCommentModal(actions.queryId);
                    else if (target.dataset.action === 'dispute') this.disputeNews(actions.reporter, actions.queryId, actions.timestamp);
                }
            } else {
                const id = target.id;
                switch(id) {
                    case 'connectWallet': this.connectWallet(); break;
                    case 'publishStory': this.publishStory(); break;
                    case 'loadMoreButton': this.loadMore(); break;
                    case 'cs': this.postComment(); break;
                    case 'search-button': this.search(); break;
                }
            }
        });

        const textarea = this.$('t');
        if (textarea) {
            new ResizeObserver(() => requestAnimationFrame(() => textarea.style.height = textarea.scrollHeight + 'px')).observe(textarea);
        }

        const searchInput = this.$('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', e => e.key === 'Enter' && this.search());
            searchInput.addEventListener('input', e => {
                const value = e.target.value.trim();
                if (!value && this.state.searchActive) {
                    this.state.searchActive = 0;
                    this.render(this.state.items);
                    this.$('loadMoreButton').style.display = 'none';
                }
            });
        }

        window.addEventListener('scroll', () => {
            if (!this.state.loading && !this.state.noMore && !this.state.searchActive && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
                this.loadMore();
            }
        });

        this.$('loadMoreButton').style.display = 'none';
        setInterval(() => this.loadMore(), D.t);
    }

    async connectWallet() {
        try {
            if (!window.ethereum) throw 'Please install MetaMask';
            const provider = new this.e.providers.Web3Provider(window.ethereum);
            await provider.send('eth_requestAccounts', []);
            const signer = provider.getSigner(), address = await signer.getAddress();
            this.$('connectWallet').style.display = 'none';
            this.$('walletInfo').style.display = 'block';
            this.$('walletAddress').textContent = sh(address);
            this.$('publishStory').disabled = false;
            this.$('reportContent').placeholder = "What's happening?";
            this.contract = new this.e.Contract(D.A, D.B, signer);
            this.signer = signer;
            displayStatus('Connected');
        } catch (e) {
            console.error('Wallet error:', e);
            displayStatus(e.message === 'User rejected the request.' ? 'Connection cancelled' : e.message || 'Failed to connect wallet');
        }
    }

    async publishStory() {
        const content = this.$('reportContent').value.trim();
        if (!content) return displayStatus('Please enter content');
        this.$('publishStory').disabled = true;
        toggleLoading(true);
        try {
            if (!this.contract) throw new Error("Wallet not connected.");
            const data = defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", utils.toUtf8Bytes(content)]),
                  queryId = utils.keccak256(data),
                  nonce = await this.contract.getNewValueCountbyQueryId(queryId),
                  value = defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", utils.toUtf8Bytes(content)]);
            const stakerInfo = await this.contract.getStakerInfo(await this.signer.getAddress()),
                  requiredStake = await this.contract.getStakeAmount(),
                  userStake = stakerInfo[1];
            if (userStake.lt(requiredStake)) throw new Error(`Not enough TRB staked. You have ${utils.formatEther(userStake)} vs ${utils.formatEther(requiredStake)} TRB needed.`);
            let gas = await this.contract.estimateGas.submitValue(queryId, value, nonce, data);
            if (gas.gt(utils.constants.MaxUint256.div(100))) throw new Error("Gas estimate too high.");
            gas = gas.mul(110).div(100);
            const tx = await this.contract.submitValue(queryId, value, nonce, data, { gasLimit: gas });
            await tx.wait();
            displayStatus('Story published!');
            this.$('reportContent').value = '';
            const newStory = { content, reporter: await this.signer.getAddress(), timestamp: new Date().toISOString(), queryId };
            this.state.items.unshift(newStory);
            this.render([newStory], true);
            await this.cache.saveNews([newStory]);
        } catch (e) {
            console.error('Publish error:', e);
            displayStatus(e.message.includes('insufficient funds') ? 'Insufficient funds' : 
                         e.message.includes('gas required') ? 'Gas estimate too high' : 
                         e.message.includes('Not enough TRB') ? e.message : 
                         'Error publishing: ' + e.message);
        } finally {
            this.$('publishStory').disabled = false;
            toggleLoading(false);
        }
    }

    search() {
        const input = this.$('search-input'), value = input?.value.trim().toLowerCase();
        if (!value) return;
        const filtered = this.state.items.filter(item => sh(item.reporter).toLowerCase().includes(value) || item.content.toLowerCase().includes(value));
        this.render(filtered);
        this.state.searchActive = 1;
        this.$('loadMoreButton').style.display = 'block';
        displayStatus(`Found ${filtered.length} result(s)`);
    }

    async loadMore() {
        if (this.state.loading || Date.now() - this.state.lastUpdate < 30000) return;
        this.state.loading = 1;
        toggleLoading(true);
        try {
            const transactions = await this.fetchTransactions(this.state.page);
            const newItems = await this.parseTransactions(transactions);
            const freshItems = newItems.filter(item => !this.state.items.some(existing => existing.queryId === item.queryId));
            if (freshItems.length) {
                this.state.items.unshift(...freshItems);
                this.render(freshItems, true);
                displayStatus('+' + freshItems.length);
                await this.cache.saveNews(freshItems);
            }
            this.state.lastUpdate = Date.now();
        } catch (e) {
            console.error('Update error:', e);
        } finally {
            this.state.loading = 0;
            toggleLoading(false);
        }
    }

    async fetch(initial) {
        if (this.state.loading || (this.state.noMore && !initial)) return;
        this.state.loading = 1;
        toggleLoading(true);
        if (initial) {
            this.state.items = [];
            this.state.noMore = 0;
            this.state.page = null;
        }
        try {
            const items = [], cachedItems = await this.cache.getNews({ limit: D.m });
            if (cachedItems.length) {
                this.state.items = cachedItems;
                this.render(cachedItems, !initial);
            }
            while (items.length < D.m && !this.state.noMore) {
                const transactions = await this.fetchTransactions(this.state.page);
                items.push(...(await this.parseTransactions(transactions)));
            }
            if (items.length) {
                await this.cache.saveNews(items);
                this.state.items = initial ? items : this.state.items.concat(items);
                this.render(items, !initial);
            }
            this.$('loadMoreButton').style.display = this.state.noMore ? 'none' : 'block';
        } catch (e) {
            console.error('Feed error:', e);
        } finally {
            this.state.loading = 0;
            toggleLoading(false);
        }
    }

    async parseTransactions(batch) {
        if (!batch?.items?.length) {
            this.state.noMore = 1;
            return [];
        }
        const items = [];
        for (const tx of batch.items) if (tx.method === 'submitValue' && tx.decoded_input?.parameters?.length >= 4) {
            const [type, data] = defaultAbiCoder.decode(['string', 'bytes'], tx.decoded_input.parameters[3].value);
            if (type === 'StringQuery') {
                const content = utils.toUtf8String(data).trim();
                if (content) items.push({ 
                    content, 
                    reporter: tx.from.hash || tx.from, 
                    timestamp: tx.timestamp || tx.block_timestamp, 
                    queryId: tx.decoded_input.parameters[0].value 
                });
            }
        }
        this.state.page = batch.next_page_params || null;
        this.state.noMore = !this.state.page;
        return items;
    }

    render(items, append = false) {
        if (!items.length && !append) return this.$('newsFeed').innerHTML = 'No items';
        const fragment = document.createDocumentFragment(), template = document.createElement('template');
        items.forEach(item => {
            template.innerHTML = `<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="R" class="avatar"><div class="reporter-details"><span class="reporter-name">${sh(item.reporter)}</span>· ${dt(item.timestamp)}</div></div><div class="report-content">${item.content.split('\n\n').map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('')}</div><div class="report-actions" data-reporter="${item.reporter}" data-query-id="${item.queryId}" data-timestamp="${item.timestamp}"><button class="action-btn" data-action="comment">💬</button><button class="action-btn" data-action="like">👍</button><button class="action-btn" data-action="dispute">⚠️</button><button class="action-btn" data-action="vote">✓</button></div></article>`;
            fragment.appendChild(template.content.firstChild);
        });
        const feed = this.$('newsFeed');
        if (append) feed.appendChild(fragment);
        else {
            feed.textContent = '';
            feed.appendChild(fragment);
        }
        feed.style.visibility = 'visible';
    }

    async fetchTransactions(params) {
        const url = `https://${D.u}${D.A}/transactions?filter=to&sort=desc&limit=${D.b}${params ? '&' + new URLSearchParams(params) : ''}`;
        if (this.state.requests.has(url)) return new Promise(resolve => setTimeout(() => resolve(this.fetchTransactions(params)), 100));
        this.state.requests.add(url);
        try {
            return await (await fetch(url)).json();
        } catch (e) {
            throw console.error('API Error:', e), e;
        } finally {
            this.state.requests.delete(url);
        }
    }

    // Dispute functions
    async initializeEthers() {
        if (typeof window.ethereum === 'undefined') {
            throw new Error("Ethereum provider not found. Please install MetaMask.");
        }
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        this.governanceContract = new ethers.Contract(governanceContractAddress, governanceContractABI, signer);
        this.tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
        return { provider, signer };
    }

    async getDisputeFee() {
        const { provider } = await this.initializeEthers();
        const network = await provider.getNetwork();
        if (network.chainId !== 369) {
            throw new Error("Please connect to PulseChain network");
        }
        return this.governanceContract.disputeFee();
    }

    async beginDispute(queryId, timestamp) {
        try {
            const { provider } = await this.initializeEthers();
            const network = await provider.getNetwork();
            if (network.chainId !== 369) {
                throw new Error("Please connect to PulseChain network");
            }
            const disputeFee = await this.getDisputeFee();
            console.log(`Dispute fee: ${ethers.utils.formatEther(disputeFee)} TRB`);
            const approveTx = await this.tokenContract.approve(governanceContractAddress, disputeFee);
            await approveTx.wait();
            console.log('Approval transaction confirmed.');
            const tx = await this.governanceContract.beginDispute(queryId, timestamp);
            await tx.wait();
            console.log('Dispute transaction confirmed.');
            return tx.hash;
        } catch (error) {
            console.error('Error initiating dispute:', error);
            if (error.message.includes("insufficient funds")) {
                throw new Error("Insufficient TRB balance for dispute fee");
            } else if (error.message.includes("user rejected")) {
                throw new Error("Transaction rejected by user");
            } else {
                throw error;
            }
        }
    }

    async disputeNews(originalReporterAddress, queryId, timestamp) {
        try {
            const disputeFee = await this.getDisputeFee();
            if (confirm(`Are you sure you want to dispute this report?\n\nReporter: ${originalReporterAddress}\nDispute Fee: ${ethers.utils.formatEther(disputeFee)} TRB\n\nThis action will require a transaction and gas fees.`)) {
                const txHash = await this.beginDispute(queryId, timestamp);
                displayStatus(`Dispute submitted successfully. Transaction hash: ${txHash}`);
            } else {
                displayStatus("Dispute cancelled");
            }
        } catch (error) {
            displayStatus(`Error submitting dispute: ${error.message}`, true);
        }
    }

    // Placeholder methods for future implementation or debugging
    showCommentModal(queryId) { console.log("Comment section for queryId:", queryId); }
    postComment() { console.log("Post comment action"); }
    hideModal = hideModal;
}

new App();
