// dispute.js
import { ethers } from 'https://cdn.ethers.io/lib/ethers-5.6.esm.min.js';

const governanceContractAddress = ethers.utils.getAddress('0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00');
const tokenContractAddress = ethers.utils.getAddress('0x7CdD7a0963a92BA1D98f6173214563EE0eBd9921');

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

let governanceContract;
let tokenContract;

async function getEthers() {
    if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        return { provider, signer };
    }
    throw new Error("Ethereum provider not found. Please install MetaMask.");
}

async function initializeEthers() {
    try {
        const { signer } = await getEthers();
        governanceContract = new ethers.Contract(governanceContractAddress, governanceContractABI, signer);
        tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
    } catch (error) {
        console.error("Error initializing Ethers:", error);
        throw error;
    }
}

async function checkNetwork() {
    const { provider } = await getEthers();
    const network = await provider.getNetwork();
    if (network.chainId !== 369) { // PulseChain mainnet chainId
        throw new Error("Please connect to PulseChain network");
    }
}

async function getDisputeFee() {
    await initializeEthers();
    await checkNetwork();
    const fee = await governanceContract.disputeFee();
    return fee;
}

async function beginDispute(queryId, timestamp) {
    try {
        await initializeEthers();
        await checkNetwork();
        const disputeFee = await getDisputeFee();
        console.log(`Dispute fee: ${ethers.utils.formatEther(disputeFee)} TRB`);

        // Approve transaction
        const approveTx = await tokenContract.approve(governanceContractAddress, ethers.BigNumber.from(disputeFee));
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
        if (error.message.includes("insufficient funds")) {
            throw new Error("Insufficient TRB balance for dispute fee");
        } else if (error.message.includes("user rejected")) {
            throw new Error("Transaction rejected by user");
        } else {
            throw error;
        }
    }
}

async function disputeNews(originalReporterAddress, queryId, timestamp) {
    try {
        await initializeEthers();
        await checkNetwork();
        
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
