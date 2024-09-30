// dispute.js

const governanceContractAddress = '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00';
const governanceContractABI = [
    // Add the relevant ABI here
];

let governanceContract;
let provider;
let signer;

async function initializeEthers() {
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        governanceContract = new ethers.Contract(governanceContractAddress, governanceContractABI, signer);
    } else {
        console.error("Ethereum provider not found. Please install MetaMask.");
    }
}

async function disputeNews(reporterAddress, reportContent) {
    try {
        await initializeEthers();
        
        // Call the governance contract's dispute function
        // This is a placeholder and needs to be replaced with the actual contract function
        const tx = await governanceContract.dispute(reporterAddress, reportContent);
        await tx.wait();
        
        console.log("Dispute submitted successfully");
        // You might want to update the UI or show a success message here
    } catch (error) {
        console.error("Error submitting dispute:", error);
        // Handle the error, maybe show an error message to the user
    }
}

// Export the function so it can be used in the main JavaScript file
window.disputeNews = disputeNews;
