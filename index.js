import Web3Modal from "https://cdn.jsdelivr.net/npm/web3modal@1.9.0/dist/index.min.js";
import WalletConnectProvider from "https://cdn.jsdelivr.net/npm/@walletconnect/web3-provider@1.6.6/dist/umd/index.min.js";

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");

    let web3Modal;
    let provider;
    let web3;
    let account;

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

    async function loadNewsFeed() {
        console.log("Loading news feed...");
        if (!web3) {
            console.error("Web3 not initialized. Cannot load news feed.");
            return;
        }
        const contractAddress = '0xD9157453E2668B2fc45b7A803D3FEF3642430cC0';
        const contract = new web3.eth.Contract(contractABI, contractAddress);
        const latestBlock = await web3.eth.getBlockNumber();
        console.log("Latest block number:", latestBlock);

        for (let i = latestBlock; i > latestBlock - 100; i--) {  // Fetch last 100 blocks
            const block = await web3.eth.getBlock(i, true);
            for (let tx of block.transactions) {
                if (tx.to === contractAddress) {
                    try {
                        const txReceipt = await web3.eth.getTransactionReceipt(tx.hash);
                        const logs = contract.events.NewReport().processReceipt(txReceipt);

                        for (let log of logs) {
                            const queryData = log.returnValues._queryData;
                            const decodedData = web3.eth.abi.decodeParameters(['string', 'bytes'], queryData);
                            const newsPrefix = decodedData[0];
                            const newsContentEncoded = decodedData[1];
                            const newsContent = web3.eth.abi.decodeParameter('string', newsContentEncoded);

                            const newsFeed = document.getElementById('newsFeed');
                            const article = document.createElement('article');
                            article.innerHTML = `
                                <h3>${newsPrefix}</h3>
                                <p>${newsContent}</p>
                            `;
                            newsFeed.appendChild(article);
                        }
                    } catch (error) {
                        console.error(`Error processing transaction ${tx.hash}:`, error);
                    }
                }
            }
        }
    }

    init(); 
    loadNewsFeed();  
});
