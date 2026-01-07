const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFullSystem } = require("./helpers/contracts");

describe("Deposit (Hardhat version)", function () {
    let dao, cdp, flatCoin, deposit;
    let owner, user1;
    const amount = ethers.parseEther('100');

    before(async function () {
        console.log("Deploying Deposit contracts...");
        
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        
        dao = system.dao;
        cdp = system.cdp;
        flatCoin = system.flatCoin;
        deposit = system.deposit;
        owner = system.owner;
        user1 = system.accounts[0];
        
        // Открываем CDP и пополняем stabFund
        await cdp.connect(user1).openCDP(ethers.parseEther('1000'), {
            value: ethers.parseEther('1')
        });
        await flatCoin.connect(user1).transfer(await cdp.getAddress(), ethers.parseEther('10'));
        
        console.log("✅ Deposit system deployed");
    });

    it("should fail, because nothing to deposit", async function () {
        await expect(
            deposit.deposit()
        ).to.be.revertedWith("you have to approve coins first");
        
        await flatCoin.approve(await deposit.getAddress(), 100);
        
        await expect(
            deposit.deposit()
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        
        await flatCoin.connect(user1).transfer(owner.address, 50);
        
        await expect(
            deposit.deposit()
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        
        await flatCoin.transfer(user1.address, 50);
        await flatCoin.approve(await deposit.getAddress(), 0);
        
        console.log("✅ Deposit validations work correctly");
    });

    it("should deposit", async function () {
        await flatCoin.connect(user1).transfer(owner.address, amount);
        await flatCoin.approve(await deposit.getAddress(), amount);
        
        const depositBalanceBefore = await flatCoin.balanceOf(await deposit.getAddress());
        const ownerBalanceBefore = await flatCoin.balanceOf(owner.address);
        
        expect(depositBalanceBefore).to.equal(0n);
        expect(ownerBalanceBefore).to.equal(amount);
        
        const tx = await deposit.deposit();
        const expectedRate = await dao.params("depositRate");
        
        await expect(tx)
            .to.emit(deposit, 'DepositOpened')
            .withArgs(1, amount, expectedRate, owner.address);
        
        const depositBalanceAfter = await flatCoin.balanceOf(await deposit.getAddress());
        const ownerBalanceAfter = await flatCoin.balanceOf(owner.address);
        
        expect(depositBalanceAfter).to.equal(amount);
        expect(ownerBalanceAfter).to.equal(0n);
        
        console.log("✅ Deposit created successfully");
    });

    it("should create valid deposit", async function () {
        const d = await deposit.deposits(1);
        
        expect(d.owner).to.equal(owner.address);
        expect(d.coinsDeposited).to.equal(amount);
        expect(d.currentInterestRate).to.equal(8n);
        
        console.log("✅ Deposit structure is valid");
    });

    it("should pay interest", async function () {
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const interest = await deposit.overallInterest(1);
        expect(Number(ethers.formatEther(interest))).to.be.closeTo(8, 0.01);
        
        await deposit.claimInterest(1);
        
        const balance = await flatCoin.balanceOf(owner.address);
        expect(Number(ethers.formatEther(balance))).to.be.closeTo(8, 0.01);
        
        console.log("✅ Interest paid:", ethers.formatEther(interest));
    });

    it("should pay some interest and increase allowance", async function () {
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const interest = await deposit.overallInterest(1);
        expect(Number(ethers.formatEther(interest))).to.be.closeTo(8, 0.01);
        
        await deposit.claimInterest(1);
        
        const balance = await flatCoin.balanceOf(owner.address);
        expect(Number(ethers.formatEther(balance))).to.be.closeTo(10, 0.01);
        
        const allowance = await flatCoin.allowance(await cdp.getAddress(), owner.address);
        expect(Number(ethers.formatEther(allowance))).to.be.closeTo(6, 0.01);
        
        console.log("✅ Interest and allowance updated");
    });

    it("should topUp deposit", async function () {
        await flatCoin.approve(await deposit.getAddress(), ethers.parseEther('10'));
        await deposit.topUp(1);
        
        const d = await deposit.deposits(1);
        expect(d.coinsDeposited).to.equal(ethers.parseEther('110'));
        
        const balance = await flatCoin.balanceOf(await deposit.getAddress());
        expect(balance).to.equal(ethers.parseEther('110'));
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        await deposit.claimInterest(1);
        
        const allowance = await flatCoin.allowance(await cdp.getAddress(), owner.address);
        expect(Number(ethers.formatEther(allowance))).to.be.closeTo(14.8, 0.01);
        
        console.log("✅ Deposit topped up successfully");
    });

    it("should withdraw funds", async function () {
        await deposit.withdraw(1, ethers.parseEther('100'));
        
        const d = await deposit.deposits(1);
        expect(d.coinsDeposited).to.equal(ethers.parseEther('10'));
        
        const depositBalance = await flatCoin.balanceOf(await deposit.getAddress());
        expect(Number(ethers.formatEther(depositBalance))).to.be.closeTo(10, 0.01);
        
        const ownerBalance = await flatCoin.balanceOf(owner.address);
        expect(Number(ethers.formatEther(ownerBalance))).to.be.closeTo(100, 0.01);
        
        console.log("✅ Withdrawal successful");
    });

    it("should withdraw funds, close deposit and increase allowance", async function () {
        await time.increase(365 * 24 * 60 * 60); // 1 year
        await deposit.withdraw(1, ethers.parseEther('10'));
        
        const d = await deposit.deposits(1);
        expect(d.coinsDeposited).to.equal(0n);
        expect(d.closed).to.be.true;
        
        const allowance = await flatCoin.allowance(await cdp.getAddress(), owner.address);
        expect(Number(ethers.formatEther(allowance))).to.be.closeTo(15.6, 0.01);
        
        console.log("✅ Deposit closed successfully");
    });

    it("should pay the interest as deposit is closed", async function () {
        await flatCoin.connect(user1).transfer(await cdp.getAddress(), ethers.parseEther('30'));
        await flatCoin.approve(await deposit.getAddress(), ethers.parseEther('100'));
        await deposit.deposit();
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const balanceBefore = await flatCoin.balanceOf(owner.address);
        await deposit.withdraw(2, ethers.parseEther('100'));
        const balanceAfter = await flatCoin.balanceOf(owner.address);
        
        const diff = Number(ethers.formatEther(balanceAfter - balanceBefore));
        expect(diff).to.be.closeTo(108, 0.01);
        
        console.log("✅ Interest paid on close:", diff);
    });
});

