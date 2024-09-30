// dispute.js

const governanceContractAddress = '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00';
const tokenContractAddress = '0x7CDD7a0963a92BA1D98f6173214563EE0eBd9921'; // TRB token address on PulseChain
const governanceContractABI = [
    // Add the relevant ABI here from the govABI.json file
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

async function beginDispute(queryId, timestamp) {
    try {
        await initializeEthers();

        const trbAmount = ethers.utils.parseUnits('130', 18);

        // Approve transaction
        const approveTx = await tokenContract.approve(governanceContractAddress, trbAmount);
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

async function disputeNews(reporterAddress, reportContent) {
    try {
        await initializeEthers();
        
        // Extract queryId and timestamp from the report content
        // This is a placeholder - you'll need to implement the actual logic to extract these
        const { queryId, timestamp } = extractQueryIdAndTimestamp(reportContent);
        
        const disputeHash = await beginDispute(queryId, timestamp);
        
        console.log("Dispute submitted successfully. Transaction hash:", disputeHash);
        return disputeHash;
    } catch (error) {
        console.error("Error submitting dispute:", error);
        throw error;
    }
}

function extractQueryIdAndTimestamp(reportContent) {
    // Placeholder function - implement the actual logic to extract queryId and timestamp
    // This might involve parsing the reportContent or making an API call
    return {
        queryId: "0x0000000000000000000000000000000000000000000000000000000000000000",
        timestamp: Math.floor(Date.now() / 1000)
    };
}

// Export the function so it can be used in the main JavaScript file
window.disputeNews = disputeNews;
