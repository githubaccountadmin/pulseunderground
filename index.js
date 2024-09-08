async function checkIfReporterLocked() {
    console.log("Checking if reporter is locked...");

    try {
        // Ensure the contract is instantiated
        if (!contract) {
            contract = new ethers.Contract(contractAddress, contractABI, signer);
        }
        const reporterAddress = await signer.getAddress();

        // Fetch the reporter's last report timestamp
        const lastReportTimestamp = await contract.getReporterLastTimestamp(reporterAddress);

        // Fetch the reporting lock duration (in seconds)
        const reportingLock = await contract.getReportingLock();

        // Get the current time in seconds (current timestamp)
        const currentTime = Math.floor(Date.now() / 1000);

        // Calculate how much time has passed since the last report
        const timeSinceLastReport = currentTime - lastReportTimestamp;

        // Determine if the reporter is still locked
        if (timeSinceLastReport < reportingLock) {
            const remainingLockTime = reportingLock - timeSinceLastReport;
            const hours = Math.floor(remainingLockTime / 3600);
            const minutes = Math.floor((remainingLockTime % 3600) / 60);
            const seconds = remainingLockTime % 60;

            console.log(`Reporter is locked. Time left: ${hours}h ${minutes}m ${seconds}s`);
            alert(`Reporter is locked. Time left: ${hours}h ${minutes}m ${seconds}s`);
            return false;
        } else {
            console.log('Reporter is unlocked.');
            return true;
        }
    } catch (error) {
        console.error('Error checking reporter lock status:', error);
        return false;
    }
}
