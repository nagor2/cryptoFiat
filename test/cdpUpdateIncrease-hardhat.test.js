const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP Update Increase (Hardhat version)", function () {
    let dao, cdp, flatCoin;
    let owner, user, account3;
    let posId, id;
    let positionBefore, positionAfter;
    let fee;

    before(async function () {
        console.log("Deploying CDP Update Increase contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        
        dao = system.dao;
        cdp = system.cdp;
        flatCoin = system.flatCoin;
        const accounts = system.accounts;
        [, user, account3] = accounts;
        
        // Открываем первую позицию
        const tx = await cdp.connect(user).openCDP(ethers.parseEther('2000'), {
            value: ethers.parseEther('1')
        });
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                return cdp.interface.parseLog(log)?.name === 'PositionOpened';
            } catch { return false; }
        });
        posId = cdp.interface.parseLog(event).args.posID;
        
        positionBefore = await cdp.positions(posId);
        await time.increase(365 * 24 * 60 * 60); // 1 year
        fee = await cdp.interestAmountUnrecorded(posId);
        
        // Обновляем позицию с дополнительным ETH
        await cdp.connect(user).updateCDP(posId, ethers.parseEther('2100'), {
            value: ethers.parseEther('1')
        });
        await time.increase(1);
        await cdp.connect(user).updateCDP(posId, ethers.parseEther('2100'));
        
        positionAfter = await cdp.positions(posId);
        
        console.log("✅ CDP Update Increase setup complete");
    });

    it("should properly calculate maxCoins to mint", async function () {
        const coins = await cdp.getMaxFlatCoinsToMintForPos(posId);
        expect(Number(ethers.formatEther(coins))).to.be.closeTo(4160, 0.01);
        
        console.log("✅ Max coins to mint:", ethers.formatEther(coins));
    });

    it("should increase overall fee", async function () {
        const recordedFee = positionAfter.interestAmountRecorded;
        expect(Number(ethers.formatEther(recordedFee))).to.be.closeTo(180, 0.01);
        
        const overallFee = await cdp.totalCurrentFee(posId);
        expect(Number(ethers.formatEther(overallFee))).to.be.closeTo(180, 0.01);
        
        console.log("✅ Overall fee:", ethers.formatEther(recordedFee));
    });

    it("should increase owner balance", async function () {
        const balance = await flatCoin.balanceOf(positionBefore.owner);
        expect(balance).to.equal(ethers.parseEther('2100'));
        
        console.log("✅ Owner balance:", ethers.formatEther(balance));
    });

    it("should transfer fee to CDP, increase stability fund and decrease owners balance", async function () {
        const balanceBefore = await flatCoin.balanceOf(await cdp.getAddress());
        let ownerBalance = await flatCoin.balanceOf(positionBefore.owner);
        
        expect(ownerBalance).to.equal(ethers.parseEther('2100'));
        
        // Пересчитываем fee перед approve, так как позиция обновлялась
        const currentFee = await cdp.totalCurrentFee(posId);
        await flatCoin.connect(user).approve(await cdp.getAddress(), currentFee + ethers.parseEther('1000'));
        await cdp.connect(user).transferInterest(posId);
        
        ownerBalance = await flatCoin.balanceOf(positionBefore.owner);
        expect(Number(ethers.formatEther(ownerBalance))).to.be.closeTo(1920, 0.01);
        
        const balanceAfter = await flatCoin.balanceOf(await cdp.getAddress());
        expect(Number(ethers.formatEther(balanceBefore))).to.be.closeTo(0, 0.01);
        expect(Number(ethers.formatEther(balanceAfter))).to.be.closeTo(Number(ethers.formatEther(currentFee)), 0.01);
        
        console.log("✅ Fee transferred to CDP");
    });

    it("should increase ethAmount locked", async function () {
        expect(positionAfter.ethAmountLocked).to.equal(ethers.parseEther('2'));
        
        console.log("✅ ETH locked:", ethers.formatEther(positionAfter.ethAmountLocked));
    });

    it("should put 2 ether on contract's balance", async function () {
        const contractBalance = await ethers.provider.getBalance(await cdp.getAddress());
        expect(contractBalance).to.equal(ethers.parseEther('2'));
        
        console.log("✅ Contract balance:", ethers.formatEther(contractBalance), "ETH");
    });

    it("should increase generated fee", async function () {
        expect(Number(ethers.formatEther(positionAfter.interestAmountRecorded))).to.be.closeTo(180, 0.01);
        expect(Number(ethers.formatEther(positionAfter.interestAmountRecorded))).to.be.closeTo(Number(ethers.formatEther(fee)), 0.01);
        
        console.log("✅ Generated fee:", ethers.formatEther(positionAfter.interestAmountRecorded));
    });

    it("should not allow to mint coins due to feeGenerated", async function () {
        const posTx = await cdp.connect(account3).openCDP(ethers.parseEther('1000'), {
            value: ethers.parseEther('1')
        });
        const receipt = await posTx.wait();
        const event = receipt.logs.find(log => {
            try {
                const parsed = cdp.interface.parseLog(log);
                return parsed?.name === 'PositionOpened';
            } catch { return false; }
        });
        id = cdp.interface.parseLog(event).args.posID;
        
        expect(id).to.equal(1n);
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        await expect(
            cdp.connect(account3).updateCDP(id, ethers.parseEther('2100'))
        ).to.be.revertedWith("not enough collateral");
        
        const tx = await cdp.connect(account3).updateCDP(id, ethers.parseEther('2079'));
        await expect(tx).to.emit(cdp, 'PositionUpdated');
        
        console.log("✅ Collateral check works correctly");
    });

    it("should increase coinsMinted", async function () {
        const posAft = await cdp.positions(id);
        expect(posAft.coinsMinted).to.equal(ethers.parseEther('2079'));
        
        console.log("✅ Coins minted increased:", ethers.formatEther(posAft.coinsMinted));
    });
});

