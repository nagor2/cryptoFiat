const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP withdraw and close position (Hardhat version)", function () {
    let dao, cdp, oracle, flatCoin;
    let owner, user, account3, oracleAuthor;
    let posId;

    before(async function () {
        console.log("Deploying CDP withdraw test contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        
        dao = system.dao;
        cdp = system.cdp;
        oracle = system.oracle;
        flatCoin = system.flatCoin;
        owner = system.owner;
        oracleAuthor = system.oracleAuthor;
        const accounts = system.accounts;
        [, , account3, , , user] = accounts;
        
        const tx = await cdp.connect(user).openCDP(ethers.parseEther('1000'), {
            value: ethers.parseEther('1')
        });
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                return cdp.interface.parseLog(log)?.name === 'PositionOpened';
            } catch { return false; }
        });
        posId = cdp.interface.parseLog(event).args.posID;
        
        console.log("✅ CDP position opened, ID:", posId.toString());
    });

    it("should init position", async function () {
        const position = await cdp.positions(posId);
        expect(position.ethAmountLocked).to.equal(ethers.parseEther('1'));
        
        const balance = await ethers.provider.getBalance(await cdp.getAddress());
        expect(balance).to.equal(ethers.parseEther('1'));
        
        console.log("✅ Position initialized correctly");
    });

    it("should withdrawEther", async function () {
        const toWithdraw = ethers.parseEther('0.1');
        const ownerBalanceBefore = await ethers.provider.getBalance(user.address);
        
        const tx = await cdp.connect(user).withdrawEther(posId, toWithdraw);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        
        const ownerBalanceAfter = await ethers.provider.getBalance(user.address);
        expect(ownerBalanceAfter).to.equal(ownerBalanceBefore - gasUsed + toWithdraw);
        
        const cdpBalance = await ethers.provider.getBalance(await cdp.getAddress());
        expect(cdpBalance).to.equal(ethers.parseEther('0.9'));
        
        console.log("✅ Withdrawal successful");
    });

    it("should fail if claimed amount is too big", async function () {
        await expect(
            cdp.connect(user).withdrawEther(posId, ethers.parseEther('0.91'))
        ).to.be.revertedWith("too many eth claimed");
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        await expect(
            cdp.connect(user).withdrawEther(posId, ethers.parseEther('0.4'))
        ).to.be.revertedWith("not enough eth");
        
        // Изменяем цену ETH чтобы позволить вывод
        await oracle.connect(oracleAuthor).updateSinglePrice(1, 5100000000);
        
        const ownerBalanceBefore = await ethers.provider.getBalance(user.address);
        
        const tx = await cdp.connect(user).withdrawEther(posId, ethers.parseEther('0.4'));
        await expect(tx)
            .to.emit(cdp, 'PositionUpdated')
            .withArgs(posId, ethers.parseEther('1000'), ethers.parseEther('0.5'));
        
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        
        const ownerBalanceAfter = await ethers.provider.getBalance(user.address);
        expect(ownerBalanceAfter).to.equal(ownerBalanceBefore - gasUsed + ethers.parseEther('0.4'));
        
        console.log("✅ Collateral validation works");
    });

    it("should close position", async function () {
        await cdp.connect(account3).openCDP(ethers.parseEther('200'), {
            value: ethers.parseEther('0.2')
        });
        
        await flatCoin.connect(account3).transfer(user.address, ethers.parseEther('100'));
        await flatCoin.connect(user).approve(await cdp.getAddress(), ethers.parseEther('1100'));
        
        expect(await flatCoin.totalSupply()).to.equal(ethers.parseEther('1200'));
        
        const currentFee = await cdp.totalCurrentFee(posId);
        expect(Number(ethers.formatEther(currentFee))).to.be.closeTo(90, 0.01);
        
        await expect(
            cdp.closeCDP(posId)
        ).to.be.revertedWith("only owner");
        
        const ownerBalanceBefore = await ethers.provider.getBalance(user.address);
        
        const tx = await cdp.connect(user).closeCDP(posId);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        
        const ownerBalanceAfter = await ethers.provider.getBalance(user.address);
        // Проверяем что баланс увеличился примерно на 0.5 ETH минус газ
        expect(Number(ethers.formatEther(ownerBalanceAfter - ownerBalanceBefore + gasUsed))).to.be.closeTo(0.5, 0.01);
        
        const totalSupply = await flatCoin.totalSupply();
        expect(Number(ethers.formatEther(totalSupply))).to.be.closeTo(200, 0.01);
        
        const userBalance = await flatCoin.balanceOf(user.address);
        expect(Number(ethers.formatEther(userBalance))).to.be.closeTo(10, 0.01);
        
        const cdpBalance = await flatCoin.balanceOf(await cdp.getAddress());
        expect(Number(ethers.formatEther(cdpBalance))).to.be.closeTo(90, 0.01);
        
        const account3Balance = await flatCoin.balanceOf(account3.address);
        expect(Number(ethers.formatEther(account3Balance))).to.be.closeTo(100, 0.01);
        
        console.log("✅ Position closed successfully");
    });
});

