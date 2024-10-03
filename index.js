document.addEventListener('DOMContentLoaded', () => {
    const ethers = window.ethers;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);

    let provider, signer, contract;
    const allNewsItems = [];
    let autoFetchingEnabled = true, isLoading = false, noMoreData = false, validTransactionsCount = 0;
    const validTransactionLimit = 100;
    let lastTransactionParams = null;

    const contractAddress = '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0';
    const contractABI = [
        {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ];

    const displayStatus = (message, isError = false) => {
        const statusEl = $('#statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? 'red' : 'green';
            statusEl.style.display = 'block';
        }
    };

    const shortenAddress = address => {
        if (typeof address === 'string') {
            return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
        } else if (typeof address === 'object' && address.hash) {
            return `${address.hash.slice(0, 6)}...${address.hash.slice(-4)}`;
        }
        return 'Unknown';
    };

    const formatTimestamp = timestamp => new Date(timestamp).toLocaleString();

    const renderNews = (items = allNewsItems) => {
        const newsFeed = $('#newsFeed');
        if (!items.length) {
            newsFeed.innerHTML = '<p>No news items to display.</p>';
            return;
        }
        newsFeed.innerHTML = items.map((item, index) => `
            <article id="news-item-${index}" class="news-item">
                <div class="reporter-info">
                    <img src="newTRBphoto.jpg" alt="Reporter Avatar" class="avatar">
                    <span class="reporter-name">${shortenAddress(item.reporter)}</span>
                    <span class="report-timestamp">${formatTimestamp(item.timestamp)}</span>
                </div>
                <div class="report-content">
                    ${item.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
                </div>
                <div class="report-actions">
                    <button class="report-action-button comment-button" onclick="commentNews('${item.reporter}')">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></svg>
                        Comment
                    </button>
                    <button class="report-action-button like-button" onclick="likeNews('${item.reporter}')">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></svg>
                        Like
                    </button>
                    <button class="report-action-button dispute-button" onclick="disputeNews('${item.reporter}', '${item.queryId}', '${item.timestamp}')">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.72 20.492c1.532.956 3.342 1.508 5.28 1.508 1.934 0 3.741-.55 5.272-1.503l1.24 1.582c-1.876 1.215-4.112 1.921-6.512 1.921-2.403 0-4.642-.708-6.52-1.926l1.24-1.582zM12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm-.5 4.25c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25V12l-2.5.001V5.25zm3.17 12.396l-1.85-.782c-.145-.06-.258-.171-.321-.315l-.82-1.857c-.322-.731-1.336-.731-1.658 0l-.82 1.857c-.063.144-.176.255-.321.315l-1.85.782c-.754.319-.754 1.373 0 1.691l1.85.782c.145.061.258.171.321.315l.82 1.857c.322.731 1.336.731 1.658 0l.82-1.857c.063-.144.176-.254.321-.315l1.85-.782c.754-.318.754-1.372 0-1.691z"></path></svg>
                        Dispute
                    </button>
                    <button class="report-action-button vote-button" onclick="voteNews('${item.reporter}')">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.808 1.393l18.384 10.604c.784.453.784 1.553 0 2.006L2.808 24.607c-.76.438-1.689-.177-1.689-1.116V2.51c0-.94.93-1.554 1.689-1.116zM6 12.005l3.948-2.484v4.968L6 12.005z"></path></svg>
                        Vote
                    </button>
                </div>
            </article>
        `).join('');
    };

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                const address = await signer.getAddress();
                $('#connectWallet').style.display = 'none';
                $('#walletInfo').style.display = 'block';
                $('#walletAddress').textContent = shortenAddress(address);
                $('#publishStory').disabled = false;
                $('#reportContent').placeholder = "What's happening?";
                contract = new ethers.Contract(contractAddress, contractABI, signer);
                displayStatus('Wallet connected.');
            } else {
                throw new Error("Ethereum provider not found. Please install MetaMask.");
            }
        } catch (e) {
            displayStatus('Could not connect to wallet: ' + e.message, true);
        }
    };

    const loadNewsFeed = async () => {
        if (!autoFetchingEnabled || isLoading || noMoreData || validTransactionsCount >= validTransactionLimit) return;
        
        isLoading = true;
        $('#reloadNewsFeed').style.display = 'none';
        
        try {
            const response = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${contractAddress}/transactions?filter=to&sort=desc&limit=100${lastTransactionParams ? '&' + new URLSearchParams(lastTransactionParams).toString() : ''}`);
            const data = await response.json();
            
            if (data.items.length === 0) {
                noMoreData = true;
                displayStatus("No more transactions available.");
                return;
            }
            
            let newItemsAdded = false;
            data.items.forEach(tx => {
                if (tx.method === 'submitValue' && tx.decoded_input?.parameters?.length >= 4) {
                    const [queryType, reportContentBytes] = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], tx.decoded_input.parameters[3].value);
                    if (queryType === "StringQuery") {
                        allNewsItems.push({
                            content: ethers.utils.toUtf8String(reportContentBytes),
                            reporter: tx.from,
                            timestamp: tx.timestamp || tx.block_timestamp,
                            queryId: tx.decoded_input.parameters[0].value
                        });
                        validTransactionsCount++;
                        newItemsAdded = true;
                    }
                }
            });
            
            if (newItemsAdded) {
                renderNews();
            }
            
            lastTransactionParams = data.next_page_params || null;
            noMoreData = !lastTransactionParams;
            
            if (validTransactionsCount < validTransactionLimit && !noMoreData) {
                setTimeout(loadNewsFeed, 1000);
            } else {
                displayStatus("News feed fully loaded.");
            }
        } catch (error) {
            displayStatus('Error loading news feed: ' + error.message, true);
        } finally {
            isLoading = false;
        }
    };

    const submitStory = async () => {
        const content = $('#reportContent').value.trim();
        if (!content) return displayStatus('Please enter a story before submitting.', true);
        $('#publishStory').disabled = true;
        displayStatus('Submitting story...');
        try {
            if (!signer) throw new Error("Wallet not connected.");
            const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(content)]);
            const queryId = ethers.utils.keccak256(queryData);
            const nonce = await contract.getNewValueCountbyQueryId(queryId);
            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(content)]);
            const gasEstimate = await contract.estimateGas.submitValue(queryId, value, nonce, queryData);
            const tx = await contract.submitValue(queryId, value, nonce, queryData, { gasLimit: gasEstimate.mul(120).div(100) });
            await tx.wait();
            displayStatus("Story successfully submitted!");
            $('#reportContent').value = '';
            loadNewsFeed();
        } catch (error) {
            displayStatus('Error submitting story: ' + error.message, true);
        } finally {
            $('#publishStory').disabled = false;
        }
    };

    const performSearch = () => {
        autoFetchingEnabled = false;
        const searchTerm = $('#search-input').value.toLowerCase();
        const filteredItems = allNewsItems.filter(item => 
            shortenAddress(item.reporter).toLowerCase().includes(searchTerm) || 
            item.content.toLowerCase().includes(searchTerm)
        );
        renderNews(filteredItems);
        displayStatus(filteredItems.length ? `Found ${filteredItems.length} result(s).` : "No results found.");
        $('#reloadNewsFeed').style.display = 'block';
    };

    // Event listeners
    $('#connectWallet').addEventListener('click', connectWallet);
    $('#publishStory').addEventListener('click', submitStory);
    $('#search-input').addEventListener('keypress', e => e.key === 'Enter' && performSearch());
    $('#search-button').addEventListener('click', performSearch);
    $('#reloadNewsFeed').addEventListener('click', () => {
        autoFetchingEnabled = true;
        $('#reloadNewsFeed').style.display = 'none';
        $('#search-input').value = '';
        loadNewsFeed();
    });
    $('#postButton').addEventListener('click', () => $('#reportContent').focus());

    // Textarea auto-resize
    const textarea = $('#reportContent');
    const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    textarea.addEventListener('input', adjustHeight);
    window.addEventListener('resize', adjustHeight);
    adjustHeight();

    // Expose necessary functions to global scope
    window.commentNews = reporter => console.log(`Comment on news by reporter: ${shortenAddress(reporter)}`);
    window.likeNews = reporter => console.log(`Like news by reporter: ${shortenAddress(reporter)}`);
    window.voteNews = reporter => console.log(`Vote on news by reporter: ${shortenAddress(reporter)}`);
    window.disputeNews = (reporter, queryId, timestamp) => {
        console.log(`Dispute news by reporter: ${shortenAddress(reporter)}, QueryID: ${queryId}, Timestamp: ${timestamp}`);
        // Call the actual dispute function from dispute.js here
    };

    // Initialize news feed
    loadNewsFeed();
});
