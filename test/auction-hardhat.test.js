const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction (Hardhat version)", function () {
    let dao, stableCoin, auction, cdp, rule;
    let owner, bidder, newBidder, ruleHolder;

    before(async function () {
        console.log("Deploying Auction contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const signers = await ethers.getSigners();
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true,
            ruleHolder: signers[7]
        });
        
        dao = system.dao;
        cdp = system.cdp;
        stableCoin = system.flatCoin;
        rule = system.rule;
        auction = system.auction;
        owner = system.owner;
        const accounts = system.accounts;
        [, bidder, newBidder, , , , ruleHolder] = accounts;
        
        console.log("✅ Auction contracts deployed");
    });

    it("should throw if little rule on balance to init auction", async function () {
        await expect(
            auction.initRuleBuyOut()
        ).to.be.revertedWith("not enough rule");
        
        console.log("✅ Rule balance check works");
    });

    it("should throw if little money on balance", async function () {
        const totalSupply = await rule.totalSupply();
        const minPercent = await dao.params('minRuleTokensToInitVotingPercent');
        const minAmount = (totalSupply * minPercent) / 100n;
        
        await rule.connect(ruleHolder).transfer(bidder.address, minAmount);
        
        await expect(
            auction.connect(bidder).initRuleBuyOut()
        ).to.be.revertedWith("nothing allowed");
        
        console.log("✅ CDP balance check works");
    });

    it("should initAuction", async function () {
        await cdp.connect(bidder).openCDP(ethers.parseEther('2100'), {
            value: ethers.parseEther('1')
        });
        
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        const feeToAllow = await cdp.totalCurrentFee(0);
        await stableCoin.connect(bidder).approve(await cdp.getAddress(), feeToAllow + ethers.parseEther('0.0001'));
        await cdp.connect(bidder).transferInterest(0);
        
        const cdpBalance = await stableCoin.balanceOf(await cdp.getAddress());
        expect(Number(ethers.formatEther(cdpBalance))).to.be.closeTo(Number(ethers.formatEther(feeToAllow)), 0.01);
        
        await cdp.allowSurplusToAuction();
        const tx = await auction.connect(bidder).initRuleBuyOut();
        
        // Просто проверяем что событие newAuction было эмитировано
        await expect(tx).to.emit(auction, 'newAuction');
        
        const auctionBalance = await stableCoin.balanceOf(await auction.getAddress());
        expect(Number(ethers.formatEther(auctionBalance))).to.be.greaterThan(50);
        
        console.log("✅ Auction initiated");
    });

    it("should not allow to make a bid on non-existent auction", async function () {
        await expect(
            auction.makeBid(100, 100)
        ).to.be.revertedWith("wrong ID");
        
        console.log("✅ Non-existent auction check works");
    });

    it("should not allow to make a little bid", async function () {
        await rule.connect(ruleHolder).approve(await auction.getAddress(), 1);
        
        await expect(
            auction.connect(ruleHolder).makeBid(1, 0)
        ).to.be.revertedWith("not enough");
        
        console.log("✅ Minimum bid check works");
    });

    it("should make a bid", async function () {
        const bidAmount = ethers.parseEther('100');
        await rule.connect(bidder).approve(await auction.getAddress(), bidAmount);
        await time.increase(1);
        
        const balanceBefore = await rule.balanceOf(bidder.address);
        
        const tx = await auction.connect(bidder).makeBid(1, bidAmount);
        const receipt = await tx.wait();
        
        // Проверяем событие newBid
        const event = receipt.logs.find(log => {
            try {
                const parsed = auction.interface.parseLog(log);
                return parsed?.name === 'newBid' && 
                       parsed.args.auctionID === 1n &&
                       parsed.args.bidAmount === bidAmount &&
                       parsed.args.owner === bidder.address;
            } catch { return false; }
        });
        expect(event).to.not.be.undefined;
        
        const balanceAfter = await rule.balanceOf(bidder.address);
        expect(balanceAfter).to.equal(balanceBefore - bidAmount);
        
        console.log("✅ Bid placed successfully");
    });

    it("should not allow to cancel a bid", async function () {
        await expect(
            auction.connect(owner).cancelBid(1)
        ).to.be.revertedWith("not owner");
        
        await expect(
            auction.connect(bidder).cancelBid(1)
        ).to.be.revertedWith("cancel failed - best bid");
        
        console.log("✅ Bid cancellation rules work");
    });

    it("should cancel a bid and transfer funds back", async function () {
        const bidAmount = ethers.parseEther('200');
        await rule.connect(ruleHolder).transfer(newBidder.address, bidAmount);
        await rule.connect(newBidder).approve(await auction.getAddress(), bidAmount);
        await auction.connect(newBidder).makeBid(1, bidAmount);
        
        const balanceBefore = await rule.balanceOf(bidder.address);
        const tx = await auction.connect(bidder).cancelBid(1);
        
        await expect(tx)
            .to.emit(auction, 'bidCanceled')
            .withArgs(1);
        
        const balanceAfter = await rule.balanceOf(bidder.address);
        expect(balanceAfter).to.be.greaterThan(balanceBefore);
        
        console.log("✅ Bid canceled and funds returned");
    });

    it("should not allow to finalize auction early", async function () {
        await expect(
            auction.claimToFinalizeAuction(0)
        ).to.be.revertedWith("wrong auction");
        
        await expect(
            auction.claimToFinalizeAuction(1)
        ).to.be.revertedWith("too early");
        
        console.log("✅ Early finalization prevented");
    });

    it("should finalize auction and pass assets", async function () {
        const auctionToFinish = 1;
        const auctionTurnDuration = await dao.params("auctionTurnDuration");
        await time.increase(Number(auctionTurnDuration) + 10);
        
        const cdpRuleBalanceBefore = await rule.balanceOf(await cdp.getAddress());
        expect(cdpRuleBalanceBefore).to.equal(0n);
        
        const a = await auction.auctions(auctionToFinish);
        const b = await auction.bids(a.bestBidID);
        const bidderStableCoinBalanceBefore = await stableCoin.balanceOf(b.owner);
        
        const tx = await auction.claimToFinalizeAuction(auctionToFinish);
        const receipt = await tx.wait();
        
        // Проверяем событие auctionFinished
        const event = receipt.logs.find(log => {
            try {
                const parsed = auction.interface.parseLog(log);
                return parsed?.name === 'auctionFinished' && 
                       parsed.args.auctionID === BigInt(auctionToFinish) &&
                       parsed.args.bestBidID === a.bestBidID;
            } catch { return false; }
        });
        expect(event).to.not.be.undefined;
        
        const bidderStableCoinBalanceAfter = await stableCoin.balanceOf(b.owner);
        expect(bidderStableCoinBalanceAfter).to.be.greaterThan(bidderStableCoinBalanceBefore);
        
        const cdpRuleBalanceAfter = await rule.balanceOf(await cdp.getAddress());
        expect(cdpRuleBalanceAfter).to.be.greaterThan(0n);
        
        console.log("✅ Auction finalized successfully");
    });
});

