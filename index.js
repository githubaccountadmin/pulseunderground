const $ = document.querySelector.bind(document);
const addr = {
    c: '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',
    g: '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00',
    t: '0x7CdD7a0963a92BA1D98f6173214563EE0eBd9921'  // Corrected checksum
};
const ABI = {
    c: [{"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
    g: [{"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_timestamp","type":"uint256"}],"name":"beginDispute","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"disputeFee","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
    t: ["function approve(address spender, uint256 amount) public returns (bool)"]
};

let p, s, c = {}, news = [], ltp = null, loading = false, noMore = false, count = 0, autoFetch = true;

const status = (m, e = false) => {
    const el = $('#statusMessage');
    if (el) {
        Object.assign(el.style, { display: 'block', color: e ? 'red' : 'green' });
        el.textContent = m;
    }
};

const init = async () => {
    if (typeof window.ethereum === 'undefined') throw new Error("Ethereum provider not found.");
    p = new ethers.providers.Web3Provider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    s = p.getSigner();
    for (const [k, a] of Object.entries(addr)) {
        c[k] = new ethers.Contract(a, ABI[k], s);
    }
};

const connect = async () => {
    try {
        await init();
        const a = await s.getAddress();
        $('#connectWallet').style.display = 'none';
        $('#walletInfo').style.display = 'block';
        $('#walletAddress').textContent = `${a.slice(0,6)}...${a.slice(-4)}`;
        $('#publishStory').disabled = false;
        status('Wallet connected.');
    } catch (e) {
        status('Wallet connection failed: ' + e.message, true);
    }
};

const svgPaths = {
    Comment: "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
    Like: "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
    Dispute: "M6.72 20.492c1.532.956 3.342 1.508 5.28 1.508 1.934 0 3.741-.55 5.272-1.503l1.24 1.582c-1.876 1.215-4.112 1.921-6.512 1.921-2.403 0-4.642-.708-6.52-1.926l1.24-1.582zM12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm-.5 4.25c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25V12l-2.5.001V5.25zm3.17 12.396l-1.85-.782c-.145-.06-.258-.171-.321-.315l-.82-1.857c-.322-.731-1.336-.731-1.658 0l-.82 1.857c-.063.144-.176.255-.321.315l-1.85.782c-.754.319-.754 1.373 0 1.691l1.85.782c.145.061.258.171.321.315l.82 1.857c.322.731 1.336.731 1.658 0l.82-1.857c.063-.144.176-.254.321-.315l1.85-.782c.754-.318.754-1.372 0-1.691z",
    Vote: "M2.808 1.393l18.384 10.604c.784.453.784 1.553 0 2.006L2.808 24.607c-.76.438-1.689-.177-1.689-1.116V2.51c0-.94.93-1.554 1.689-1.116zM6 12.005l3.948-2.484v4.968L6 12.005z"
};

const render = (items = news) => {
    $('#newsFeed').innerHTML = items.map((i, idx) => `
        <article id="news-item-${idx}" class="news-item">
            <div class="reporter-info">Reporter: ${i.reporter.slice(0,6)}...${i.reporter.slice(-4)} | ${new Date(i.timestamp).toLocaleString()}</div>
            ${i.content.split('\n\n').map(p => `<p class="mb-4">${p.replace(/\n/g, '<br>')}</p>`).join('')}
            <div class="report-actions">
                ${['Comment', 'Like', 'Dispute', 'Vote'].map(a => `
                    <button class="report-action-button ${a.toLowerCase()}-button" onclick="${a.toLowerCase()}News('${i.reporter}', '${i.queryId}', '${i.timestamp}')">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="${svgPaths[a]}"/></svg>${a}
                    </button>
                `).join('')}
            </div>
        </article>
    `).join('');
};

const load = async () => {
    if (!autoFetch || loading || noMore || count >= 100) return;
    loading = true;
    try {
        const r = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${addr.c}/transactions?filter=to&sort=desc&limit=100${ltp ? '&' + new URLSearchParams(ltp).toString() : ''}`);
        const d = await r.json();
        if (d.items.length === 0) { noMore = true; return status("No more transactions available."); }
        d.items.forEach(tx => {
            if (tx.method === 'submitValue' && tx.decoded_input?.parameters?.length >= 4) {
                const [qt, rcb] = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], tx.decoded_input.parameters[3].value);
                if (qt === "StringQuery") {
                    news.push({
                        content: ethers.utils.toUtf8String(rcb),
                        reporter: tx.from,
                        timestamp: tx.timestamp || tx.block_timestamp,
                        queryId: tx.decoded_input.parameters[0].value
                    });
                    count++;
                }
            }
        });
        render();
        ltp = d.next_page_params || null;
        noMore = !ltp;
        if (count < 100 && !noMore) setTimeout(load, 1000);
        else status("News feed fully loaded.");
    } catch (e) { status('Error loading news feed: ' + e.message, true); }
    finally { loading = false; }
};

const submit = async () => {
    const content = $('#reportContent').value.trim();
    if (!content) return status('Please enter a story before submitting.', true);
    $('#publishStory').disabled = true;
    status('Submitting story...');
    try {
        if (!s) throw new Error("Wallet not connected.");
        const qd = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(content)]);
        const qid = ethers.utils.keccak256(qd);
        const n = await c.c.getNewValueCountbyQueryId(qid);
        const v = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(content)]);
        const ge = await c.c.estimateGas.submitValue(qid, v, n, qd);
        const tx = await c.c.submitValue(qid, v, n, qd, { gasLimit: ge.mul(120).div(100) });
        await tx.wait();
        status("Story successfully submitted!");
        $('#reportContent').value = '';
        load();
    } catch (e) { status('Error submitting story: ' + e.message, true); }
    finally { $('#publishStory').disabled = false; }
};

const search = () => {
    autoFetch = false;
    const st = $('#search-input').value.toLowerCase();
    const fi = news.filter(i => i.reporter.toLowerCase().includes(st) || i.content.toLowerCase().includes(st));
    render(fi);
    status(fi.length ? `Found ${fi.length} result(s).` : "No results found.");
    $('#reloadNewsFeed').style.display = 'block';
};

const commentNews = r => console.log(`Comment on news by reporter: ${r}`);
const likeNews = r => console.log(`Like news by reporter: ${r}`);

const getDisputeFee = async () => {
    await init();
    if ((await p.getNetwork()).chainId !== 369) throw new Error("Please connect to PulseChain network");
    return c.g.disputeFee();
};

const beginDispute = async (qid, ts) => {
    try {
        await init();
        if ((await p.getNetwork()).chainId !== 369) throw new Error("Please connect to PulseChain network");
        const df = await getDisputeFee();
        console.log(`Dispute fee: ${ethers.utils.formatEther(df)} TRB`);
        await (await c.t.approve(addr.g, df)).wait();
        const tx = await c.g.beginDispute(qid, ts);
        await tx.wait();
        return tx.hash;
    } catch (e) {
        console.error('Error initiating dispute:', e);
        throw e.message.includes("insufficient funds") ? new Error("Insufficient TRB balance for dispute fee") 
            : e.message.includes("user rejected") ? new Error("Transaction rejected by user") 
            : e;
    }
};

const disputeNews = async (ora, qid, ts) => {
    try {
        const df = await getDisputeFee();
        if (confirm(`Are you sure you want to dispute this report?\n\nReporter: ${ora}\nDispute Fee: ${ethers.utils.formatEther(df)} TRB\n\nThis action will require a transaction and gas fees.`)) {
            const txh = await beginDispute(qid, ts);
            status(`Dispute submitted successfully. Transaction hash: ${txh}`);
        } else {
            status("Dispute cancelled");
        }
    } catch (e) {
        status(`Error submitting dispute: ${e.message}`, true);
    }
};

const voteNews = r => console.log(`Vote on news by reporter: ${r}`);

document.addEventListener('DOMContentLoaded', () => {
    const ta = $('#reportContent');
    const ah = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', ah);
    window.addEventListener('resize', ah);
    ah();

    $('#connectWallet').addEventListener('click', connect);
    $('#publishStory').addEventListener('click', submit);
    $('#search-input').addEventListener('keypress', e => e.key === 'Enter' && search());
    $('#search-button').addEventListener('click', search);
    $('#reloadNewsFeed').addEventListener('click', () => {
        autoFetch = true;
        $('#reloadNewsFeed').style.display = 'none';
        $('#search-input').value = '';
        load();
    });

    load();
});

window.commentNews = commentNews;
window.likeNews = likeNews;
window.disputeNews = disputeNews;
window.voteNews = voteNews;
