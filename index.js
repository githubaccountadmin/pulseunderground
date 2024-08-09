document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed");

    let provider;
    let signer;
    let contract;
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

    async function loadNewsFeed() {
        console.log("Loading news feed...");

        const apiUrl = 'https://api.scan.pulsechain.com/api/v2/addresses/0xD9157453E2668B2fc45b7A803D3FEF3642430cC0/transactions?filter=to%20%7C%20from';
        
        try {
            console.log("Fetching data from API:", apiUrl);
            const response = await fetch(apiUrl);
            const data = await response.json();
            console.log("Data fetched from API:", data);

            data.items.forEach(tx => {
                if (tx.input && tx.input.startsWith('0x')) { // Ensure input is defined and starts with 0x
                    console.log("Decoding transaction input:", tx.input);
                    const decodedInput = ethers.utils.defaultAbiCoder.decode(
                        ['bytes32', 'bytes', 'uint256', 'bytes'],
                        ethers.utils.hexDataSlice(tx.input, 4)
                    );
                    console.log("Decoded input:", decodedInput);
                    const newsContent = ethers.utils.defaultAbiCoder.decode(['string'], decodedInput[1]);
                    console.log("Decoded news content:", newsContent);
                    const newsFeed = document.getElementById('newsFeed');
                    const article = document.createElement('article');
                    article.innerHTML = `
                        <h3>News</h3>
                        <p>${newsContent}</p>
                    `;
                    newsFeed.appendChild(article);
                }
            });
        } catch (error) {
            console.error("Error loading news feed:", error);
        }
    }

    async function connectWallet() {
        console.log("Connect Wallet button clicked.");
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            account = await signer.getAddress();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            console.log("Wallet connected:", account);
        } catch (error) {
            console.error("Could not connect to wallet:", error);
        }
    }

    async function submitStory() {
        console.log("Submitting story...");
        const title = document.getElementById('title').value;
        const summary = document.getElementById('summary').value;
        const fullArticle = document.getElementById('fullArticle').value;
        const newsContent = `Title: ${title}\nSummary: ${summary}\nFull Article: ${fullArticle}`;
        console.log("News content:", newsContent);
        
        const encodedData = ethers.utils.defaultAbiCoder.encode(['string'], [newsContent]);
        const queryData = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", encodedData]);
        const queryID = ethers.utils.keccak256(queryData);
        console.log("Query ID:", queryID);

        try {
            const nonce = await contract.getNewValueCountbyQueryId(queryID);
            console.log("Nonce:", nonce.toString());

            const newsPrefix = ethers.utils.defaultAbiCoder.encode(['string'], ["NEWS"]);
            const value = ethers.utils.defaultAbiCoder.encode(['string', 'bytes'], [newsPrefix, encodedData]);

            console.log("Submitting value to contract...");
            const tx = await contract.submitValue(queryID, value, nonce, queryData);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();
            console.log("Transaction mined:", tx.hash);
        } catch (error) {
            console.error("Transaction failed:", error);
        }
    }

    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('publishStory').addEventListener('click', submitStory);
    console.log("Event listener added to Connect Wallet button.");
    console.log("Event listener added to Publish Story button.");

    loadNewsFeed();
});
