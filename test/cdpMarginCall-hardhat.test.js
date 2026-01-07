const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CDP margin call (Hardhat version)", function () {
    let dao, cdp, oracle, flatCoin, auction, rule;
    let owner, author, recipient;
    let posId;

    before(async function () {
        console.log("Deploying CDP Margin Call contracts...");
        
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
        [, , , , author, , , recipient] = accounts;
        
        console.log("✅ Margin Call contracts deployed");
    });

    it("should openCDP", async function () {
        const coinsMintAmount = 2000;
        const tx = await cdp.connect(author).openCDP(ethers.parseEther(coinsMintAmount.toString()), {
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
        await flatCoin.connect(author).transfer(recipient.address, ethers.parseEther(coinsMintAmount.toString()));
        
        console.log("✅ CDP opened, position ID:", posId.toString());
    });

    it("should not mark pos on liquidation if eth value is still enough and mark if not", async function () {
        await oracle.connect(author).updateSinglePrice(1, 3000000000);
        
        await expect(
            cdp.markToLiquidate(posId)
        ).to.be.revertedWith("collateral is enough");
        
        await oracle.connect(author).updateSinglePrice(1, 1428000000);
        
        const tx = await cdp.markToLiquidate(posId);
        
        await expect(tx)
            .to.emit(cdp, 'liquidationStatusChanged')
            .withArgs(posId, 1);
        
        const position = await cdp.positions(posId);
        expect(position.liquidationStatus).to.equal(1);
        
        console.log("✅ Position marked for liquidation");
    });

    it("should set position on liquidation and claim margin call", async function () {
        const positionBefore = await cdp.positions(posId);
        expect(positionBefore.liquidationStatus).to.equal(1);
        expect(positionBefore.liquidationAuctionID).to.equal(0n);
        
        await expect(
            cdp.claimMarginCall(posId)
        ).to.be.revertedWith("not on liquidation/owner still has time");
        
        const marginCallTimeLimit = await dao.params("marginCallTimeLimit");
        await time.increase(Number(marginCallTimeLimit));
        
        const auctionEthBalanceBefore = await ethers.provider.getBalance(await auction.getAddress());
        expect(auctionEthBalanceBefore).to.equal(0n);
        
        const cdpEthBalanceBefore = await ethers.provider.getBalance(await cdp.getAddress());
        expect(cdpEthBalanceBefore).to.equal(positionBefore.ethAmountLocked);
        
        const tx = await cdp.claimMarginCall(posId);
        
        await expect(tx)
            .to.emit(cdp, 'liquidationStatusChanged')
            .withArgs(posId, 2);
        
        await expect(tx)
            .to.emit(cdp, 'liquidateCollateral')
            .withArgs(1, posId, positionBefore.ethAmountLocked);
        
        const auctionEthBalanceAfter = await ethers.provider.getBalance(await auction.getAddress());
        expect(auctionEthBalanceAfter).to.equal(positionBefore.ethAmountLocked);
        
        const cdpEthBalanceAfter = await ethers.provider.getBalance(await cdp.getAddress());
        expect(cdpEthBalanceAfter).to.equal(0n);
        
        const positionAfter = await cdp.positions(posId);
        expect(positionAfter.liquidationAuctionID).to.not.equal(0n);
        
        console.log("✅ Margin call claimed, auction created");
    });

    it("should finishMarginCall and decrease coinsMinted and totalSupply (with bids improvement)", async function () {
        let position = await cdp.positions(posId);
        await time.increase(1);
        
        await flatCoin.connect(recipient).approve(await auction.getAddress(), ethers.parseEther('1900'));
        const bidTx = await auction.connect(recipient).makeBid(position.liquidationAuctionID, ethers.parseEther('1800'));
        
        let bidId;
        const receipt = await bidTx.wait();
        for (const log of receipt.logs) {
            try {
                const parsed = auction.interface.parseLog(log);
                if (parsed?.name === 'newBid') {
                    bidId = parsed.args.bidID;
                    expect(parsed.args.owner).to.equal(recipient.address);
                    expect(parsed.args.bidAmount).to.equal(ethers.parseEther('1800'));
                }
            } catch {}
        }
        
        await expect(
            auction.connect(recipient).improveBid(bidId, ethers.parseEther('1801'))
        ).to.be.revertedWith("not high enough");
        
        await expect(
            auction.improveBid(bidId, ethers.parseEther('9000'))
        ).to.be.revertedWith("not owner");
        
        await auction.connect(recipient).improveBid(bidId, ethers.parseEther('1900'));
        
        const auctionTurnDuration = await dao.params("auctionTurnDuration");
        await time.increase(Number(auctionTurnDuration) + 1);
        
        await cdp.connect(owner).openCDP(ethers.parseEther('2000'), {
            value: ethers.parseEther('3')
        });
        
        await cdp.finishMarginCall(posId);
        
        position = await cdp.positions(posId);
        expect(await flatCoin.totalSupply()).to.equal(ethers.parseEther('2100'));
        expect(position.coinsMinted).to.equal(ethers.parseEther('100'));
        
        console.log("✅ Margin call finished, debt reduced");
    });

    it("should receive rule tokens to recipient and decrease stubFund deficit", async function () {
        const position = await cdp.positions(posId);
        
        expect(position.liquidationStatus).to.equal(2);
        
        await flatCoin.connect(recipient).approve(await auction.getAddress(), ethers.parseEther('50'));
        
        const auctionId = Number(position.liquidationAuctionID) + 1;
        const auctionEntity = await auction.auctions(auctionId);
        
        expect(auctionEntity.paymentAmount).to.equal(ethers.parseEther('50'));
        
        await time.increase(1);
        
        await expect(
            auction.connect(recipient).makeBid(auctionId, ethers.parseEther('10001'))
        ).to.be.revertedWith("too many rules");
        
        await auction.connect(recipient).makeBid(auctionId, ethers.parseEther('10000'));
        
        const auctionTurnDuration = await dao.params("auctionTurnDuration");
        await time.increase(Number(auctionTurnDuration) + 1);
        
        await auction.claimToFinalizeAuction(auctionId);
        
        expect(await flatCoin.totalSupply()).to.equal(ethers.parseEther('2100'));
        expect(position.coinsMinted).to.equal(ethers.parseEther('100'));
        expect(await rule.balanceOf(recipient.address)).to.equal(ethers.parseEther('10000'));
        expect(await flatCoin.balanceOf(await cdp.getAddress())).to.equal(ethers.parseEther('50'));
        
        console.log("✅ Rule tokens minted for bidder");
    });

    it("should reset quotes back to initial values", async function () {
        await oracle.connect(author).updateSinglePrice(1, 3100000000);
        console.log("✅ Oracle prices reset");
    });
});

