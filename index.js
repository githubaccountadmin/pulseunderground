document.addEventListener('DOMContentLoaded', () => {
    const ethers = window.ethers;
    const $ = id => document.getElementById(id);
    let provider, signer, contract;
    const allNewsItems = [];
    let isLoading = false, noMoreData = false, isSearchActive = false;
    let lastTransactionParams = null;

    const contractAddress = '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0';
    const contractABI = [
        {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ];

    const elements = {
        newsFeed: $('newsFeed'),
        loadMoreButton: $('loadMoreButton'),
        loadingOverlay: $('loadingOverlay'),
        reportContent: $('reportContent'),
        searchInput: $('search-input'),
        publishStory: $('publishStory'),
        connectWallet: $('connectWallet'),
        walletInfo: $('walletInfo'),
        walletAddress: $('walletAddress'),
        postButton: $('postButton'),
        searchButton: $('search-button')
    };

    const showLoading = show => elements.loadingOverlay.style.display = show ? 'flex' : 'none';

    const displayStatus = (message, isError = false) => {
        console.log(isError ? `Error: ${message}` : message);
        // Implement a more visible status display here if needed
    };

    const shortenAddress = address => {
        if (typeof address !== 'string') return 'Unknown';
        return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
    };

    const formatDate = timestamp => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric', 
            minute: 'numeric',
            hour12: true 
        });
    };

    const decodeContent = (reportContentBytes) => {
        try {
            // Remove null bytes from the end
            while (reportContentBytes.length > 0 && reportContentBytes[reportContentBytes.length - 1] === 0) {
                reportContentBytes = reportContentBytes.slice(0, -1);
            }
            return ethers.utils.toUtf8String(reportContentBytes);
        } catch (error) {
            console.warn("Failed to decode content:", error);
            // Attempt to decode as much as possible
            return ethers.utils.toUtf8String(reportContentBytes.slice(0, error.offset), true);
        }
    };

    const renderNews = (items, append = false) => {
        if (!items.length && !append) {
            elements.newsFeed.innerHTML = '<p>No news items to display.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            const article = document.createElement('article');
            article.id = `news-item-${append ? allNewsItems.length + index : index}`;
            article.className = 'news-item';
            article.innerHTML = `
                <div class="reporter-info">
                    <img src="newTRBphoto.jpg" alt="Reporter Avatar" class="avatar">
                    <div class="reporter-details">
                        <span class="reporter-name">${shortenAddress(item.reporter)}</span>
                        <span class="report-timestamp">· ${formatDate(item.timestamp)}</span>
                    </div>
                </div>
                <div class="report-content">
                    ${item.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
                </div>
                <div class="report-actions">
                    <button onclick="commentNews('${item.reporter}')">Comment</button>
                    <button onclick="likeNews('${item.reporter}')">Like</button>
                    <button onclick="disputeNews('${item.reporter}', '${item.queryId}', '${item.timestamp}')">Dispute</button>
                    <button onclick="voteNews('${item.reporter}')">Vote</button>
                </div>
            `;
            fragment.appendChild(article);
        });
        if (!append) elements.newsFeed.innerHTML = '';
        elements.newsFeed.appendChild(fragment);
        elements.newsFeed.style.visibility = 'visible';
    };

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                const address = await signer.getAddress();
                elements.connectWallet.style.display = 'none';
                elements.walletInfo.style.display = 'block';
                elements.walletAddress.textContent = shortenAddress(address);
                elements.publishStory.disabled = false;
                elements.reportContent.placeholder = "What's happening?";
                contract = new ethers.Contract(contractAddress, contractABI, signer);
                displayStatus('Wallet connected.');
            } else {
                throw new Error("Ethereum provider not found. Please install MetaMask.");
            }
        } catch (e) {
            displayStatus('Could not connect to wallet: ' + e.message, true);
        }
    };

    const loadNewsFeed = async (reset = false) => {
        if (isLoading || (noMoreData && !reset)) return;
        isLoading = true;
        showLoading(true);
        
        if (reset) {
            allNewsItems.length = 0;
            noMoreData = false;
            lastTransactionParams = null;
            elements.newsFeed.innerHTML = '';
        }

        const batchSize = 50; // Reduced batch size for quicker initial load

        try {
            const response = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${contractAddress}/transactions?filter=to&sort=desc&limit=${batchSize}${lastTransactionParams ? '&' + new URLSearchParams(lastTransactionParams).toString() : ''}`);
            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                noMoreData = true;
                displayStatus("No new items available.");
                return;
            }

            let newItemsCount = 0;

            for (const tx of data.items) {
                if (tx.method === 'submitValue' && tx.decoded_input?.parameters?.length >= 4) {
                    try {
                        const [queryType, reportContentBytes] = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], tx.decoded_input.parameters[3].value);
                        if (queryType === "StringQuery") {
                            const content = decodeContent(reportContentBytes);
                            if (content.trim()) {
                                const newsItem = {
                                    content: content,
                                    reporter: tx.from.hash || tx.from,
                                    timestamp: tx.timestamp || tx.block_timestamp,
                                    queryId: tx.decoded_input.parameters[0].value
                                };
                                allNewsItems.push(newsItem);
                                renderNews([newsItem], true);
                                newItemsCount++;
                            }
                        }
                    } catch (decodeError) {
                        console.warn("Failed to decode news item:", decodeError);
                    }
                }
            }

            lastTransactionParams = data.next_page_params || null;
            noMoreData = !lastTransactionParams;

            if (newItemsCount > 0) {
                displayStatus(`Loaded ${newItemsCount} new items.`);
                saveToLocalStorage();
            } else {
                displayStatus("No new items available.");
            }

            if (noMoreData) {
                displayStatus("All available news items loaded.");
                elements.loadMoreButton.style.display = 'none';
            } else {
                elements.loadMoreButton.style.display = 'block';
            }
        } catch (error) {
            displayStatus('Error loading news feed: ' + error.message, true);
        } finally {
            isLoading = false;
            showLoading(false);
        }
    };

    const saveToLocalStorage = () => {
        const itemsToSave = allNewsItems.slice(0, 50); // Save only the 50 most recent items
        localStorage.setItem('newsItems', JSON.stringify(itemsToSave));
    };

    const loadFromLocalStorage = () => {
        const savedItems = localStorage.getItem('newsItems');
        if (savedItems) {
            const parsedItems = JSON.parse(savedItems);
            allNewsItems.push(...parsedItems);
            renderNews(parsedItems);
            displayStatus(`Loaded ${parsedItems.length} items from cache.`);
        }
    };

    const submitStory = async () => {
        const content = elements.reportContent.value.trim();
        if (!content) return displayStatus('Please enter a story before submitting.', true);
        elements.publishStory.disabled = true;
        showLoading(true);
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
            elements.reportContent.value = '';
            const newStory = {
                content: content,
                reporter: await signer.getAddress(),
                timestamp: new Date().toISOString(),
                queryId: queryId
            };
            allNewsItems.unshift(newStory);
            renderNews([newStory], true);
            saveToLocalStorage();
        } catch (error) {
            displayStatus('Error submitting story: ' + error.message, true);
        } finally {
            elements.publishStory.disabled = false;
            showLoading(false);
        }
    };

    const performSearch = () => {
        const searchTerm = elements.searchInput.value.toLowerCase();
        const filteredItems = allNewsItems.filter(item => 
            shortenAddress(item.reporter).toLowerCase().includes(searchTerm) || 
            item.content.toLowerCase().includes(searchTerm)
        );
        renderNews(filteredItems);
        displayStatus(filteredItems.length ? `Found ${filteredItems.length} result(s).` : "No results found.");
        isSearchActive = true;
        elements.loadMoreButton.style.display = 'none';
    };

    const clearSearch = () => {
        isSearchActive = false;
        elements.searchInput.value = '';
        renderNews(allNewsItems);
        elements.loadMoreButton.style.display = 'block';
    };

    // Event Listeners
    elements.connectWallet.addEventListener('click', connectWallet);
    elements.publishStory.addEventListener('click', submitStory);
    elements.searchInput.addEventListener('keypress', e => e.key === 'Enter' && performSearch());
    elements.searchButton.addEventListener('click', performSearch);
    elements.loadMoreButton.addEventListener('click', () => loadNewsFeed());
    elements.postButton.addEventListener('click', () => elements.reportContent.focus());
    elements.reportContent.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // Global functions
    window.commentNews = reporter => console.log(`Comment on news by reporter: ${shortenAddress(reporter)}`);
    window.likeNews = reporter => console.log(`Like news by reporter: ${shortenAddress(reporter)}`);
    window.voteNews = reporter => console.log(`Vote on news by reporter: ${shortenAddress(reporter)}`);
    window.disputeNews = (reporter, queryId, timestamp) => {
        console.log(`Dispute news by reporter: ${shortenAddress(reporter)}, QueryID: ${queryId}, Timestamp: ${timestamp}`);
    };

    // Initial load
    loadFromLocalStorage();
    loadNewsFeed();
});
