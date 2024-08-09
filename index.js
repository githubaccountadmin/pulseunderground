document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;

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

            localStorage.setItem('walletConnected', 'true');
            displayStatusMessage('Wallet connected.');
        } catch (e) {
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
        }
    }

    function checkWalletConnection() {
        const walletConnected = localStorage.getItem('walletConnected');
        if (walletConnected === 'true') {
            connectWallet();
        }
    }

    checkWalletConnection();

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

            let foundValidTransaction = false;

            for (let tx of data.items) {
                console.log("Checking transaction:", tx);

                const inputData = tx.input || (tx.decoded_input && tx.decoded_input.raw_input);
                
                if (inputData && inputData.startsWith(submitValueFunctionHash)) {
                    console.log("Processing transaction with submitValue function:", inputData);

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

                        const decoded = iface.decodeFunctionData('submitValue', inputData);
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

                        foundValidTransaction = true;
                    } catch (error) {
                        console.error("Error decoding transaction input:", error);
                    }
                } else {
                    console.log("Transaction has no input data:", tx);
                }
            }

            if (!foundValidTransaction) {
                displayStatusMessage("No valid news stories found.", true);
            }
        } catch (error) {
            console.error("Error loading news feed:", error);
            displayStatusMessage('Error loading news feed: ' + error.message, true);
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const title = document.getElementById('title').value;
        const summary = document.getElementById('summary').value;
        const fullArticle = document.getElementById('fullArticle').value;
        const newsContent = `Title: ${title}\nSummary: ${summary}\nFull Article: ${fullArticle}`;
        console.log("News content to be submitted:", newsContent);

        if (!signer) {
            console.error("Wallet not connected. Cannot submit story.");
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

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    console.log("Event listener added to Connect Wallet button.");

    document.getElementById('publishStory').addEventListener('click', submitStory);
    console.log("Event listener added to Publish Story button.");

    loadNewsFeed();
});
