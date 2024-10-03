document.addEventListener('DOMContentLoaded', async () => {
    const ethers = window.ethers;
    const $ = document.querySelector.bind(document);
    
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
        console.log(`Status: ${message}`);
    };

    const shortenAddress = address => {
        if (typeof address !== 'string') {
            console.warn('Invalid address type:', typeof address, address);
            return 'Unknown';
        }
        return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
    };

    const formatTimestamp = timestamp => new Date(timestamp).toLocaleString();

    const renderNews = (items = allNewsItems) => {
        const newsFeed = $('#newsFeed');
        if (!items.length) {
            newsFeed.innerHTML = '';
            return;
        }
        newsFeed.innerHTML = items.map((item, index) => `
            <article id="news-item-${index}" class="news-item">
                <div class="reporter-info">Reporter: ${shortenAddress(item.reporter)} | ${formatTimestamp(item.timestamp)}</div>
                ${item.content.split('\n\n').map(p => `<p class="mb-4">${p.replace(/\n/g, '<br>')}</p>`).join('')}
                <div class="report-actions">
                    ${['Comment', 'Like', 'Dispute', 'Vote'].map(action => 
                        `<button onclick="${action.toLowerCase()}News('${item.reporter}'${action === 'Dispute' ? `, '${item.queryId}', '${item.timestamp}'` : ''})">${action}</button>`
                    ).join('')}
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
                contract = new ethers.Contract(contractAddress, contractABI, signer);
                displayStatus('Wallet connected.');
            } else {
                throw new Error("Ethereum provider not found. Please install MetaMask.");
            }
        } catch (e) {
            console.error("Error connecting wallet:", e);
            displayStatus('Could not connect to wallet: ' + e.message, true);
        }
    };

    const showLoadingIndicator = () => {
        $('#newsFeed').innerHTML = '<div class="loading">Loading news feed...</div>';
    };

    const hideLoadingIndicator = () => {
        $('.loading')?.remove();
    };

    const loadNewsFeed = async () => {
        if (!autoFetchingEnabled || isLoading || noMoreData || validTransactionsCount >= validTransactionLimit) return;
        isLoading = true;
        showLoadingIndicator();
        try {
            const response = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${contractAddress}/transactions?filter=to&sort=desc&limit=100${lastTransactionParams ? '&' + new URLSearchParams(lastTransactionParams).toString() : ''}`);
            const data = await response.json();
            if (data.items.length === 0) {
                noMoreData = true;
                return displayStatus("No more transactions available.");
            }
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
                    }
                }
            });
            renderNews();
            lastTransactionParams = data.next_page_params || null;
            noMoreData = !lastTransactionParams;
            if (validTransactionsCount < validTransactionLimit && !noMoreData) setTimeout(loadNewsFeed, 1000);
            else displayStatus("News feed fully loaded.");
        } catch (error) {
            console.error("Error in loadNewsFeed:", error);
            displayStatus('Error loading news feed: ' + error.message, true);
        } finally {
            isLoading = false;
            hideLoadingIndicator();
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
            console.error("Error submitting story:", error);
            displayStatus('Error submitting story: ' + error.message, true);
        } finally {
            $('#publishStory').disabled = false;
        }
    };

    const performSearch = () => {
        autoFetchingEnabled = false;
        const searchTerm = $('#search-input').value.toLowerCase();
        const filteredItems = allNewsItems.filter(item => 
            item.reporter.toLowerCase().includes(searchTerm) || 
            item.content.toLowerCase().includes(searchTerm)
        );
        renderNews(filteredItems);
        displayStatus(filteredItems.length ? `Found ${filteredItems.length} result(s).` : "No results found.");
        $('#reloadNewsFeed').style.display = 'block';
    };

    // Event listeners and initialization
    const textarea = $('#reportContent');
    const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    textarea.addEventListener('input', adjustHeight);
    window.addEventListener('resize', adjustHeight);
    adjustHeight();

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

    // Expose necessary functions to global scope
    window.commentNews = reporter => console.log(`Comment on news by reporter: ${reporter}`);
    window.likeNews = reporter => console.log(`Like news by reporter: ${reporter}`);
    window.voteNews = reporter => console.log(`Vote on news by reporter: ${reporter}`);
    window.disputeNews = disputeNews;  // This function is defined in dispute.js

    loadNewsFeed();
});
