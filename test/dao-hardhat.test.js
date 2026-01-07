const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAO (Hardhat version)", function () {
    let dao;
    let ruleToken;
    let ruleHolder, voter, owner;

    before(async function () {
        const signers = await ethers.getSigners();
        [owner, , , , , voter, , ruleHolder] = signers;
        
        console.log("Deploying DAO contracts...");
        
        const INTDAO = await ethers.getContractFactory("INTDAO");
        const Rule = await ethers.getContractFactory("Rule");
        
        // Calculate future DAO address
        const nonce = await owner.getNonce();
        const futureDAOAddress = ethers.getCreateAddress({
            from: owner.address,
            nonce: nonce
        });
        
        // Деплоим Rule с future DAO address
        ruleToken = await Rule.connect(ruleHolder).deploy(futureDAOAddress);
        await ruleToken.waitForDeployment();
        
        // Деплоим DAO с правильным Rule address
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
        
        // Verify addresses match
        const actualAddress = await dao.getAddress();
        if (actualAddress !== futureDAOAddress) {
            console.warn("Warning: DAO address mismatch");
        }
        
        console.log("✅ DAO deployed to:", actualAddress);
        console.log("✅ Rule token deployed to:", await ruleToken.getAddress());
    });

    it('deploys successfully', async function () {
        const address = await dao.getAddress();
        expect(address).to.be.properAddress;
        expect(address).to.not.equal("");
        
        console.log("✅ DAO deployed successfully");
    });

    it('addresses filled successfully', async function () {
        const daoAddr = await dao.getAddress();
        const storedAddr = await dao.addresses('dao');
        expect(storedAddr).to.equal(daoAddr);
        
        console.log("✅ DAO address stored correctly");
    });

    it('should put rule tokens on balance', async function () {
        const balance = await ruleToken.balanceOf(ruleHolder.address);
        const totalSupply = await ruleToken.totalSupply();
        
        expect(balance).to.equal(ethers.parseEther('1000000'));
        expect(totalSupply).to.equal(ethers.parseEther('1000000'));
        
        console.log("✅ Rule holder balance:", ethers.formatEther(balance));
        console.log("✅ Total supply:", ethers.formatEther(totalSupply));
    });

    it('should fail because not allowed', async function () {
        await expect(
            dao.connect(ruleHolder).poolTokens()
        ).to.be.reverted;
        
        console.log("✅ Pool without approval correctly rejected");
    });

    it('should pool tokens', async function () {
        const amount = ethers.parseEther('100');
        await ruleToken.connect(ruleHolder).approve(await dao.getAddress(), amount);
        await dao.connect(ruleHolder).poolTokens();
        
        const daoBalance = await ruleToken.balanceOf(await dao.getAddress());
        const totalPooled = await dao.totalPooled();
        const pooled = await dao.pooled(ruleHolder.address);
        
        expect(daoBalance).to.equal(amount);
        expect(totalPooled).to.equal(amount);
        expect(pooled).to.equal(amount);
        
        console.log("✅ Tokens pooled:", ethers.formatEther(amount));
    });

    it('should not allow to init voting with too little tokens', async function () {
        await expect(
            dao.connect(ruleHolder).addVoting(1, "", 0, owner.address, false)
        ).to.be.revertedWith("Too little to init");
        
        console.log("✅ Voting with insufficient tokens rejected");
    });

    it('should init voting', async function () {
        const amount = ethers.parseEther('10000');
        await ruleToken.connect(ruleHolder).approve(await dao.getAddress(), amount);
        await dao.connect(ruleHolder).poolTokens();
        
        const tx = await dao.connect(ruleHolder).addVoting(1, "some string", 0, owner.address, false);
        
        await expect(tx)
            .to.emit(dao, 'NewVoting')
            .withArgs(1, "some string", "some string");
        
        const active = await dao.activeVoting();
        expect(active).to.be.true;
        
        console.log("✅ Voting initiated");
    });

    it('should not be able to finalize voting immediately', async function () {
        const tx = await dao.claimToFinalizeCurrentVoting();
        
        // Событие VotingFailed не должно быть испущено сразу
        const receipt = await tx.wait();
        const failedEvents = receipt.logs.filter(log => {
            try {
                return dao.interface.parseLog(log)?.name === 'VotingFailed';
            } catch {
                return false;
            }
        });
        
        expect(failedEvents.length).to.equal(0);
        
        console.log("✅ Voting cannot be finalized immediately");
    });

    it('should fail if voting duration expired', async function () {
        await time.increase(2 * 24 * 60 * 60); // 2 days
        
        await expect(
            dao.connect(ruleHolder).vote(true)
        ).to.be.revertedWith("inactive");
        
        console.log("✅ Expired voting rejected");
    });

    it('should be able to finalize voting after expiry', async function () {
        const tx = await dao.claimToFinalizeCurrentVoting();
        
        await expect(tx)
            .to.emit(dao, 'VotingFailed')
            .withArgs(1);
        
        console.log("✅ Voting finalized as failed");
    });

    it('should be able to get back pooled tokens', async function () {
        const pooledBefore = await dao.pooled(ruleHolder.address);
        const balanceBefore = await ruleToken.balanceOf(ruleHolder.address);
        
        await dao.connect(ruleHolder).returnTokens();
        
        const pooledAfter = await dao.pooled(ruleHolder.address);
        const balanceAfter = await ruleToken.balanceOf(ruleHolder.address);
        
        expect(pooledAfter).to.equal(0n);
        expect(balanceAfter).to.equal(balanceBefore + pooledBefore);
        
        console.log("✅ Tokens returned:", ethers.formatEther(pooledBefore));
    });
});

