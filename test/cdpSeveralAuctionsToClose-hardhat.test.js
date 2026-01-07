const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP several auctions to close position (Hardhat version)", function () {
    let dao, cdp, oracle, flatCoin, auction, rule;
    let owner, author, bidder;
    const posId = 0;

    before(async function () {
        console.log("Deploying CDP Several Auctions contracts...");
        
        const { deployFullSystem } = require("./helpers/contracts");
        const signers = await ethers.getSigners();
        const system = await deployFullSystem({
            useFutureAddress: true,
            renewContracts: true,
            initializeBasket: true,
            oracleAuthor: signers[5]
        });
        
        dao = system.dao;
        cdp = system.cdp;
        flatCoin = system.flatCoin;
        rule = system.rule;
        oracle = system.oracle;
        auction = system.auction;
        owner = system.owner;
        const accounts = system.accounts;
        [, , , , author, , , bidder] = accounts;
        
        console.log("✅ Contracts deployed");
    });

    it("should open a cdp", async function () {
        await cdp.connect(author).openCDP(ethers.parseEther('1000'), {
            value: ethers.parseEther('1')
        });
        
        expect(await flatCoin.totalSupply()).to.equal(ethers.parseEther('1000'));
        expect(await flatCoin.balanceOf(author.address)).to.equal(ethers.parseEther('1000'));
        
        console.log("✅ CDP opened");
    });

    it("should change a quote and mark to liquidate position", async function () {
        await oracle.connect(author).updateSinglePrice(1, 1100000000);
        expect(await oracle.getPrice('eth')).to.equal(1100000000n);
        
        const tx = await cdp.markToLiquidate(posId);
        
        await expect(tx)
            .to.emit(cdp, 'liquidationStatusChanged')
            .withArgs(posId, 1);
        
        console.log("✅ Position marked for liquidation");
    });

    it("should liquidate position", async function () {
        const marginCallTimeLimit = await dao.params("marginCallTimeLimit");
        await time.increase(Number(marginCallTimeLimit));
        
        const tx = await cdp.claimMarginCall(posId);
        
        await expect(tx)
            .to.emit(cdp, 'liquidationStatusChanged')
            .withArgs(posId, 2);
        
        await expect(tx)
            .to.emit(cdp, 'liquidateCollateral')
            .withArgs(1, posId, ethers.parseEther('1'));
        
        const position = await cdp.positions(posId);
        expect(position.liquidationAuctionID).to.equal(1n);
        
        console.log("✅ Position liquidated");
    });

    it("should bid and finish auction", async function () {
        await oracle.connect(author).updateSinglePrice(1, 3100000000);
        await cdp.connect(bidder).openCDP(ethers.parseEther('2000'), {
            value: ethers.parseEther('1')
        });
        await flatCoin.connect(bidder).transfer(await cdp.getAddress(), ethers.parseEther('10'));
        
        await flatCoin.connect(bidder).approve(await auction.getAddress(), ethers.parseEther('980'));
        await auction.connect(bidder).makeBid(1, ethers.parseEther('980'));
        
        const auctionTurnDuration = await dao.params("auctionTurnDuration");
        await time.increase(Number(auctionTurnDuration));
        
        await expect(
            auction.claimToFinalizeAuction(1)
        ).to.be.revertedWith("CDP only");
        
        const tx = await cdp.finishMarginCall(0);
        
        // newAuction(auctionType, auctionID, lotAmount, lotAddress, paymentAmount)
        await expect(tx)
            .to.emit(auction, 'newAuction');
        
        console.log("✅ First auction finished, second auction created");
    });
});

