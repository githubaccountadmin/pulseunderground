document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;

    if (typeof ethers !== 'undefined') {
        console.log("Ethers object: ", "Loaded");
    } else {
        console.log("Ethers object: ", "Not loaded");
    }

    async function connectWallet() {
        console.log("Connect Wallet button clicked.");
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            console.log("Wallet connected, signer:", signer);
        } catch (e) {
            console.error("Could not connect to wallet:", e);
        }
    }

    async function loadNewsFeed() {
        console.log("Loading news feed...");

        const apiUrl = 'https://api.scan.pulsechain.com/api/v2/addresses/0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions?filter=to%20%7C%20from';

        try {
            console.log("Fetching data from API:", apiUrl);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.error("Error fetching data, status:", response.status);
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Data fetched from API:", data);

            const submitValueFunctionHash = ethers.utils.id("submitValue(bytes32,bytes,uint256,bytes)").slice(0, 10);
            console.log("submitValue function hash:", submitValueFunctionHash);

            for (let tx of data.items) {
                if (tx.input && tx.input.startsWith(submitValueFunctionHash)) {
                    console.log("Processing transaction with submitValue function:", tx.input);

                    try {
                        const iface = new ethers.utils.Interface([{
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
                        }]);

                        const decoded = iface.decodeFunctionData('submitValue', tx.input);
                        console.log("Decoded transaction data:", decoded);

                        const newsContent = ethers.utils.toUtf8String(decoded._value);
                        console.log("Decoded news content:", newsContent);

                        const newsFeed = document.getElementById('newsFeed');
                        const article = document.createElement('article');
                        article.innerHTML = `
                            <h3>News</h3>
                            <p>${newsContent}</p>
                        `;
                        newsFeed.appendChild(article);
                    } catch (error) {
                        console.error("Error decoding transaction input:", error);
                    }
                } else {
                    console.log("Skipping transaction, not related to submitValue function.");
                }
            }
        } catch (error) {
            console.error("Error loading news feed:", error);
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const title = document.getElementById('title').value;
        const summary = document.getElementById('summary').value;
        const fullArticle = document.getElementById('fullArticle').value;
        const newsContent = `Title: ${title}\nSummary: ${summary}\nFull Article: ${fullArticle}`;
        console.log("News content to be submitted:", newsContent);

        const statusMessage = document.getElementById('statusMessage');

        if (!signer) {
            console.error("Wallet not connected. Cannot submit story.");
            statusMessage.textContent = "Error: Wallet not connected.";
            return;
        }

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
                    {"internalType": "bytes32", "name": "_queryId", "type": "bytes32"}
                ],
                "name": "isInReporterLock",
                "outputs": [
                    {"internalType": "bool", "name": "", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        try {
            contract = new ethers.Contract(contractAddress, contractABI, signer);

            const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", ethers.utils.toUtf8Bytes(newsContent)]);
            const queryId = ethers.utils.keccak256(queryData);
            console.log("Generated query ID:", queryId);

            const nonce = await contract.getNewValueCountbyQueryId(queryId);
            console.log("Current nonce:", nonce);

            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", ethers.utils.toUtf8Bytes(newsContent)]);
            console.log("Encoded value:", value);

            const isLocked = await contract.isInReporterLock(queryId);
            if (isLocked) {
                console.log("Still in reporter lock. Cannot submit at this time.");
                statusMessage.textContent = "Error: Still in reporter lock. Please try again later.";
                return;
            }

            const gasEstimate = await contract.estimateGas.submitValue(queryId, value, nonce, queryData);
            console.log("Estimated gas:", gasEstimate.toString());

            const tx = await contract.submitValue(queryId, value, nonce, queryData, {
                gasLimit: gasEstimate
            });
            console.log("Transaction sent, hash:", tx.hash);
            statusMessage.textContent = "Story submitted successfully! Transaction hash: " + tx.hash;

        } catch (error) {
            if (error.code === ethers.errors.UNPREDICTABLE_GAS_LIMIT) {
                console.error("Gas estimation failed, likely due to reporter time lock or other issues. Error message:", error.message);
                statusMessage.textContent = "Error: Gas estimation failed. " + error.message;
            } else {
                console.error("Error submitting story:", error);
                statusMessage.textContent = "Error: Could not submit story. " + error.message;
            }
        }
    }

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    console.log("Event listener added to Connect Wallet button.");

    document.getElementById('publishStory').addEventListener('click', submitStory);
    console.log("Event listener added to Publish Story button.");

    loadNewsFeed();
});
