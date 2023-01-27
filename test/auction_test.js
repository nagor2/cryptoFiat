const { time } = require('@openzeppelin/test-helpers');

var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Auction = artifacts.require("./Auction.sol");
var CDP = artifacts.require("./CDP.sol");
var Rule = artifacts.require("./Rule.sol");

const truffleAssert = require('truffle-assertions');


contract('Auction', (accounts) => {
    let dao;
    let stableCoin;
    let auction;
    let cdp;
    let rule;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        stableCoin = await StableCoin.deployed(dao.address);
        auction = await Auction.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        rule = await Rule.deployed(dao.address);
    });

    it("should throw if little money on balance", async () => {
        await truffleAssert.fails(
            auction.initRuleBuyOut(),
            truffleAssert.ErrorType.REVERT,
            "Can not transfer surplus from CDP");
    });

    it("should initAuction", async () => {
        await cdp.openCDP(web3.utils.toWei('2100', 'ether'), {
            from: accounts[2],
            value: web3.utils.toWei('1', 'ether')
        });
        await time.increase(time.duration.years(1));//1 year in seconds. It may sometimes fail
        let feeToAllow = await cdp.totalCurrentFee(0);
        await stableCoin.approve(cdp.address, web3.utils.toWei(feeToAllow+0.0001, 'ether'), {from:accounts[2]});
        await cdp.transferFee(0);
        let cdpBalance = await stableCoin.balanceOf(cdp.address);
        assert.equal(parseFloat(cdpBalance/10**18).toFixed(4), parseFloat(feeToAllow/10**18).toFixed(4), "Wrong balance");
        await cdp.allowSurplusToAuction();
        let initTx = await auction.initRuleBuyOut();

        truffleAssert.eventEmitted(initTx, 'buyOutInit', async (ev) => {
            assert.equal(ev.auctionID, 0, "Should be the first auction");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 84, "Should be correct amount");
            assert.equal(ev.lotAddress, stableCoin.address, "Should be correct address");
        });

        assert.equal(parseFloat(await stableCoin.balanceOf(auction.address)/10**18).toFixed(0), 84, "ballance of auction should increase");
    });

    it("should not allow to make a bid on non-existent auction", async () => {
        await truffleAssert.fails(
            auction.makeBid(1, 100),
            truffleAssert.ErrorType.REVERT,
            "auctionId is wrong or it is already finished");
    });

    it("should not allow to make a little bid", async () => {
        await rule.approve(auction.address, 1, {from: accounts[2]});
        await truffleAssert.fails(
            auction.makeBid(0, 0),
            truffleAssert.ErrorType.REVERT,
            "your bid is not high enough");
    });

    it("should make a bid", async () => {
        let bidder = accounts[2];
        await rule.mint(accounts[2], 2,{from:bidder});
        await rule.approve(auction.address, 1, {from: bidder});

        let balanceBefore = await rule.balanceOf(bidder);
        assert.equal(parseFloat(balanceBefore), 2, "Wrong balance before");

        let bidTx = await auction.makeBid(0, 1, {from: bidder});

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal(ev.auctionID, 0, "Should be correct auction");
            assert.equal(ev.bidAmount, 1, "Should be correct amount");
        });

        let balanceAfter = await rule.balanceOf(bidder);
        assert.equal(parseFloat(balanceAfter), 1, "Wrong balance after");
    });

    it("should not allow to cancel a bid", async () => {
        await truffleAssert.fails(
            auction.cancelBid(1, {from: accounts[1]}),
            truffleAssert.ErrorType.REVERT,
            "Only bid owner may cancel it, if it wasn't canceled earlier");

        await truffleAssert.fails(
            auction.cancelBid(1, {from: accounts[2]}),
            truffleAssert.ErrorType.REVERT,
            "You can not cancel a bid if it is a best one");

    });

    it("should cancel a bid and transfer funds back", async () => {
        let formerBidder = accounts[2];
        let newBidder = accounts[3];
        await rule.mint(newBidder, 2,{from:newBidder});
        await rule.approve(auction.address, 2, {from: newBidder});
        await auction.makeBid(0, 2, {from: newBidder});

        let balanceBefore = await rule.balanceOf(formerBidder);
        assert.equal(parseFloat(balanceBefore), 1, "Wrong balance before");
        let bidTx = await auction.cancelBid(1, {from: formerBidder});


        truffleAssert.eventEmitted(bidTx, 'bidCanceled', async (ev) => {
            assert.equal(ev.bidId, 1, "bid should be canceled");
        });
        let balanceAfter = await rule.balanceOf(formerBidder);
        assert.equal(parseFloat(balanceAfter), 2, "Wrong balance after");

        let b = await auction.bids(1);
        assert.equal(b.canceled, true, "bid should be marked as canceled");
    });

    it("should not allow to finilize auction", async () => {
        await truffleAssert.fails(
            auction.claimToFinalizeAuction(1),
            truffleAssert.ErrorType.REVERT,
            "the auction is finished or non-existent");
        await truffleAssert.fails(
            auction.claimToFinalizeAuction(0),
            truffleAssert.ErrorType.REVERT,
            "it is too early to finalize, wait a bit");

        await time.increase(890);

        await truffleAssert.fails(
            auction.claimToFinalizeAuction(0),
            truffleAssert.ErrorType.REVERT,
            "it is too early to finalize, wait a bit");
    });

    it("should finilize auction and pass assets", async () => {
        const auctionToFinish = 0;
        await time.increase(10);

        let cdpRuleBalanceBefore = await rule.balanceOf(cdp.address);
        assert.equal (cdpRuleBalanceBefore, 0, "balance should be 0");
        let a = await auction.auctions(auctionToFinish);
        let b = await auction.bids(a.bestBidId);
        let bidderStableCoinBalanceBefore = await stableCoin.balanceOf(b.owner);
        assert.equal (bidderStableCoinBalanceBefore, 0, "balance should be 0");

        let auFinishTx = await auction.claimToFinalizeAuction(auctionToFinish);

        truffleAssert.eventEmitted(auFinishTx, 'buyOutFinished', async (ev) => {
            assert.equal(ev.auctionID, auctionToFinish, "id should be correct");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 84, "stableCoinAmount should be correct");
            expect(ev.bestBid).to.eql(b.bidAmount, "rulePassedToCDP should be correct");
        });

        let cdpRuleBalanceAfter = await rule.balanceOf(cdp.address);
        assert.equal (cdpRuleBalanceAfter, 2, "balance should be 0");
        let bidderStableCoinBalanceAfter = await stableCoin.balanceOf(b.owner);
        assert.equal (parseFloat(bidderStableCoinBalanceAfter/10**18).toFixed(0), 84, "balance should be 84");
    });


});

