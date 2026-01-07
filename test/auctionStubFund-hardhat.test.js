const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction initCoinsBuyOutForStabilization (Hardhat version)", function () {
    let dao, stableCoin, auction, cdp, rule;
    let owner, bidder, bidder2;
    let auctionId, bidIdToImprove, bidIdToCancel;

    before(async function () {
        console.log("Deploying Auction Stub Fund contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true
        });
        
        dao = system.dao;
        cdp = system.cdp;
        stableCoin = system.flatCoin;
        rule = system.rule;
        auction = system.auction;
        owner = system.owner;
        const accounts = system.accounts;
        [, bidder, , , bidder2] = accounts;
        
        console.log("✅ Stub Fund contracts deployed");
    });

    it("should init and execute coins buyOut for stabilization", async function () {
        await cdp.connect(bidder).openCDP(ethers.parseEther('2100'), {
            value: ethers.parseEther('1')
        });
        
        const stubFund = await stableCoin.balanceOf(await cdp.getAddress());
        expect(stubFund).to.equal(0n);
        
        const neededFund = (await dao.params('stabilizationFundPercent')) * (await stableCoin.totalSupply()) / 100n;
        const neededFundNum = Math.floor(Number(ethers.formatEther(neededFund)));
        expect(neededFundNum).to.be.closeTo(105, 0.01);
        
        let paymentAmount = await dao.params('maxCoinsForStabilization');
        
        const tx = await auction.initCoinsBuyOutForStabilization(paymentAmount);
        
        const receipt = await tx.wait();
        for (const log of receipt.logs) {
            try {
                const parsed = auction.interface.parseLog(log);
                if (parsed?.name === 'newAuction') {
                    auctionId = parsed.args.auctionID;
                    expect(auctionId).to.equal(1n);
                    expect(parsed.args.lotAddress).to.equal(await rule.getAddress());
                }
            } catch {}
        }
        
        const a = await auction.auctions(auctionId);
        expect(a.paymentAmount).to.equal(paymentAmount);
        expect(a.lotToken).to.equal(await rule.getAddress());
        expect(a.paymentToken).to.equal(await stableCoin.getAddress());
        
        await stableCoin.connect(bidder).transfer(bidder2.address, paymentAmount);
        
        const balanceBefore = await stableCoin.balanceOf(bidder.address);
        const balanceBefore2 = await stableCoin.balanceOf(bidder2.address);
        
        expect(ethers.formatEther(balanceBefore)).to.equal('2050.0');
        expect(ethers.formatEther(balanceBefore2)).to.equal('50.0');
        
        await stableCoin.connect(bidder).approve(await auction.getAddress(), paymentAmount);
        await stableCoin.connect(bidder2).approve(await auction.getAddress(), paymentAmount);
        
        await expect(
            auction.connect(bidder).makeBid(auctionId, ethers.parseEther('10001'))
        ).to.be.revertedWith("too many rules");
        
        const bidTx = await auction.connect(bidder).makeBid(auctionId, ethers.parseEther('1000'));
        
        const bidReceipt = await bidTx.wait();
        for (const log of bidReceipt.logs) {
            try {
                const parsed = auction.interface.parseLog(log);
                if (parsed?.name === 'newBid') {
                    bidIdToImprove = parsed.args.bidID;
                    expect(Number(ethers.formatEther(parsed.args.bidAmount))).to.equal(1000);
                }
            } catch {}
        }
        
        const bestBidAmount = await auction.getBestBidAmount(auctionId);
        expect(Number(ethers.formatEther(bestBidAmount))).to.equal(1000);
        
        await expect(
            auction.connect(bidder2).makeBid(auctionId, ethers.parseEther('1100'))
        ).to.be.revertedWith("not low enough");
        
        await expect(
            auction.connect(bidder2).makeBid(auctionId, ethers.parseEther('998'))
        ).to.be.revertedWith("not low enough");
        
        const bidTx2 = await auction.connect(bidder2).makeBid(auctionId, ethers.parseEther('950'));
        
        const bestBidAmount2 = await auction.getBestBidAmount(auctionId);
        expect(Number(ethers.formatEther(bestBidAmount2))).to.equal(950);
        
        const bidReceipt2 = await bidTx2.wait();
        for (const log of bidReceipt2.logs) {
            try {
                const parsed = auction.interface.parseLog(log);
                if (parsed?.name === 'newBid') {
                    bidIdToCancel = parsed.args.bidID;
                    expect(Number(ethers.formatEther(parsed.args.bidAmount))).to.equal(950);
                }
            } catch {}
        }
        
        await expect(
            auction.connect(bidder2).improveBid(bidIdToImprove, ethers.parseEther('902.5'))
        ).to.be.revertedWith("not owner");
        
        await time.increase(30);
        
        await auction.connect(bidder).improveBid(bidIdToImprove, ethers.parseEther('902.5'));
        const bestBidAmount3 = await auction.getBestBidAmount(auctionId);
        expect(Number(ethers.formatEther(bestBidAmount3))).to.be.closeTo(902.5, 0.01);
        
        const auctionTurnDuration = await dao.params("auctionTurnDuration");
        await time.increase(Number(auctionTurnDuration));
        
        const ruleSupplyBefore = await rule.totalSupply();
        
        const auctionBalance = await stableCoin.balanceOf(await auction.getAddress());
        expect(Number(ethers.formatEther(auctionBalance))).to.be.closeTo(100, 0.01);
        
        await auction.claimToFinalizeAuction(auctionId);
        
        const ruleSupplyAfter = await rule.totalSupply();
        
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(bidder.address)))).to.be.closeTo(2000, 0.01);
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(bidder2.address)))).to.be.closeTo(0, 0.01);
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(await cdp.getAddress())))).to.be.closeTo(50, 0.01);
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(await auction.getAddress())))).to.be.closeTo(50, 0.01);
        
        expect(Number(ethers.formatEther(ruleSupplyAfter)) - Number(ethers.formatEther(ruleSupplyBefore))).to.be.closeTo(902.5, 0.01);
        expect(Number(ethers.formatEther(await rule.balanceOf(bidder.address)))).to.be.closeTo(902.5, 0.01);
        
        await auction.connect(bidder2).cancelBid(bidIdToCancel);
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(await auction.getAddress())))).to.be.closeTo(0, 0.01);
        expect(Number(ethers.formatEther(await stableCoin.balanceOf(bidder2.address)))).to.be.closeTo(50, 0.01);
        
        console.log("✅ Stabilization fund auction completed successfully");
    });
});

