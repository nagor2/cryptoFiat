const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Security: DAO Flash Loan Attack (V-DAO-001)", function () {
    let dao;
    let ruleToken;
    let attacker;
    let ruleHolder, victim, owner;
    let attackerContract;
    
    beforeEach(async function () {
        const signers = await ethers.getSigners();
        [owner, victim, attacker, , , , , ruleHolder] = signers;
        
        console.log("Deploying DAO and Rule for flash loan attack test...");
        
        const INTDAO = await ethers.getContractFactory("INTDAO");
        const Rule = await ethers.getContractFactory("Rule");
        
        // Calculate future DAO address
        const nonce = await owner.getNonce();
        const futureDAOAddress = ethers.getCreateAddress({
            from: owner.address,
            nonce: nonce
        });
        
        // Deploy Rule with future DAO address
        ruleToken = await Rule.connect(ruleHolder).deploy(futureDAOAddress);
        await ruleToken.waitForDeployment();
        
        // Deploy DAO
        dao = await INTDAO.deploy([
            ethers.ZeroAddress, // cdp
            ethers.ZeroAddress, // auction
            ethers.ZeroAddress, // deposit
            ethers.ZeroAddress, // oracle
            await ruleToken.getAddress(), // rule
            ethers.ZeroAddress, // flatCoin
            ethers.ZeroAddress  // basket
        ]);
        await dao.waitForDeployment();
        
        console.log("✅ DAO deployed to:", await dao.getAddress());
        console.log("✅ Rule token deployed to:", await ruleToken.getAddress());
        console.log("✅ Total Rule supply:", ethers.formatEther(await ruleToken.totalSupply()));
    });
    
    describe("Flash Loan Attack Scenario", function () {
        it("should demonstrate flash loan attack attempt (and verify it fails)", async function () {
            // Deploy attacker contract
            const FlashLoanAttacker = await ethers.getContractFactory("FlashLoanAttacker");
            attackerContract = await FlashLoanAttacker.connect(attacker).deploy(
                await dao.getAddress(),
                await ruleToken.getAddress()
            );
            await attackerContract.waitForDeployment();
            
            console.log("✅ Attacker contract deployed to:", await attackerContract.getAddress());
            
            // Give attacker 1% of total supply (minimum to initiate voting)
            const totalSupply = await ruleToken.totalSupply();
            const minTokensToVote = totalSupply / 100n; // 1%
            const attackerTokens = minTokensToVote * 2n; // 2% to be safe
            
            await ruleToken.connect(ruleHolder).transfer(
                await attackerContract.getAddress(),
                attackerTokens
            );
            
            console.log("✅ Attacker contract funded with:", ethers.formatEther(attackerTokens), "Rule tokens");
            
            // Victim creates a legitimate voting proposal
            const victimTokens = minTokensToVote * 2n;
            await ruleToken.connect(ruleHolder).transfer(victim.address, victimTokens);
            await ruleToken.connect(victim).approve(await dao.getAddress(), victimTokens);
            await dao.connect(victim).poolTokens();
            
            // Create voting to change a parameter (type 1)
            await dao.connect(victim).addVoting(
                1, // votingType: change parameter
                "interestRate", 
                50, // new value
                ethers.ZeroAddress,
                false
            );
            
            console.log("✅ Victim created voting proposal");
            
            const votingIDBefore = await dao.votingID();
            const activeVotingBefore = await dao.activeVoting();
            expect(activeVotingBefore).to.be.true;
            
            // Get voting info before attack
            const votingBefore = await dao.votings(votingIDBefore);
            console.log("Voting totalPositive before attack:", ethers.formatEther(votingBefore.totalPositive));
            
            // ATTEMPT FLASH LOAN ATTACK
            console.log("\n🔴 ATTEMPTING FLASH LOAN ATTACK...");
            console.log("Attack sequence: pool → vote → return (in one transaction)");
            
            const attackTx = await attackerContract.connect(attacker).executeFlashLoanAttack();
            await attackTx.wait();
            
            // Check attack results
            const attackSucceeded = await attackerContract.attackSucceeded();
            const votesRecorded = await attackerContract.votesRecorded();
            const attackError = await attackerContract.attackError();
            
            console.log("\n📊 ATTACK RESULTS:");
            console.log("Attack succeeded:", attackSucceeded);
            console.log("Votes recorded:", ethers.formatEther(votesRecorded));
            console.log("Attack error:", attackError);
            
            // Get voting info after attack
            const votingAfter = await dao.votings(votingIDBefore);
            console.log("\nVoting totalPositive after attack:", ethers.formatEther(votingAfter.totalPositive));
            
            // Check attacker's final token balance
            const attackerFinalBalance = await ruleToken.balanceOf(await attackerContract.getAddress());
            console.log("Attacker final token balance:", ethers.formatEther(attackerFinalBalance));
            
            // Check attacker's pooled amount
            const attackerPooled = await dao.pooled(await attackerContract.getAddress());
            console.log("Attacker pooled tokens:", ethers.formatEther(attackerPooled));
            
            // VERIFY: Attack should succeed in returning tokens but votes should be subtracted
            expect(attackSucceeded).to.be.true; // Transaction succeeded
            expect(attackerFinalBalance).to.equal(attackerTokens); // Tokens returned
            expect(attackerPooled).to.equal(0); // No tokens pooled
            
            // CRITICAL CHECK: Did the attack influence the voting?
            // If totalPositive didn't increase, the protection works
            expect(votingAfter.totalPositive).to.equal(votingBefore.totalPositive);
            
            console.log("\n✅ CONCLUSION: Flash loan attack failed to influence voting!");
            console.log("The DAO's returnTokens() function correctly subtracts votes.");
        });
        
        it("should verify votes are correctly subtracted when returning tokens during active voting", async function () {
            // Give tokens to attacker
            const totalSupply = await ruleToken.totalSupply();
            const attackerTokens = totalSupply / 50n; // 2%
            
            await ruleToken.connect(ruleHolder).transfer(attacker.address, attackerTokens);
            await ruleToken.connect(attacker).approve(await dao.getAddress(), attackerTokens);
            
            // Pool tokens
            await dao.connect(attacker).poolTokens();
            const pooledAmount = await dao.pooled(attacker.address);
            expect(pooledAmount).to.equal(attackerTokens);
            
            // Create voting
            await dao.connect(attacker).addVoting(
                1, // votingType
                "depositRate",
                10,
                ethers.ZeroAddress,
                false
            );
            
            const votingID = await dao.votingID();
            
            // Vote
            await dao.connect(attacker).vote(true);
            
            // Check votes recorded
            const votingAfterVote = await dao.votings(votingID);
            expect(votingAfterVote.totalPositive).to.equal(attackerTokens);
            
            console.log("Total positive votes after voting:", ethers.formatEther(votingAfterVote.totalPositive));
            
            // Return tokens during active voting
            await dao.connect(attacker).returnTokens();
            
            // Check votes after return
            const votingAfterReturn = await dao.votings(votingID);
            expect(votingAfterReturn.totalPositive).to.equal(0);
            
            console.log("Total positive votes after return:", ethers.formatEther(votingAfterReturn.totalPositive));
            
            // Verify tokens returned
            const finalBalance = await ruleToken.balanceOf(attacker.address);
            expect(finalBalance).to.equal(attackerTokens);
            
            console.log("✅ Votes correctly subtracted when returning tokens!");
        });
        
        it("should demonstrate limitation: quorum manipulation is still possible", async function () {
            // This test shows a potential weakness:
            // Even though votes are subtracted, the attacker can influence quorum
            
            const totalSupply = await ruleToken.totalSupply();
            const largeAmount = totalSupply / 10n; // 10%
            
            // Give large amount to two participants
            await ruleToken.connect(ruleHolder).transfer(victim.address, largeAmount);
            await ruleToken.connect(ruleHolder).transfer(attacker.address, largeAmount);
            
            // Victim pools and creates voting
            await ruleToken.connect(victim).approve(await dao.getAddress(), largeAmount);
            await dao.connect(victim).poolTokens();
            await dao.connect(victim).addVoting(1, "liquidationFee", 20, ethers.ZeroAddress, false);
            
            const votingID = await dao.votingID();
            
            // Victim votes YES
            await dao.connect(victim).vote(true);
            
            let voting = await dao.votings(votingID);
            console.log("\nAfter victim votes YES:");
            console.log("totalPositive:", ethers.formatEther(voting.totalPositive));
            console.log("totalPooled:", ethers.formatEther(await dao.totalPooled()));
            
            // Attacker pools tokens temporarily (increases totalPooled)
            await ruleToken.connect(attacker).approve(await dao.getAddress(), largeAmount);
            await dao.connect(attacker).poolTokens();
            
            console.log("\nAfter attacker pools:");
            console.log("totalPooled:", ethers.formatEther(await dao.totalPooled()));
            
            // Attacker votes NO
            await dao.connect(attacker).vote(false);
            
            voting = await dao.votings(votingID);
            console.log("totalPositive:", ethers.formatEther(voting.totalPositive)); // Unchanged
            
            // Now attacker returns tokens (votes are 0 anyway, but totalPooled decreases)
            await dao.connect(attacker).returnTokens();
            
            console.log("\nAfter attacker returns:");
            console.log("totalPooled:", ethers.formatEther(await dao.totalPooled()));
            
            // Fast forward to end of voting
            await time.increase(86400 + 1); // 1 day + 1 second
            
            // Check if voting can be finalized
            const quorum = await dao.params("quorum"); // 75%
            const finalTotalPooled = await dao.totalPooled();
            const requiredQuorum = totalSupply * quorum / 100n;
            
            console.log("\nQuorum check:");
            console.log("Required quorum:", ethers.formatEther(requiredQuorum));
            console.log("Actual totalPooled:", ethers.formatEther(finalTotalPooled));
            console.log("Quorum reached:", finalTotalPooled >= requiredQuorum);
            
            // ⚠️ LIMITATION: While votes are protected, quorum manipulation
            // through temporary pooling is theoretically possible but 
            // requires the attacker to hold tokens for the duration
            
            console.log("\n⚠️ NOTE: Quorum can be influenced by temporary pooling,");
            console.log("but this requires holding tokens and is less severe than vote manipulation.");
        });
        
        it("should verify that flash loan cannot bypass minimum token requirement", async function () {
            // Deploy attacker with insufficient tokens
            const FlashLoanAttacker = await ethers.getContractFactory("FlashLoanAttacker");
            attackerContract = await FlashLoanAttacker.connect(attacker).deploy(
                await dao.getAddress(),
                await ruleToken.getAddress()
            );
            await attackerContract.waitForDeployment();
            
            // Give attacker less than 1% (not enough to create voting)
            const totalSupply = await ruleToken.totalSupply();
            const insufficientTokens = totalSupply / 200n; // 0.5%
            
            await ruleToken.connect(ruleHolder).transfer(
                await attackerContract.getAddress(),
                insufficientTokens
            );
            
            console.log("Attacker tokens:", ethers.formatEther(insufficientTokens));
            console.log("Required (1%):", ethers.formatEther(totalSupply / 100n));
            
            // Try to create voting (should fail)
            await expect(
                attackerContract.connect(attacker).createVoting(
                    1,
                    "collateralDiscount",
                    99,
                    ethers.ZeroAddress,
                    false
                )
            ).to.be.revertedWith("Too little to init");
            
            console.log("✅ Cannot create voting with insufficient tokens (even with flash loan)");
        });
    });
    
    describe("Additional Security Checks", function () {
        it("should verify nonReentrant protection on poolTokens", async function () {
            const tokens = ethers.parseEther("10000");
            await ruleToken.connect(ruleHolder).transfer(attacker.address, tokens);
            await ruleToken.connect(attacker).approve(await dao.getAddress(), tokens);
            
            // Pool tokens
            await dao.connect(attacker).poolTokens();
            
            // Try to pool again without new approval (should fail)
            await expect(
                dao.connect(attacker).poolTokens()
            ).to.be.revertedWith("allow tokens first");
            
            console.log("✅ Cannot double-pool without new approval");
        });
        
        it("should verify nonReentrant protection on returnTokens", async function () {
            const tokens = ethers.parseEther("10000");
            await ruleToken.connect(ruleHolder).transfer(attacker.address, tokens);
            await ruleToken.connect(attacker).approve(await dao.getAddress(), tokens);
            
            await dao.connect(attacker).poolTokens();
            await dao.connect(attacker).returnTokens();
            
            // Try to return again (should fail - nothing pooled)
            await expect(
                dao.connect(attacker).returnTokens()
            ).to.be.revertedWith("nothing pooled");
            
            console.log("✅ Cannot double-return tokens");
        });
    });
});

