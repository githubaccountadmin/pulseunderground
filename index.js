document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;
    let nextPageParams = null; // For pagination
    let loadingMore = false;   // To prevent multiple simultaneous loads
    let allDataLoaded = false; // Flag to indicate if all data has been loaded
    let loadedTransactions = new Set(); // To keep track of processed transactions

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
        },
        {
            "inputs": [
                {"internalType": "address", "name": "_reporter", "type": "address"}
            ],
            "name": "getReporterLastTimestamp",
            "outputs": [
                {"internalType": "uint256", "name": "", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getReportingLock",
            "outputs": [
                {"internalType": "uint256", "name": "", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "bytes32", "name": "_queryId", "type": "bytes32"},
                {"internalType": "uint256", "name": "_index", "type": "uint256"}
            ],
            "name": "getReportTimestamp",
            "outputs": [
                {"internalType": "uint256", "name": "", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    function displayStatusMessage(message, isError = false) {
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? 'red' : 'green';
        statusMessage.style.display = 'block';
    }

    async function connectWallet() {
        console.log("Connect Wallet button clicked.");
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            console.log("Wallet connected, signer:", signer);

            displayStatusMessage('Wallet connected.');
        } catch (e) {
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
        }
    }

    async function loadNewsFeed(isInitialLoad = true) {
        console.log("Loading news feed...");

        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        let apiUrl = 'https://api.scan.pulsechain.com/api/v2/addresses/' +
                     '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions' +
                     '?filter=to%20%7C%20from&limit=50';

        if (nextPageParams) {
            apiUrl += `&${nextPageParams}`;
        }

        try {
            console.log("Fetching data from API:", apiUrl);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.error("Error fetching data, status:", response.status);
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Data fetched from API:", data);

            nextPageParams = data.next_page_params || null;
            if (!nextPageParams) {
                allDataLoaded = true;
            }

            let foundValidTransaction = false;

            for (let tx of data.items) {
                // Skip transactions we've already processed
                if (loadedTransactions.has(tx.hash)) {
                    continue;
                }

                console.log("Checking transaction:", tx);

                let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;

                if (decodedParams && decodedParams.length >= 4) {
                    console.log("Found decoded parameters:", decodedParams);

                    try {
                        const methodName = tx.method;
                        const queryDataParam = decodedParams[3].value;

                        // Only process if the method is 'submitValue'
                        if (methodName !== 'submitValue') {
                            continue;
                        }

                        let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);
                        console.log("Decoded query data:", decodedQueryData);

                        if (decodedQueryData[0] === "StringQuery") {
                            const reportContentBytes = decodedQueryData[1];
                            let reportContent = '';

                            try {
                                reportContent = ethers.utils.toUtf8String(reportContentBytes);
                            } catch (utf8Error) {
                                console.warn("Error decoding report content as UTF-8 string:", utf8Error);
                                reportContent = "<Invalid or non-readable content>";
                            }

                            console.log("Decoded report content:", reportContent);

                            if (reportContent && reportContent !== "<Invalid or non-readable content>") {
                                const newsFeed = document.getElementById('newsFeed');
                                if (!newsFeed) {
                                    console.error("newsFeed element not found!");
                                    return;
                                }

                                // Get the timestamp and reporter address
                                const timestamp = new Date(tx.timestamp * 1000).toLocaleString();
                                const reporterAddress = tx.from;

                                const article = document.createElement('article');

                                const metadataDiv = document.createElement('div');
                                metadataDiv.className = 'metadata';
                                metadataDiv.innerHTML = `<strong>Reporter:</strong> ${reporterAddress} <br> <strong>Submitted on:</strong> ${timestamp}`;

                                const p = document.createElement('p');
                                p.textContent = reportContent; // Use textContent to prevent XSS

                                article.appendChild(metadataDiv);
                                article.appendChild(p);
                                newsFeed.appendChild(article);

                                foundValidTransaction = true;
                            }
                        }
                    } catch (error) {
                        console.error("Error decoding parameters:", error);
                    }
                } else {
                    console.log("Transaction has no or insufficient decoded input data:", tx);
                }

                // Mark this transaction as processed
                loadedTransactions.add(tx.hash);
            }

            if (!foundValidTransaction && !allDataLoaded) {
                console.log("No valid news stories found in this batch. Loading more...");
                await loadNewsFeed(false); // Recursive call to load more data
            } else if (!foundValidTransaction && allDataLoaded && isInitialLoad) {
                displayStatusMessage("No valid news stories found.", true);
            }
        } catch (error) {
            console.error("Error loading news feed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        } finally {
            loadingMore = false;
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    async function checkIfReporterLocked() {
        console.log("Checking if reporter is locked...");

        try {
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            const reporterAddress = await signer.getAddress();

            // Fetch the reporter's last timestamp (when they last reported)
            const lastReportTimestamp = await contract.getReporterLastTimestamp(reporterAddress);

            // Fetch the reporting lock duration (in seconds)
            const reportingLock = await contract.getReportingLock();

            // Get the current time in seconds
            const currentBlock = await provider.getBlock('latest');
            const currentTime = currentBlock.timestamp;

            // Calculate the time difference
            const timeSinceLastReport = currentTime - lastReportTimestamp;

            if (timeSinceLastReport < reportingLock) {
                const remainingLockTime = reportingLock - timeSinceLastReport;
                const hours = Math.floor(remainingLockTime / 3600);
                const minutes = Math.floor((remainingLockTime % 3600) / 60);
                const seconds = remainingLockTime % 60;

                console.log(`Reporter is locked. Time left: ${hours}h ${minutes}m ${seconds}s`);
                alert(`Reporter is locked. Time left: ${hours}h ${minutes}m ${seconds}s`);
                return false;
            } else {
                console.log('Reporter is unlocked.');
                return true;
            }
        } catch (error) {
            console.error('Error checking reporter lock status:', error);
            return false;
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const reportContent = document.getElementById('reportContent').value;
        console.log("Report content to be submitted:", reportContent);

        if (!signer) {
            console.error("Wallet not connected. Cannot submit story.");
            displayStatusMessage('Wallet not connected. Please connect your wallet first.', true);
            return;
        }

        const isUnlocked = await checkIfReporterLocked();
        if (!isUnlocked) {
            displayStatusMessage('Reporter is still locked. Please wait until unlocked.', true);
            return;
        }

        try {
            contract = new ethers.Contract(contractAddress, contractABI, signer);

            const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(reportContent)]);
            const queryId = ethers.utils.keccak256(queryData);
            console.log("Generated query ID:", queryId);

            const nonce = await contract.getNewValueCountbyQueryId(queryId);
            console.log("Current nonce:", nonce);

            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(reportContent)]);
            console.log("Encoded value:", value);

            const gasEstimate = await contract.estimateGas.submitValue(queryId, value, nonce, queryData);
            console.log("Estimated gas:", gasEstimate.toString());

            try {
                const tx = await contract.submitValue(queryId, value, nonce, queryData, { gasLimit: gasEstimate.add(100000) });
                displayStatusMessage(`Transaction submitted successfully! Hash: ${tx.hash}`);
            } catch (error) {
                console.error("Error submitting story:", error);
                displayStatusMessage('Error submitting story: ' + error.message, true);
            }

        } catch (error) {
            console.error("Error during story submission process:", error);
            displayStatusMessage('Error during story submission process: ' + error.message, true);
        }
    }

    function setupInfiniteScroll() {
        const sentinel = document.createElement('div');
        sentinel.id = 'sentinel';
        document.body.appendChild(sentinel);

        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !loadingMore && !allDataLoaded) {
                loadingMore = true;
                await loadNewsFeed(false);
            }
        }, {
            rootMargin: '0px',
            threshold: 0.1
        });

        observer.observe(sentinel);
    }

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    console.log("Event listener added to Connect Wallet button.");

    document.getElementById('publishStory').addEventListener('click', submitStory);
    console.log("Event listener added to Publish Story button.");

    // Setup infinite scrolling
    setupInfiniteScroll();
    console.log("Infinite scroll setup complete.");

    // Add a loading indicator element
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.style.display = 'none';
    loadingIndicator.textContent = 'Loading...';
    document.body.appendChild(loadingIndicator);

    loadNewsFeed();
});
