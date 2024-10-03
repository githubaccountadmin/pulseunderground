// dispute.js (separate file)
const governanceContractAddress = '0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00';
const tokenContractAddress = '0x7CdD7A0963A92bA1D98f6173214563EE0EBd9921';  // Corrected checksum

const governanceContractABI = [
    {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_timestamp","type":"uint256"}],"name":"beginDispute","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"disputeFee","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const tokenABI = ["function approve(address spender, uint256 amount) public returns (bool)"];

let governanceContract, tokenContract;

const initializeEthers = async () => {
    if (typeof window.ethereum === 'undefined') {
        throw new Error("Ethereum provider not found. Please install MetaMask.");
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    governanceContract = new ethers.Contract(governanceContractAddress, governanceContractABI, signer);
    tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
};

const getDisputeFee = async () => {
    await initializeEthers();
    const network = await provider.getNetwork();
    if (network.chainId !== 369) {
        throw new Error("Please connect to PulseChain network");
    }
    return governanceContract.disputeFee();
};

const beginDispute = async (queryId, timestamp) => {
    try {
        await initializeEthers();
        const network = await provider.getNetwork();
        if (network.chainId !== 369) {
            throw new Error("Please connect to PulseChain network");
        }
        const disputeFee = await getDisputeFee();
        console.log(`Dispute fee: ${ethers.utils.formatEther(disputeFee)} TRB`);

        const approveTx = await tokenContract.approve(governanceContractAddress, disputeFee);
        await approveTx.wait();
        console.log('Approval transaction confirmed.');

        const tx = await governanceContract.beginDispute(queryId, timestamp);
        await tx.wait();
        console.log('Dispute transaction confirmed.');

        return tx.hash;
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
};

const disputeNews = async (originalReporterAddress, queryId, timestamp) => {
    try {
        const disputeFee = await getDisputeFee();
        if (confirm(`Are you sure you want to dispute this report?\n\nReporter: ${originalReporterAddress}\nDispute Fee: ${ethers.utils.formatEther(disputeFee)} TRB\n\nThis action will require a transaction and gas fees.`)) {
            const txHash = await beginDispute(queryId, timestamp);
            displayStatus(`Dispute submitted successfully. Transaction hash: ${txHash}`);
        } else {
            displayStatus("Dispute cancelled");
        }
    } catch (error) {
        displayStatus(`Error submitting dispute: ${error.message}`, true);
    }
};

window.disputeNews = disputeNews;
