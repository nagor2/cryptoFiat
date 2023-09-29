const { time } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address')

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
    let bidder = accounts[2];
    let newBidder = accounts[3];
    let ruleHolder = accounts[7];

    async function a()  {
        for (var i=-15; i<19; i++){
            console.log(i+") "+await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))+i)}))
        }
    }

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        stableCoin = await StableCoin.deployed(futureDaoAddress, {from: accounts[0]});
        rule = await Rule.deployed(futureDaoAddress, {from:ruleHolder});
        auction = await Auction.deployed(futureDaoAddress, {from: accounts[0]});
        cdp = await CDP.deployed(futureDaoAddress, {from: accounts[0]});
        dao = await INTDAO.deployed([0x0, cdp.address, auction.address,0x0,0x0, 0x0, rule.address, stableCoin.address,0x0], {from: accounts[0]});

        await cdp.renewContracts();
        await auction.renewContracts();
    });

    it("should throw if little rule on balance to init auction", async () => {
        await truffleAssert.fails(
            auction.initRuleBuyOut(),
            truffleAssert.ErrorType.REVERT,
            "not enough rule balance");
    });

    it("should throw if little money on balance", async () => {
        let minAmount = web3.utils.fromWei(await rule.totalSupply()) /100 * await dao.params('minRuleTokensToInitVotingPercent');
        await rule.transfer(bidder, web3.utils.toWei(minAmount.toString()), {from:ruleHolder});
        await truffleAssert.fails(
            auction.initRuleBuyOut({from:bidder}),
            truffleAssert.ErrorType.REVERT,
            "Can not transfer surplus from CDP");
    });

    it("should initAuction", async () => {
        await cdp.openCDP(web3.utils.toWei('2100', 'ether'), {
            from: bidder,
            value: web3.utils.toWei('1', 'ether')
        });
        await time.increase(time.duration.years(1));//1 year in seconds. It may sometimes fail
        let feeToAllow = await cdp.totalCurrentFee(0);
        await stableCoin.approve(cdp.address, web3.utils.toWei(feeToAllow+0.0001, 'ether'), {from:bidder});
        await cdp.transferInterest(0, {from: bidder});
        let cdpBalance = await stableCoin.balanceOf(cdp.address);
        assert.equal(parseFloat(cdpBalance/10**18).toFixed(4), parseFloat(feeToAllow/10**18).toFixed(4), "Wrong balance");
        await cdp.allowSurplusToAuction();
        let initTx = await auction.initRuleBuyOut({from:bidder});

        truffleAssert.eventEmitted(initTx, 'buyOutInit', async (ev) => {
            assert.equal(ev.auctionID, 1, "Should be the first auction");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 84, "Should be correct amount");
            assert.equal(ev.lotAddress, stableCoin.address, "Should be correct address");
        });

        assert.equal(parseFloat(await stableCoin.balanceOf(auction.address)/10**18).toFixed(0), 84, "ballance of auction should increase");
    });

    it("should not allow to make a bid on non-existent auction", async () => {
        await truffleAssert.fails(
            auction.makeBid(100, 100),
            truffleAssert.ErrorType.REVERT,
            "auctionId is wrong or it is already finished");
    });

    it("should not allow to make a little bid", async () => {
        await rule.approve(auction.address, 1, {from: ruleHolder});
        await truffleAssert.fails(
            auction.makeBid(1, 0),
            truffleAssert.ErrorType.REVERT,
            "your bid is not high enough");
    });

    it("should make a bid", async () => {
        let bidAmount = web3.utils.toWei('100');
        await rule.approve(auction.address, bidAmount, {from: bidder});
        await time.increase(1); //this is to claim to finish due to a.initTime!=a.lastTimeUpdated condition
        let balanceBefore = web3.utils.fromWei(await rule.balanceOf(bidder));
        assert.equal(parseFloat(balanceBefore), 10000, "Wrong balance before");

        let bidTx = await auction.makeBid(1, bidAmount, {from: bidder});

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal(ev.auctionID, 1, "Should be correct auction");
            assert.equal(ev.bidAmount, bidAmount, "Should be correct amount");
        });

        let balanceAfter = web3.utils.fromWei(await rule.balanceOf(bidder));
        assert.equal(parseFloat(balanceAfter), 9900, "Wrong balance after");
    });

    it("should not allow to cancel a bid", async () => {
        await truffleAssert.fails(
            auction.cancelBid(1, {from: accounts[1]}),
            truffleAssert.ErrorType.REVERT,
            "Only bid owner may cancel it, if it wasn't canceled earlier");

        await truffleAssert.fails(
            auction.cancelBid(1, {from: bidder}),
            truffleAssert.ErrorType.REVERT,
            "You can not cancel a bid if it is a best one");

    });

    it("should cancel a bid and transfer funds back", async () => {
        let bidAmount =  web3.utils.toWei('200');
        await rule.transfer(newBidder, bidAmount,{from:ruleHolder});
        await rule.approve(auction.address, bidAmount, {from: newBidder});
        await auction.makeBid(1, bidAmount, {from: newBidder});

        let balanceBefore = web3.utils.fromWei(await rule.balanceOf(bidder));
        assert.equal(parseFloat(balanceBefore), 9900, "Wrong balance before");
        let bidTx = await auction.cancelBid(1, {from: bidder});


        truffleAssert.eventEmitted(bidTx, 'bidCanceled', async (ev) => {
            assert.equal(ev.bidId, 1, "bid should be canceled");
        });
        let balanceAfter = web3.utils.fromWei(await rule.balanceOf(bidder));
        assert.equal(parseFloat(balanceAfter), 10000, "Wrong balance after");

        let b = await auction.bids(1);
        assert.equal(b.canceled, true, "bid should be marked as canceled");
    });

    it("should not allow to finilize auction", async () => {
        await truffleAssert.fails(
            auction.claimToFinalizeAuction(0),
            truffleAssert.ErrorType.REVERT,
            "the auction is finished or non-existent");
        await truffleAssert.fails(
            auction.claimToFinalizeAuction(1),
            truffleAssert.ErrorType.REVERT,
            "it is too early to finalize, wait a bit");

        await time.increase(890);

        await truffleAssert.fails(
            auction.claimToFinalizeAuction(1),
            truffleAssert.ErrorType.REVERT,
            "it is too early to finalize, wait a bit");
    });

    it("should finilize auction and pass assets", async () => {
        const auctionToFinish = 1;
        await time.increase(10);

        let cdpRuleBalanceBefore = await rule.balanceOf(cdp.address);
        assert.equal (cdpRuleBalanceBefore, 0, "balance should be 0");
        let a = await auction.auctions(auctionToFinish);
        let b = await auction.bids(a.bestBidId);
        let bidderStableCoinBalanceBefore = await stableCoin.balanceOf(b.owner);
        assert.equal (bidderStableCoinBalanceBefore, 0, "balance should be 0");

        let auFinishTx = await auction.claimToFinalizeAuction(auctionToFinish);

        await truffleAssert.eventEmitted(auFinishTx, 'buyOutFinished', async (ev) => {
            assert.equal(ev.auctionID, auctionToFinish, "id should be correct");
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 84, "stableCoinAmount should be correct");
            expect(ev.bestBid).to.eql(b.bidAmount, "rulePassedToCDP should be correct");
        });

        let cdpRuleBalanceAfter = await rule.balanceOf(cdp.address);
        assert.equal (cdpRuleBalanceAfter, web3.utils.toWei('200'), "balance should be 200");
        let bidderStableCoinBalanceAfter = await stableCoin.balanceOf(b.owner);
        assert.equal (parseFloat(bidderStableCoinBalanceAfter/10**18).toFixed(0), 84, "balance should be 84");
    });
});

