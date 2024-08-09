document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed");

    const endpoint = 'https://api.scan.pulsechain.com/api/v2/addresses/0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions?filter=to%20%7C%20from';

    // Function to fetch and display the news feed
    async function loadNewsFeed() {
        console.log("Loading news feed...");
        try {
            const response = await fetch(endpoint);
            const data = await response.json();

            if (data && data.items && data.items.length > 0) {
                const newsFeed = document.getElementById('newsFeed');
                newsFeed.innerHTML = '';  // Clear existing news

                data.items.forEach(tx => {
                    const input = tx.input;

                    // Filter out non-submitValue transactions
                    if (input.startsWith('0x') && input.includes('submitValue')) {
                        const decodedData = decodeSubmitValue(input);
                        const article = document.createElement('article');
                        article.innerHTML = `
                            <h3>${decodedData.queryID}</h3>
                            <p>${decodedData.value}</p>
                            <p>Nonce: ${decodedData.nonce}</p>
                            <p>Data: ${decodedData.queryData}</p>
                        `;
                        newsFeed.appendChild(article);
                    }
                });
            } else {
                console.log("No transactions found.");
            }
        } catch (error) {
            console.error("Error loading news feed:", error);
        }
    }

    // Function to decode the input data of submitValue transactions
    function decodeSubmitValue(input) {
        const web3 = new Web3();  // Use Web3 to decode
        const methodId = input.slice(0, 10);  // Method ID for submitValue
        const params = input.slice(10);  // Remaining part is parameters

        const decodedParams = web3.eth.abi.decodeParameters([
            'bytes32', 'bytes', 'uint256', 'bytes'
        ], params);

        return {
            queryID: decodedParams[0],
            value: web3.utils.hexToUtf8(decodedParams[1]),
            nonce: decodedParams[2],
            queryData: web3.utils.hexToUtf8(decodedParams[3])
        };
    }

    async function init() {
        console.log("Initializing Web3Modal...");
        
        const providerOptions = {
            walletconnect: {
                package: WalletConnectProvider, 
                options: {
                    rpc: {
                        369: "https://rpc.pulsechain.com" // PulseChain RPC
                    },
                    chainId: 369
                }
            }
        };

        try {
            web3Modal = new Web3Modal({
                cacheProvider: false,
                providerOptions,
            });
            console.log("Web3Modal initialized.");
        } catch (e) {
            console.error("Web3Modal initialization failed:", e);
            return;
        }

        const connectWalletButton = document.getElementById('connectWallet');
        console.log("Connect Wallet Button:", connectWalletButton);

        if (connectWalletButton) {
            connectWalletButton.addEventListener('click', onConnect);
            console.log("Event listener added to Connect Wallet button.");
        } else {
            console.error("Connect Wallet button not found.");
        }
    }

    async function onConnect() {
        console.log("Connect Wallet button clicked.");
        try {
            provider = await web3Modal.connect();
            console.log("Wallet connected, provider:", provider);
            web3 = new Web3(provider);
            const accounts = await web3.eth.getAccounts();
            account = accounts[0];
            console.log("Connected account:", account);
        } catch (e) {
            console.error("Could not get a wallet connection", e);
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const title = document.getElementById('title').value;
        const summary = document.getElementById('summary').value;
        const fullArticle = document.getElementById('fullArticle').value;
        const newsContent = `Title: ${title}\nSummary: ${summary}\nFull Article: ${fullArticle}`;
        console.log("News content:", newsContent);
        
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
        const contract = new web3.eth.Contract(contractABI, contractAddress);

        const encodedData = web3.eth.abi.encodeParameter('string', newsContent);
        const queryData = web3.eth.abi.encodeParameters(['string', 'bytes'], ["StringQuery", encodedData]);
        const queryID = web3.utils.keccak256(queryData);
        console.log("Query ID:", queryID);

        const nonce = await contract.methods.getNewValueCountbyQueryId(queryID).call();
        console.log("Nonce:", nonce);

        const newsPrefix = web3.eth.abi.encodeParameter('string', "NEWS");
        const value = web3.eth.abi.encodeParameters(['string', 'bytes'], [newsPrefix, encodedData]);

        console.log("Transaction Parameters:", {
            queryID,
            value,
            nonce,
            queryData
        });

        const transactionParameters = {
            to: contractAddress,
            from: account,
            data: contract.methods.submitValue(queryID, value, nonce, queryData).encodeABI(),
            gas: '2000000',
            gasPrice: web3.utils.toWei('30', 'gwei'),
        };

        try {
            const txHash = await web3.eth.sendTransaction(transactionParameters);
            console.log("Transaction hash:", txHash);
        } catch (error) {
            console.error("Transaction failed:", error);
        }
    }

    document.getElementById('publishStory').addEventListener('click', submitStory);
    console.log("Event listener added to Publish Story button.");

    init(); 
    loadNewsFeed();  
});
