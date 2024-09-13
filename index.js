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

    let lastTransactionBlock = null;
    let loading = false;
    let noMoreData = false;

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
            displayStatusMessage('Wallet connected.');
        } catch (e) {
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
        }
    }

    async function loadNewsFeed() {
        if (loading || noMoreData) return;
        loading = true;
        console.log("loadNewsFeed called. loading:", loading, "noMoreData:", noMoreData);

        let apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions?filter=to%20%7C%20from&limit=100`;

        if (lastTransactionBlock) {
            apiUrl += `&beforeBlock=${lastTransactionBlock}`;
            console.log("Appending block filter:", lastTransactionBlock);
        }

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

            const data = await response.json();
            let foundValidTransaction = false;

            if (data.items.length === 0) {
                noMoreData = true;
                displayStatusMessage("No more news stories available.", true);
                console.log("No more transactions to load, stopping further requests.");
                loading = false;
                return;
            }

            for (let tx of data.items) {
                console.log("Checking transaction:", tx);
                let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;

                if (decodedParams && decodedParams.length >= 4) {
                    try {
                        const queryDataParam = decodedParams[3].value;
                        let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);

                        const reportContentBytes = decodedQueryData[1];
                        let reportContent = ethers.utils.toUtf8String(reportContentBytes);
                        const newsFeed = document.getElementById('newsFeed');
                        const article = document.createElement('article');
                        article.innerHTML = `<p>${reportContent}</p>`;
                        newsFeed.appendChild(article);

                        foundValidTransaction = true;
                    } catch (error) {
                        console.warn("Error decoding transaction:", error);
                    }
                }
            }

            if (data.items.length > 0) {
                lastTransactionBlock = data.items[data.items.length - 1].block;
                console.log("Updated lastTransactionBlock to:", lastTransactionBlock);
            }

            if (!foundValidTransaction) {
                displayStatusMessage("No valid news stories found.", true);
            }

        } catch (error) {
            console.error("Error loading news feed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        } finally {
            loading = false;
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const reportContent = document.getElementById('reportContent').value;
        if (!signer) {
            displayStatusMessage('Wallet not connected. Please connect your wallet first.', true);
            return;
        }

        try {
            const isUnlocked = await checkIfReporterLocked();
            if (!isUnlocked) return;

            contract = new ethers.Contract(contractAddress, contractABI, signer);
            const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(reportContent)]);
            const queryId = ethers.utils.keccak256(queryData);
            const nonce = await contract.getNewValueCountbyQueryId(queryId);
            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(reportContent)]);

            const gasEstimate = await contract.estimateGas.submitValue(queryId, value, nonce, queryData);
            const tx = await contract.submitValue(queryId, value, nonce, queryData, { gasLimit: gasEstimate.add(100000) });
            displayStatusMessage(`Transaction submitted successfully! Hash: ${tx.hash}`);

        } catch (error) {
            console.error("Error during story submission:", error);
            displayStatusMessage('Error during story submission: ' + error.message, true);
        }
    }

    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading) {
            loadNewsFeed();
        }
    });

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('publishStory').addEventListener('click', submitStory);

    loadNewsFeed();
});
