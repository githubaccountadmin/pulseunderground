document.addEventListener('DOMContentLoaded', async function () {
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

            displayStatusMessage('Wallet connected.');
        } catch (e) {
            displayStatusMessage('Could not connect to wallet: ' + e.message, true);
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

            let foundValidTransaction = false;

            for (let tx of data.items) {
                console.log("Checking transaction:", tx);

                let decodedParams = tx.decoded_input ? tx.decoded_input.parameters : null;

                if (decodedParams && decodedParams.length >= 4 && tx.method === 'submitValue') {
                    console.log("Found decoded parameters:", decodedParams);

                    try {
                        const queryDataParam = decodedParams[3].value;

                        // Decode the query data
                        let decodedQueryData = ethers.utils.defaultAbiCoder.decode(['string', 'bytes'], queryDataParam);
                        console.log("Decoded query data:", decodedQueryData);

                        const queryType = decodedQueryData[0];
                        console.log("Decoded query type:", queryType);

                        // Skip non-StringQuery types
                        if (queryType !== "StringQuery") {
                            console.log(`Skipping non-StringQuery transaction of type: ${queryType}`);
                            continue;
                        }

                        const reportContentBytes = decodedQueryData[1];

                        // Safely attempt to decode bytes to string
                        let reportContent = '';
                        try {
                            reportContent = ethers.utils.toUtf8String(reportContentBytes);
                        } catch (utf8Error) {
                            console.warn("Error decoding report content as UTF-8 string:", utf8Error);
                            reportContent = "<Invalid or non-readable content>";
                        }

                        console.log("Decoded report content:", reportContent);

                        const newsFeed = document.getElementById('newsFeed');
                        if (!newsFeed) {
                            console.error("newsFeed element not found!");
                            return;
                        }

                        // Display only the valid report content
                        const article = document.createElement('article');
                        article.innerHTML = `
                            <p>${reportContent}</p>
                        `;
                        newsFeed.appendChild(article);

                        foundValidTransaction = true;
                    } catch (error) {
                        console.error("Error decoding parameters:", error);
                    }
                } else {
                    console.log("Transaction has no or insufficient decoded input data or is not submitValue:", tx);
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
        const reportContent = document.getElementById('reportContent').value;
        console.log("Report content to be submitted:", reportContent);

        if (!signer) {
            console.error("Wallet not connected. Cannot submit story.");
            displayStatusMessage('Wallet not connected. Please connect your wallet first.', true);
            return;
        }

        const contractAddress = '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0';
        const contractABI = [
            {
                "inputs": [
                    { "internalType": "bytes32", "name": "_queryId", "type": "bytes32" },
                    { "internalType": "bytes", "name": "_value", "type": "bytes" },
                    { "internalType": "uint256", "name": "_nonce", "type": "uint256" },
                    { "internalType": "bytes", "name": "_queryData", "type": "bytes" }
                ],
                "name": "submitValue",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    { "internalType": "bytes32", "name": "_queryId", "type": "bytes32" }
                ],
                "name": "getNewValueCountbyQueryId",
                "outputs": [
                    { "internalType": "uint256", "name": "", "type": "uint256" }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];

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

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    console.log("Event listener added to Connect Wallet button.");

    document.getElementById('submitStory').addEventListener('click', submitStory);
    console.log("Event listener added to Publish Story button.");

    loadNewsFeed();
});
