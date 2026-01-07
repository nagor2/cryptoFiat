const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP transfer interest fee (Hardhat version)", function () {
    let dao, cdp, rule, flatCoin, auction;
    let owner, user5, account7, account9, ruleHolder;
    let posId;

    before(async function () {
        console.log("Deploying CDP Fee test contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const signers = await ethers.getSigners();
        ruleHolder = signers[6];
        
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true,
            ruleHolder: ruleHolder
        });
        
        dao = system.dao;
        cdp = system.cdp;
        flatCoin = system.flatCoin;
        rule = system.rule;
        auction = system.auction;
        owner = system.owner;
        const accounts = system.accounts;
        [, , , , user5, , account7, , account9] = accounts;
        
        console.log("✅ CDP Fee contracts deployed");
    });

    it("should properly increase fee", async function () {
        const coinsMintAmount = 1000;
        const tx = await cdp.connect(account9).openCDP(ethers.parseEther(coinsMintAmount.toString()), {
            value: ethers.parseEther('1')
        });
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                return cdp.interface.parseLog(log)?.name === 'PositionOpened';
            } catch { return false; }
        });
        posId = cdp.interface.parseLog(event).args.posID;
        
        expect(await cdp.totalCurrentFee(posId)).to.equal(0n);
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const fee = await cdp.totalCurrentFee(posId);
        expect(Number(ethers.formatEther(fee))).to.be.closeTo(90, 0.01);
        
        await cdp.connect(account9).updateCDP(posId, ethers.parseEther('100'));
        
        const position = await cdp.positions(posId);
        expect(Number(ethers.formatEther(position.interestAmountRecorded))).to.be.closeTo(90, 0.01);
        
        await time.increase(365 * 24 * 60 * 60); // another year
        
        const newFee = await cdp.totalCurrentFee(posId);
        expect(Number(ethers.formatEther(newFee))).to.be.closeTo(99, 0.01);
        
        console.log("✅ Fee increased correctly over time");
    });

    it("should set restricted", async function () {
        let position = await cdp.positions(posId);
        expect(position.restrictInterestWithdrawal).to.be.false;
        
        await expect(
            cdp.switchRestrictInterestWithdrawal(posId)
        ).to.be.reverted;
        
        await cdp.connect(account9).switchRestrictInterestWithdrawal(posId);
        
        position = await cdp.positions(posId);
        expect(position.restrictInterestWithdrawal).to.be.true;
        
        console.log("✅ Interest withdrawal restricted");
    });

    it("should transfer interest to CDP and decrease recorded fee if not restricted", async function () {
        const position = await cdp.positions(posId);
        
        const totalFee = await cdp.totalCurrentFee(posId);
        expect(Number(ethers.formatEther(totalFee))).to.be.closeTo(99, 0.01);
        
        await flatCoin.connect(account9).approve(await cdp.getAddress(), ethers.parseEther('99.01'));
        
        await expect(
            cdp.transferInterest(posId)
        ).to.be.reverted;
        
        expect(await flatCoin.balanceOf(await cdp.getAddress())).to.equal(0n);
        
        await cdp.connect(account9).transferInterest(posId);
        
        const cdpBalance = await flatCoin.balanceOf(await cdp.getAddress());
        expect(Number(ethers.formatEther(cdpBalance))).to.be.closeTo(99, 0.01);
        
        const ownerBalance = await flatCoin.balanceOf(position.owner);
        expect(Number(ethers.formatEther(ownerBalance))).to.be.closeTo(1, 0.01);
        
        const pos = await cdp.positions(posId);
        expect(await cdp.totalCurrentFee(posId)).to.equal(0n);
        expect(pos.interestAmountRecorded).to.equal(0n);
        
        console.log("✅ Interest transferred to CDP");
    });

    it("should generate additional fee", async function () {
        const recipient = account7;
        const coinsMintAmount = 1000;
        
        const tx = await cdp.connect(user5).openCDP(ethers.parseEther(coinsMintAmount.toString()), {
            value: ethers.parseEther('1')
        });
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                return cdp.interface.parseLog(log)?.name === 'PositionOpened';
            } catch { return false; }
        });
        posId = cdp.interface.parseLog(event).args.posID;
        
        const position = await cdp.positions(posId);
        const actualBalance = await flatCoin.balanceOf(position.owner);
        expect(actualBalance).to.equal(ethers.parseEther(coinsMintAmount.toString()));
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        await flatCoin.connect(user5).transfer(recipient.address, ethers.parseEther('950'));
        
        const userBalance = await flatCoin.balanceOf(position.owner);
        const recipientBalance = await flatCoin.balanceOf(recipient.address);
        
        expect(recipientBalance).to.equal(ethers.parseEther('950'));
        expect(userBalance).to.equal(ethers.parseEther('50'));
        
        await cdp.connect(user5).updateCDP(posId, ethers.parseEther(coinsMintAmount.toString()));
        
        await expect(
            cdp.transferInterest(posId)
        ).to.be.reverted;
        
        await flatCoin.connect(recipient).transfer(user5.address, ethers.parseEther('50'));
        await flatCoin.connect(user5).approve(await cdp.getAddress(), ethers.parseEther('100'));
        await cdp.connect(user5).transferInterest(posId);
        
        const feeAfter = await cdp.totalCurrentFee(posId);
        expect(feeAfter).to.equal(0n);
        
        const cdpBalance = await flatCoin.balanceOf(await cdp.getAddress());
        expect(Number(ethers.formatEther(cdpBalance))).to.be.closeTo(189, 0.01);
        
        console.log("✅ Additional fee generated and transferred");
    });

    it("should allow and transfer surplus to auction and create RuleBuyOut", async function () {
        const cdpBalance = await flatCoin.balanceOf(await cdp.getAddress());
        const totalSupply = await flatCoin.totalSupply();
        const stabPercent = await dao.params('stabilizationFundPercent');
        
        const cdpBalanceNum = Number(ethers.formatEther(cdpBalance));
        const totalSupplyNum = Number(ethers.formatEther(totalSupply));
        const surplus = Math.floor(cdpBalanceNum - (totalSupplyNum * Number(stabPercent) / 100));
        
        expect(surplus).to.be.closeTo(134, 0.01);
        
        // Передаем 1% Rule токенов от ruleHolder на account7 для инициации аукциона
        const ruleSupply = await rule.totalSupply();
        const minRulePercent = await dao.params('minRuleTokensToInitVotingPercent');
        const minRuleAmount = ruleSupply * BigInt(minRulePercent) / 100n;
        await rule.connect(ruleHolder).transfer(account7.address, minRuleAmount);
        
        await cdp.allowSurplusToAuction();
        
        const tx = await auction.connect(account7).initRuleBuyOut();
        
        // newAuction(auctionType, auctionID, lotAmount, lotAddress, paymentAmount)
        await expect(tx)
            .to.emit(auction, 'newAuction');
        
        console.log("✅ Surplus transferred to auction, RuleBuyOut created");
    });
});

