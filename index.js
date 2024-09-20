document.addEventListener('DOMContentLoaded', async function () {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;
    let allNewsItems = [];

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

    function displayStatusMessage(message, isError = false) {
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? 'red' : 'green';
        statusMessage.style.display = 'block';
        console.log(`Status Message: ${message}`);
    }

    async function connectWallet() {
        console.log("Connect Wallet button clicked.");
        try {
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
            
            connectWalletButton.style.display = 'none';
            walletInfo.style.display = 'block';
            walletAddress.textContent = shortenAddress(address);
    
            const publishButton = document.getElementById('publishStory');
            publishButton.disabled = false;
            console.log("Publish button enabled:", !publishButton.disabled);
        } catch (e) {
            console.error("Error connecting wallet:", e);
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
        }
    }

    function performSearch() {
        const searchInput = document.getElementById('search-input');
        const searchTerm = searchInput.value.toLowerCase();
        console.log("Performing search with term:", searchTerm);
        
        const filteredItems = allNewsItems.filter(item => 
            item.reporter.toLowerCase().includes(searchTerm) ||
            item.content.toLowerCase().includes(searchTerm)
        );
        
        console.log("Filtered items:", filteredItems);
        renderNewsItems(filteredItems);
        
        if (filteredItems.length === 0) {
            displayStatusMessage("No results found for your search.", false);
        } else {
            displayStatusMessage(`Found ${filteredItems.length} result(s) for your search.`, false);
        }
    }

    function renderNewsItems(items) {
        const newsFeed = document.getElementById('newsFeed');
        newsFeed.innerHTML = ''; // Clear existing items
        items.forEach((item, index) => {
            const article = document.createElement('article');
            article.id = `news-item-${index}`;
            article.className = 'news-item';
            article.innerHTML = displayNews(item.content, item.reporter, item.timestamp);
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

    function displayNews(newsContent, reporterAddress, timestamp) {
        console.log("Displaying news:", { newsContent, reporterAddress, timestamp });
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

        return reporterInfo + content;
    }

    async function loadNewsFeed() {
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
                                    timestamp: tx.timestamp || tx.block_timestamp
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

    window.addEventListener('scroll', () => {
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

    loadNewsFeed();

    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Reload News Feed';
    reloadButton.addEventListener('click', () => {
        console.log("Manual reload of news feed triggered");
        lastTransactionParams = null;
        validTransactionsCount = 0;
        noMoreData = false;
        allNewsItems = [];
        loadNewsFeed();
    });
    document.body.appendChild(reloadButton);
});
