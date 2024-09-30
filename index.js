document.addEventListener('DOMContentLoaded', async function () {
    console.log("DOM fully loaded and parsed");

    const ethers = window.ethers;

    let provider;
    let signer;
    let contract;
    let allNewsItems = [];
    let autoFetchingEnabled = true;

    const contractAddress = '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0';
    const contractABI = [
        {
            "inputs": [
                {"internalType": "bytes32", "name": "_queryId", "type": "bytes32"},
                {"internalType": "bytes", "name": "_value", "type": "bytes"},
                {"internalType": "uint256", "name": "_nonce", "type": "uint256"},
                {"internalType": "bytes", "name": "_queryData", "type": "bytes"}
            ],
            "name": "submitValue",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "bytes32", "name": "_queryId", "type": "bytes32"}
            ],
            "name": "getNewValueCountbyQueryId",
            "outputs": [
                {"internalType": "uint256", "name": "", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    let lastTransactionParams = null;
    let loading = false;
    let noMoreData = false;
    let validTransactionsCount = 0;
    const validTransactionLimit = 100;

    // Add the new code for dynamic textarea here
    const textarea = document.getElementById('reportContent');
    
    function adjustHeight() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    textarea.addEventListener('input', adjustHeight);
    window.addEventListener('resize', adjustHeight);

    // Initial call to set the correct height
    adjustHeight();

    function displayStatusMessage(message, isError = false) {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.style.color = isError ? 'red' : 'green';
            statusMessage.style.display = 'block';
            console.log(`Status Message: ${message}`);
        } else {
            console.error('Status message element not found');
        }
    }

    async function connectWallet() {
        console.log("Connect Wallet button clicked.");
        try {
            if (typeof window.ethereum !== 'undefined') {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                signer = provider.getSigner();
                console.log("Wallet connected, signer:", signer);
        
                const address = await signer.getAddress();
                console.log("Connected wallet address:", address);
        
                displayStatusMessage('Wallet connected.');
                
                const connectWalletButton = document.getElementById('connectWallet');
                const walletInfo = document.getElementById('walletInfo');
                const walletAddress = document.getElementById('walletAddress');
                
                if (connectWalletButton) connectWalletButton.style.display = 'none';
                if (walletInfo) walletInfo.style.display = 'block';
                if (walletAddress) walletAddress.textContent = shortenAddress(address);
        
                const publishButton = document.getElementById('publishStory');
                if (publishButton) {
                    publishButton.disabled = false;
                    console.log("Publish button enabled:", !publishButton.disabled);
                }
            } else {
                throw new Error("Ethereum provider not found. Please install MetaMask or a similar wallet.");
            }
        } catch (e) {
            console.error("Error connecting wallet:", e);
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
        }
    }

    function performSearch() {
        autoFetchingEnabled = false; // Pause auto-fetching
        const searchInput = document.getElementById('search-input');
        if (!searchInput) {
            console.error("Search input element not found");
            return;
        }
        const searchTerm = searchInput.value.toLowerCase();
        console.log("Performing search with term:", searchTerm);
        
        const filteredItems = allNewsItems.filter(item => {
            const reporterAddress = typeof item.reporter === 'object' && item.reporter.hash 
                ? item.reporter.hash.toLowerCase() 
                : (typeof item.reporter === 'string' ? item.reporter.toLowerCase() : '');
            return reporterAddress.includes(searchTerm) ||
                   item.content.toLowerCase().includes(searchTerm);
        });
        
        console.log("Filtered items:", filteredItems);
        renderNewsItems(filteredItems);
        
        if (filteredItems.length === 0) {
            displayStatusMessage("No results found for your search.", false);
        } else {
            displayStatusMessage(`Found ${filteredItems.length} result(s) for your search.`, false);
        }

        // Show the reload button
        const reloadButton = document.getElementById('reloadNewsFeed');
        if (reloadButton) reloadButton.style.display = 'block';
    }

    function renderNewsItems(items) {
        const newsFeed = document.getElementById('newsFeed');
        if (!newsFeed) {
            console.error("News feed element not found");
            return;
        }
        newsFeed.innerHTML = ''; // Clear existing items
        items.forEach((item, index) => {
            const article = document.createElement('article');
            article.id = `news-item-${index}`;
            article.className = 'news-item';
            article.innerHTML = displayNews(item.content, item.reporter, item.timestamp, item.queryId);
            newsFeed.appendChild(article);
        });
    }
    
    function shortenAddress(address) {
        console.log("Shortening address:", address);
        if (typeof address === 'object' && address.hash) {
            return `${address.hash.slice(0, 6)}...${address.hash.slice(-4)}`;
        }
        if (typeof address === 'string') {
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
        return 'Unknown';
    }

    function formatTimestamp(timestamp) {
        console.log("Formatting timestamp:", timestamp);
        if (timestamp && typeof timestamp === 'string') {
            try {
                const date = new Date(timestamp);
                return date.toLocaleString();
            } catch (error) {
                console.error("Error parsing timestamp:", error);
            }
        }
        return 'Unknown time';
    }

    function displayNews(newsContent, reporterAddress, timestamp, queryId) {
        console.log("Displaying news:", { newsContent, reporterAddress, timestamp, queryId });
        const PARAGRAPH_SEPARATOR = '\n\n';
        const LINE_BREAK = '\n';
        
        const paragraphs = newsContent.split(PARAGRAPH_SEPARATOR);
        const reporterInfo = `
            <div class="reporter-info">
                Reporter: ${shortenAddress(reporterAddress)} | ${formatTimestamp(timestamp)}
            </div>
        `;
        
        const content = paragraphs.map(paragraph => {
            const lines = paragraph.split(LINE_BREAK);
            return `<p class="mb-4">${lines.map(line => line.trim()).join('<br>')}</p>`;
        }).join('');
    
        const actionButtons = `
            <div class="report-actions">
                <button class="report-action-button comment-button" onclick="commentOnNews('${reporterAddress}')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></svg>
                    Comment
                </button>
                <button class="report-action-button like-button" onclick="likeNews('${reporterAddress}')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></svg>
                    Like
                </button>
                <button class="report-action-button dispute-button" onclick="disputeNews('${reporterAddress}', '${queryId}', ${timestamp})">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.72 20.492c1.532.956 3.342 1.508 5.28 1.508 1.934 0 3.741-.55 5.272-1.503l1.24 1.582c-1.876 1.215-4.112 1.921-6.512 1.921-2.403 0-4.642-.708-6.52-1.926l1.24-1.582zM12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm-.5 4.25c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25V12l-2.5.001V5.25zm3.17 12.396l-1.85-.782c-.145-.06-.258-.171-.321-.315l-.82-1.857c-.322-.731-1.336-.731-1.658 0l-.82 1.857c-.063.144-.176.255-.321.315l-1.85.782c-.754.319-.754 1.373 0 1.691l1.85.782c.145.061.258.171.321.315l.82 1.857c.322.731 1.336.731 1.658 0l.82-1.857c.063-.144.176-.254.321-.315l1.85-.782c.754-.318.754-1.372 0-1.691z"></path></svg>
                    Dispute
                </button>
                <button class="report-action-button vote-button" onclick="voteOnDispute('${reporterAddress}')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.808 1.393l18.384 10.604c.784.453.784 1.553 0 2.006L2.808 24.607c-.76.438-1.689-.177-1.689-1.116V2.51c0-.94.93-1.554 1.689-1.116zM6 12.005l3.948-2.484v4.968L6 12.005z"></path></svg>
                    Vote
                </button>
            </div>
        `;
    
        return reporterInfo + content + actionButtons;
    }
    
    // Placeholder functions for the new buttons
    function commentOnNews(reporterAddress) {
        console.log(`Comment on news by reporter: ${reporterAddress}`);
        // Implement comment functionality here
    }
    
    function likeNews(reporterAddress) {
        console.log(`Like news by reporter: ${reporterAddress}`);
        // Implement like functionality here
    }
    
    async function disputeNews(originalReporterAddress, queryId, timestamp) {
        console.log(`Initiating dispute for report by: ${originalReporterAddress}`);
        
        // Fetch the current dispute fee
        let disputeFee;
        try {
            disputeFee = await window.getDisputeFee();
            disputeFee = ethers.utils.formatEther(disputeFee);
        } catch (error) {
            console.error("Error fetching dispute fee:", error);
            displayStatusMessage(`Error fetching dispute fee: ${error.message}`, true);
            return;
        }
    
        // Confirmation dialog
        const confirmMessage = `Are you sure you want to dispute this report?\n\nReporter: ${originalReporterAddress}\nDispute Fee: ${disputeFee} TRB\n\nThis action will require a transaction and gas fees.`;
        
        if (confirm(confirmMessage)) {
            try {
                const txHash = await window.disputeNews(originalReporterAddress, queryId, timestamp);
                displayStatusMessage(`Dispute submitted successfully. Transaction hash: ${txHash}`, false);
            } catch (error) {
                displayStatusMessage(`Error submitting dispute: ${error.message}`, true);
            }
        } else {
            console.log("Dispute cancelled by user");
            displayStatusMessage("Dispute cancelled", false);
        }
    }
    
    function voteOnDispute(reporterAddress) {
        console.log(`Vote on dispute for news by reporter: ${reporterAddress}`);
        // Implement voting functionality here
    }

    async function loadNewsFeed() {
        if (!autoFetchingEnabled) {
            console.log("Auto-fetching is paused.");
            return;
        }
        console.log("loadNewsFeed called. Current state:", { loading, noMoreData, validTransactionsCount });
        if (loading || noMoreData || validTransactionsCount >= validTransactionLimit) {
            console.log("Skipping loadNewsFeed due to current state.");
            return;
        }

        loading = true;
        console.log("Setting loading to true");

        let apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${contractAddress}/transactions?filter=to&sort=desc&limit=100`;

        if (lastTransactionParams) {
            Object.keys(lastTransactionParams).forEach(key => {
                apiUrl += `&${key}=${lastTransactionParams[key]}`;
            });
            console.log("Appending pagination params:", lastTransactionParams);
        }

        try {
            console.log("Fetching data from API:", apiUrl);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Data fetched from API:", data);

            if (data.items.length === 0) {
                console.log("No items returned from API");
                noMoreData = true;
                displayStatusMessage("No more transactions available.");
                return;
            }

            let newValidTransactions = 0;

            for (let tx of data.items) {
                console.log("Processing transaction:", tx.hash, "Method:", tx.method);
        
                if (tx.method === 'submitValue') {
                    let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;
        
                    if (decodedParams && decodedParams.length >= 4) {
                        const queryDataParam = decodedParams[3].value;
        
                        try {
                            let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);
                            const queryType = decodedQueryData[0];
                            const reportContentBytes = decodedQueryData[1];
        
                            console.log("Decoded query type:", queryType);
        
                            if (queryType === "StringQuery") {
                                console.log("StringQuery found in transaction:", tx.hash);
        
                                let reportContent = '';
        
                                try {
                                    reportContent = ethers.utils.toUtf8String(reportContentBytes);
                                    console.log("Decoded report content (UTF-8):", reportContent);
                                } catch (utf8Error) {
                                    console.warn("Error decoding report content as UTF-8 string:", utf8Error);
                                    reportContent = "<Invalid or non-readable content>";
                                }
        
                                const newsItem = {
                                    content: reportContent,
                                    reporter: tx.from,
                                    timestamp: tx.timestamp || tx.block_timestamp,
                                    queryId: decodedParams[0].value // Add this line to include queryId
                                };
                                allNewsItems.push(newsItem);
        
                                newValidTransactions++;
                                validTransactionsCount++;
                            }
                        } catch (error) {
                            console.error("Error decoding parameters for transaction:", tx.hash, error);
                        }
                    }
                }
            }
            
            renderNewsItems(allNewsItems);
            console.log("All news items after loading:", allNewsItems);

            if (data.next_page_params) {
                lastTransactionParams = data.next_page_params;
                console.log("Updated lastTransactionParams to:", lastTransactionParams);
            } else {
                noMoreData = true;
                console.log("No more pages available");
            }

            console.log(`Processed ${data.items.length} transactions, found ${newValidTransactions} new valid transactions`);

            if (newValidTransactions === 0) {
                console.log("No new valid transactions found in this batch");
            }

            if (validTransactionsCount < validTransactionLimit && !noMoreData) {
                console.log(`Fetched ${validTransactionsCount} valid StringQuery transactions, fetching more...`);
                setTimeout(() => loadNewsFeed(), 1000);
            } else {
                console.log(`Reached ${validTransactionLimit} valid transactions or no more data, stopping further requests`);
                displayStatusMessage("News feed fully loaded.");
            }

        } catch (error) {
            console.error("Error in loadNewsFeed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        } finally {
            loading = false;
            console.log("News feed loading complete. loading set to:", loading);
        }
    }

    async function submitStory() {
        console.log("Submit Story function called");
        const publishButton = document.getElementById('publishStory');
        const reportContentElement = document.getElementById('reportContent');
        if (!publishButton || !reportContentElement) {
            console.error("Required elements for story submission not found");
            return;
        }
        const reportContent = reportContentElement.value.trim();

        console.log("Current report content:", reportContent);
        console.log("Publish button state before submission:", publishButton.disabled ? "disabled" : "enabled");

        if (!reportContent) {
            console.log("Empty report content, aborting submission");
            displayStatusMessage('Please enter a story before submitting.', true);
            return;
        }

        publishButton.disabled = true;
        console.log("Publish button disabled for submission");
        displayStatusMessage('Submitting story...', false);

        try {
            if (!signer) {
                throw new Error("Wallet not connected. Please connect your wallet first.");
            }

            contract = new ethers.Contract(contractAddress, contractABI, signer);

            const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(reportContent)]);
            const queryId = ethers.utils.keccak256(queryData);
            console.log("Generated query ID:", queryId);

            const nonce = await contract.getNewValueCountbyQueryId(queryId);
            console.log("Current nonce:", nonce);

            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(reportContent)]);
            console.log("Encoded value:", value);

            const gasEstimate = await contract.estimateGas.submitValue(queryId, value, nonce, queryData);
            console.log("Estimated gas for submitValue:", gasEstimate.toString());

            const tx = await contract.submitValue(queryId, value, nonce, queryData, { gasLimit: gasEstimate.mul(120).div(100) });
            console.log("Transaction submitted, waiting for confirmation...", tx.hash);

            displayStatusMessage("Transaction submitted. Waiting for confirmation...", false);

            const receipt = await tx.wait();
            console.log("Transaction confirmed:", receipt.transactionHash);

            console.log("Story submitted successfully");
            displayStatusMessage("Story successfully submitted!");
            reportContentElement.value = '';
            loadNewsFeed();
        } catch (error) {
            console.error("Error submitting story:", error);
            displayStatusMessage('Error submitting story: ' + error.message, true);
        } finally {
            publishButton.disabled = false;
            console.log("Publish button re-enabled");
        }
    }

    function resumeAutoFetching() {
        autoFetchingEnabled = true;
        const reloadButton = document.getElementById('reloadNewsFeed');
        const searchInput = document.getElementById('search-input');
        if (reloadButton) reloadButton.style.display = 'none';
        if (searchInput) searchInput.value = ''; // Clear search input
        loadNewsFeed(); // Immediately fetch new data
    }

    window.addEventListener('scroll', () => {
        if (!autoFetchingEnabled) return; // Don't fetch if auto-fetching is disabled
        console.log('Scroll event detected:', window.scrollY, 'Window height:', window.innerHeight, 'Document height:', document.body.offsetHeight);
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading && !noMoreData) {
            console.log("Triggering news feed load on scroll.");
            loadNewsFeed();
        }
    });

    const connectWalletButton = document.getElementById('connectWallet');
    const publishButton = document.getElementById('publishStory');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const reloadNewsFeedButton = document.getElementById('reloadNewsFeed');

    if (connectWalletButton) {
        connectWalletButton.addEventListener('click', connectWallet);
        console.log("Connect Wallet button event listener added");
    } else {
        console.error("Connect Wallet button not found in the DOM");
    }
    
    if (publishButton) {
        publishButton.addEventListener('click', submitStory);
        console.log("Publish Story button event listener added");
    } else {
        console.error("Publish Story button not found in the DOM");
    }
    
    if (publishButton) {
        publishButton.disabled = true;
        console.log("Publish button initial state:", publishButton.disabled ? "disabled" : "enabled");
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                performSearch();
            }
        });
        console.log("Search input event listener added");
    } else {
        console.error("Search input not found in the DOM");
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
        console.log("Search button event listener added");
    } else {
        console.error("Search button not found in the DOM");
    }
    
    if (reloadNewsFeedButton) {
        reloadNewsFeedButton.addEventListener('click', resumeAutoFetching);
        console.log("Reload News Feed button event listener added");
    } else {
        console.error("Reload News Feed button not found in the DOM");
    }
    
    loadNewsFeed();
});
