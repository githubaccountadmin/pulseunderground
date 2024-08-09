// Connect to PulseChain
let web3;
let account;
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
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "_queryId", "type": "bytes32"},
            {"indexed": True, "internalType": "uint256", "name": "_time", "type": "uint256"},
            {"indexed": False, "internalType": "bytes", "name": "_value", "type": "bytes"},
            {"indexed": False, "internalType": "uint256", "name": "_nonce", "type": "uint256"},
            {"indexed": False, "internalType": "bytes", "name": "_queryData", "type": "bytes"},
            {"indexed": True, "internalType": "address", "name": "_reporter", "type": "address"}
        ],
        "name": "NewReport",
        "type": "event"
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
        "name": "reportingLock",
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
        "name": "getStakeAmount",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "requiredStakeAmount",
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
        "name": "getNewValueCountbyQueryId",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

async function connectWallet() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        await window.ethereum.enable();
        const accounts = await web3.eth.getAccounts();
        account = accounts[0];
        console.log("Connected account:", account);
    } else {
        alert("Please install MetaMask!");
    }
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);

async function submitStory() {
    const title = document.getElementById('title').value;
    const summary = document.getElementById('summary').value;
    const fullArticle = document.getElementById('fullArticle').value;
    const newsContent = `Title: ${title}\nSummary: ${summary}\nFull Article: ${fullArticle}`;
    
    const contract = new web3.eth.Contract(contractABI, contractAddress);

    // Encode the StringQuery data
    const encodedData = web3.eth.abi.encodeParameter('string', newsContent);
    const queryData = web3.eth.abi.encodeParameters(['string', 'bytes'], ["StringQuery", encodedData]);
    const queryID = web3.utils.keccak256(queryData);

    // Get the correct nonce using getNewValueCountbyQueryId
    const nonce = await contract.methods.getNewValueCountbyQueryId(queryID).call();

    // Prepend "NEWS" to the value
    const newsPrefix = web3.eth.abi.encodeParameter('string', "NEWS");
    const value = web3.eth.abi.encodeParameters(['string', 'bytes'], [newsPrefix, encodedData]);

    // Build transaction
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

// Fetch and display news stories
async function loadNewsFeed() {
    // Fetch and decode stories to populate the #newsFeed section
    const contract = new web3.eth.Contract(contractABI, contractAddress);
    const latestBlock = await web3.eth.getBlockNumber();

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

                        // Append news content to the feed
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

loadNewsFeed();  // Load news on page load
