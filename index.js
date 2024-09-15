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
    let validTransactionsCount = 0;  // Counter for valid StringQuery transactions
    const validTransactionLimit = 100; // Min valid StringQuery transactions to fetch before stopping

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
        if (loading || noMoreData || validTransactionsCount >= validTransactionLimit) return;  // Stop if loading, no more data, or if we have 100 valid transactions
        loading = true;
        console.log("loadNewsFeed called. loading:", loading, "noMoreData:", noMoreData);

        let apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${contractAddress}/transactions?filter=to%20%7C%20from&limit=100`;

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

            if (data.items.length === 0) {
                noMoreData = true;  // Set flag if no more data is available
                displayStatusMessage("No more news stories available.", true);
                console.log("No more transactions to load, stopping further requests.");
                loading = false;
                return;
            }

            let newValidTransactions = 0;

            for (let tx of data.items) {
                console.log("Checking transaction:", tx);

                // Only process 'submitValue' transactions
                if (tx.method === 'submitValue') {
                    let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;

                    if (decodedParams && decodedParams.length >= 4) {
                        console.log("Found decoded parameters:", decodedParams);
                        const queryDataParam = decodedParams[3].value;

                        try {
                            let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);
                            console.log("Decoded query data:", decodedQueryData);

                            const queryType = decodedQueryData[0];
                            const reportContentBytes = decodedQueryData[1];

                            if (queryType === "StringQuery") {
                                console.log("StringQuery found in transaction.");

                                let reportContent = '';

                                try {
                                    reportContent = ethers.utils.toUtf8String(reportContentBytes);
                                    console.log("Decoded report content (UTF-8):", reportContent);
                                } catch (utf8Error) {
                                    console.warn("Error decoding report content as UTF-8 string:", utf8Error);
                                    reportContent = "<Invalid or non-readable content>";
                                }

                                const newsFeed = document.getElementById('newsFeed');
                                const article = document.createElement('article');
                                article.innerHTML = `<p>${reportContent}</p>`;
                                newsFeed.appendChild(article);

                                newValidTransactions++;
                                validTransactionsCount++;
                            } else {
                                console.log("Transaction is not a StringQuery.");
                            }
                        } catch (error) {
                            console.error("Error decoding parameters:", error);
                        }
                    }
                } else {
                    console.log("Transaction method not 'submitValue', skipping.");
                }
            }

            if (data.items.length > 0) {
                lastTransactionBlock = data.items[data.items.length - 1].block;  // Track last block for pagination
                console.log("Updated lastTransactionBlock to:", lastTransactionBlock);
            }

            // Automatically fetch more if not enough valid transactions to fill the page
            if (validTransactionsCount < validTransactionLimit && !noMoreData) {
                console.log(`Fetched ${validTransactionsCount} valid StringQuery transactions, fetching more...`);
                loadNewsFeed();  // Trigger another fetch if needed
            } else {
                displayStatusMessage("News feed updated.");
            }

        } catch (error) {
            console.error("Error loading news feed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        } finally {
            loading = false;
            console.log("News feed loading complete. loading set to:", loading);
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const publishButton = document.getElementById('publishStory');
        const reportContentElement = document.getElementById('reportContent');
        const reportContent = reportContentElement.value.trim();

        if (!reportContent) {
            displayStatusMessage('Please enter a story before submitting.', true);
            return;
        }

        publishButton.disabled = true;
        displayStatusMessage('Submitting story...', false);

        try {
            if (!signer) {
                throw new Error("Wallet not connected. Please connect your wallet first.");
            }

            const isUnlocked = await checkIfReporterLocked();
            if (!isUnlocked) {
                throw new Error('Reporter is still locked. Please wait until unlocked.');
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

            const tx = await contract.submitValue(queryId, value, nonce, queryData, { gasLimit: gasEstimate.mul(120).div(100) }); // Add 20% to the gas estimate
            console.log("Transaction submitted, waiting for confirmation...", tx.hash);

            displayStatusMessage("Transaction submitted. Waiting for confirmation...", false);

            const receipt = await tx.wait();
            console.log("Transaction confirmed:", receipt.transactionHash);

            displayStatusMessage("Story successfully submitted!");
            reportContentElement.value = ''; // Clear the input field
            loadNewsFeed(); // Refresh the news feed
        } catch (error) {
            console.error("Error submitting story:", error);
            displayStatusMessage('Error submitting story: ' + error.message, true);
        } finally {
            publishButton.disabled = false;
        }
    }

    async function checkIfReporterLocked() {
        console.log("Checking if reporter is locked...");
        try {
            contract = new ethers.Contract(contractAddress, contractABI, provider);
            const lockTime = await contract.getReportingLock();
            console.log("Reporter lock duration (in seconds):", lockTime);

            const lastTimestamp = await contract.getReporterLastTimestamp(signer.getAddress());
            console.log("Last reporting timestamp:", lastTimestamp);

            const currentTime = Math.floor(Date.now() / 1000);
            const unlockTime = Number(lastTimestamp) + Number(lockTime);

            if (currentTime < unlockTime) {
                const remainingTime = unlockTime - currentTime;
                console.log("Reporter is still locked. Time left (seconds):", remainingTime);
                return false;
            }

            console.log("Reporter is not locked.");
            return true;

        } catch (error) {
            console.error("Error checking if reporter is locked:", error);
            displayStatusMessage('Error checking lock status: ' + error.message, true);
            return false;
        }
    }

    window.addEventListener('scroll', () => {
        console.log('Scroll event detected:', window.scrollY, 'Window height:', window.innerHeight, 'Document height:', document.body.offsetHeight);
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading && !noMoreData) {
            console.log("Triggering news feed load on scroll.");
            loadNewsFeed();
        }
    });

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('publishStory').addEventListener('click', submitStory);

    // Initial load of the news feed
    loadNewsFeed();
});
