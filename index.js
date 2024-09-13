document.addEventListener('DOMContentLoaded', async function () {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;

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

    let lastTransactionBlock = null;  // To track the block number for pagination
    let loading = false;
    let noMoreData = false;  // Prevents further fetching if no more data

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

    async function loadNewsFeed() {
        if (loading || noMoreData) return;  // Prevents multiple simultaneous calls
        loading = true;
        console.log("loadNewsFeed called. loading:", loading, "noMoreData:", noMoreData);

        let apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions?filter=to%20%7C%20from&limit=100`;

        if (lastTransactionBlock) {
            apiUrl += `&beforeBlock=${lastTransactionBlock}`;
            console.log("Appending block filter:", lastTransactionBlock);
        } else {
            console.log("First page of data, no block filter needed.");
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

            let foundValidTransaction = false;

            if (data.items.length === 0) {
                noMoreData = true;  // Set flag if no more data is available
                displayStatusMessage("No more news stories available.", true);
                console.log("No more transactions to load, stopping further requests.");
                loading = false;
                return;
            }

            for (let tx of data.items) {
                console.log("Checking transaction:", tx);

                let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;

                if (decodedParams && decodedParams.length >= 4) {
                    console.log("Found decoded parameters:", decodedParams);

                    try {
                        const queryDataParam = decodedParams[3].value;
                        console.log("Raw queryDataParam:", queryDataParam);

                        let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);
                        console.log("Decoded query data:", decodedQueryData);

                        const reportContentBytes = decodedQueryData[1];
                        let reportContent = '';

                        try {
                            reportContent = ethers.utils.toUtf8String(reportContentBytes);
                            console.log("Decoded report content (UTF-8):", reportContent);
                        } catch (utf8Error) {
                            console.warn("Error decoding report content as UTF-8 string:", utf8Error);
                            reportContent = "<Invalid or non-readable content>";
                        }

                        // Only append valid report content
                        if (reportContent) {
                            const newsFeed = document.getElementById('newsFeed');
                            if (!newsFeed) {
                                console.error("newsFeed element not found!");
                                return;
                            }

                            const article = document.createElement('article');
                            article.innerHTML = `<p>${reportContent}</p>`;
                            newsFeed.appendChild(article);

                            foundValidTransaction = true;
                        }

                    } catch (error) {
                        console.error("Error decoding parameters:", error);
                    }
                } else {
                    console.log("Transaction has no or insufficient decoded input data:", tx);
                }
            }

            if (data.items.length > 0) {
                lastTransactionBlock = data.items[data.items.length - 1].block;  // Track last block for pagination
                console.log("Updated lastTransactionBlock to:", lastTransactionBlock);
            } else {
                console.log("No more items in the current data set.");
            }

            if (!foundValidTransaction) {
                displayStatusMessage("No valid news stories found.", true);
            }

        } catch (error) {
            console.error("Error loading news feed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        } finally {
            loading = false;
            console.log("News feed loading complete. loading set to:", loading);
        }
    }

    window.addEventListener('scroll', () => {
        console.log('Scroll event detected:', window.scrollY, 'Window height:', window.innerHeight, 'Document height:', document.body.offsetHeight);
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading) {
            console.log("Triggering news feed load on scroll.");
            loadNewsFeed();
        }
    });

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('publishStory').addEventListener('click', submitStory);

    // Initial load of the news feed
    loadNewsFeed();
});
