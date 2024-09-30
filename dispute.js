// dispute.js

const governanceContractAddress = '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00';
const tokenContractAddress = '0x7CDD7a0963a92BA1D98f6173214563EE0eBd9921'; // TRB token address on PulseChain

const governanceContractABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_queryId", "type": "bytes32"},
            {"internalType": "uint256", "name": "_timestamp", "type": "uint256"}
        ],
        "name": "beginDispute",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "disputeFee",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

const tokenABI = [
    "function approve(address spender, uint256 amount) public returns (bool)"
];

let provider;
let signer;
let governanceContract;
let tokenContract;

async function initializeEthers() {
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        governanceContract = new ethers.Contract(governanceContractAddress, governanceContractABI, signer);
        tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
    } else {
        console.error("Ethereum provider not found. Please install MetaMask.");
        throw new Error("Ethereum provider not found");
    }
}

async function getDisputeFee() {
    await initializeEthers();
    const fee = await governanceContract.disputeFee();
    return fee;
}

async function beginDispute(queryId, timestamp) {
    try {
        await initializeEthers();

        const disputeFee = await getDisputeFee();
        console.log(`Dispute fee: ${ethers.utils.formatEther(disputeFee)} TRB`);

        // Approve transaction
        const approveTx = await tokenContract.approve(governanceContractAddress, disputeFee);
        console.log(`Approval transaction sent. Transaction Hash: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('Approval transaction confirmed.');

        // Begin dispute on the governance contract
        const tx = await governanceContract.beginDispute(queryId, timestamp);
        console.log(`Dispute initiated. Transaction Hash: ${tx.hash}`);
        await tx.wait();
        console.log('Dispute transaction confirmed.');

        return tx.hash; // Return the transaction hash for UI updates
    } catch (error) {
        console.error('Error initiating dispute:', error);
        throw error;
    }
}

async function disputeNews(originalReporterAddress, queryId, timestamp) {
    try {
        await initializeEthers();
        
        console.log(`Disputing report by: ${originalReporterAddress}`);
        const disputeHash = await beginDispute(queryId, timestamp);
        
        console.log("Dispute submitted successfully. Transaction hash:", disputeHash);
        return disputeHash;
    } catch (error) {
        console.error("Error submitting dispute:", error);
        throw error;
    }
}

// Export the functions so they can be used in the main JavaScript file
window.disputeNews = disputeNews;
window.getDisputeFee = getDisputeFee;
