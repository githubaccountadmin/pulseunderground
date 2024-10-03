document.addEventListener('DOMContentLoaded', () => {
    const ethers = window.ethers;
    const $ = id => document.getElementById(id);
    const $$ = selector => document.querySelectorAll(selector);

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

    // Prevent flash of unstyled content
    document.body.style.visibility = 'hidden';

    const init = () => {
        document.body.style.visibility = 'visible';
        loadNewsFeed();
    };

    const displayStatus = (message, isError = false) => {
        const statusEl = $('statusMessage');
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
        const newsFeed = $('newsFeed');
        if (!items.length) {
            newsFeed.innerHTML = '<p>No news items to display.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            const article = document.createElement('article');
            article.id = `news-item-${index}`;
            article.className = 'news-item';
            article.innerHTML = `
                <div class="reporter-info">
                    <img src="newTRBphoto.jpg" alt="Reporter Avatar" class="avatar">
                    <span class="reporter-name">${shortenAddress(item.reporter)}</span>
                    <span class="report-timestamp">${formatTimestamp(item.timestamp)}</span>
                </div>
                <div class="report-content">
                    ${item.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
                </div>
                <div class="report-actions">
                    <button class="report-action-button comment-button" onclick="commentNews('${item.reporter}')">Comment</button>
                    <button class="report-action-button like-button" onclick="likeNews('${item.reporter}')">Like</button>
                    <button class="report-action-button dispute-button" onclick="disputeNews('${item.reporter}', '${item.queryId}', '${item.timestamp}')">Dispute</button>
                    <button class="report-action-button vote-button" onclick="voteNews('${item.reporter}')">Vote</button>
                </div>
            `;
            fragment.appendChild(article);
        });
        newsFeed.innerHTML = '';
        newsFeed.appendChild(fragment);
    };

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                const address = await signer.getAddress();
                $('connectWallet').style.display = 'none';
                $('walletInfo').style.display = 'block';
                $('walletAddress').textContent = shortenAddress(address);
                $('publishStory').disabled = false;
                $('reportContent').placeholder = "What's happening?";
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
        $('reloadNewsFeed').style.display = 'none';
        
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
        const content = $('reportContent').value.trim();
        if (!content) return displayStatus('Please enter a story before submitting.', true);
        $('publishStory').disabled = true;
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
            $('reportContent').value = '';
            loadNewsFeed();
        } catch (error) {
            displayStatus('Error submitting story: ' + error.message, true);
        } finally {
            $('publishStory').disabled = false;
        }
    };

    const performSearch = () => {
        autoFetchingEnabled = false;
        const searchTerm = $('search-input').value.toLowerCase();
        const filteredItems = allNewsItems.filter(item => 
            shortenAddress(item.reporter).toLowerCase().includes(searchTerm) || 
            item.content.toLowerCase().includes(searchTerm)
        );
        renderNews(filteredItems);
        displayStatus(filteredItems.length ? `Found ${filteredItems.length} result(s).` : "No results found.");
        $('reloadNewsFeed').style.display = 'block';
    };

    // Event listeners
    $('connectWallet').addEventListener('click', connectWallet);
    $('publishStory').addEventListener('click', submitStory);
    $('search-input').addEventListener('keypress', e => e.key === 'Enter' && performSearch());
    $('search-button').addEventListener('click', performSearch);
    $('reloadNewsFeed').addEventListener('click', () => {
        autoFetchingEnabled = true;
        $('reloadNewsFeed').style.display = 'none';
        $('search-input').value = '';
        loadNewsFeed();
    });
    $('postButton').addEventListener('click', () => $('reportContent').focus());

    // Textarea auto-resize
    const textarea = $('reportContent');
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

    // Initialize
    window.addEventListener('load', init);
});
