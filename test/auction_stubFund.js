const { time } = require('@openzeppelin/test-helpers');

var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Auction = artifacts.require("./Auction.sol");
var CDP = artifacts.require("./CDP.sol");
var Rule = artifacts.require("./Rule.sol");

const truffleAssert = require('truffle-assertions');


contract('Auction initCoinsBuyOutForStabilization', (accounts) => {
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
        await auction.renewContracts();
    });

    it("should init and execute coins buyOut for stabilization", async () => {
        let auctionId;

        let bidder = accounts[2];
        let bidder2 = accounts[5];

        await cdp.openCDP(web3.utils.toWei('2100', 'ether'), {from: bidder,
            value: web3.utils.toWei('1')});

        let stubFund = await stableCoin.balanceOf(await dao.addresses('cdp'));
        assert.equal(await stableCoin.balanceOf(await dao.addresses('cdp')), 0, "should be zero first");
        let neededFund = await dao.params('stabilizationFundPercent') * await stableCoin.totalSupply()/100;
        neededFund = parseFloat(neededFund/10**18).toFixed();
        assert.equal(neededFund, 105, "wrong needed fund");

        let paymentAmount = web3.utils.toWei((neededFund - stubFund).toString());

        await truffleAssert.fails(
            auction.initCoinsBuyOutForStabilization(paymentAmount, {from:bidder2}),
            truffleAssert.ErrorType.REVERT,
            "too many coins for one auction");

        paymentAmount = await dao.params('maxCoinsForStabilization');

        //console.log(web3.utils.fromWei(paymentAmount));

        let auctionTx = await auction.initCoinsBuyOutForStabilization(paymentAmount);

        truffleAssert.eventEmitted(auctionTx, 'buyOutInit', async (ev) => {
            assert.equal(ev.auctionID, 0, "Should be the first auction");
            auctionId = ev.auctionID;
            assert.equal(parseFloat(ev.lotAmount/10**18).toFixed(0), 0, "Should be zero amount");
            assert.equal(ev.lotAddress, rule.address, "Should be correct address");
        });

        let a = await auction.auctions(auctionId);

        assert.equal(paymentAmount.toString(), a.paymentAmount, "wrong paymentAmount set");
        assert.equal(rule.address, a.lotToken, "wrong lotToken set");
        assert.equal(stableCoin.address, a.paymentToken, "wrong paymentToken set");

        await stableCoin.transfer(bidder2, paymentAmount, {from:bidder});

        let balanceBefore = await stableCoin.balanceOf(bidder);
        let balanceBefore2 = await stableCoin.balanceOf(bidder2);

        assert.equal(web3.utils.fromWei(balanceBefore), '2050', "wrong balanceBefore")
        assert.equal(web3.utils.fromWei(balanceBefore2), '50', "wrong balanceBefore2")

        assert.ok((parseFloat(balanceBefore/10**18)>=parseFloat(paymentAmount/10**18)), "bidder does not have enough funds to make a bid");
        assert.ok((parseFloat(balanceBefore2/10**18)>=parseFloat(paymentAmount/10**18)), "bidder2 does not have enough funds to make a bid");

        await stableCoin.approve(auction.address, paymentAmount, {from:bidder});
        await stableCoin.approve(auction.address, paymentAmount, {from:bidder2});

        let bidIdToImprove;
        let bidIdToCancel;

        await truffleAssert.fails(
            auction.makeBid(auctionId, web3.utils.toWei('10001'), {from:bidder}),
            truffleAssert.ErrorType.REVERT,
            "too many rules for one emission");

        let bidTx = await auction.makeBid(auctionId, web3.utils.toWei('1000'), {from:bidder});

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal(parseFloat(ev.auctionID), auctionId, "Should be the first auction");
            bidIdToImprove = parseFloat(ev.bidId);
            assert.equal(parseFloat(ev.bidAmount/10**18).toFixed(0), 1000, "Should be correct amount");
        });

        let bestBidAmount = await auction.getBestBidAmount(auctionId);
        assert.equal(parseFloat(bestBidAmount/10**18).toFixed(0), 1000, "Should be correct bestBid");

        await truffleAssert.fails(
            auction.makeBid(auctionId, web3.utils.toWei('1100'), {from:bidder2}),
            truffleAssert.ErrorType.REVERT,
            "your bid is not low enough");

        await truffleAssert.fails(
            auction.makeBid(auctionId, web3.utils.toWei('998'), {from:bidder2}),
            truffleAssert.ErrorType.REVERT,
            "your bid is not low enough");

        bidTx = await auction.makeBid(auctionId, web3.utils.toWei('950'), {from:bidder2});

        bestBidAmount = await auction.getBestBidAmount(auctionId);
        assert.equal(parseFloat(bestBidAmount/10**18).toFixed(0), 950, "Should be correct bestBid");

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal(parseFloat(ev.auctionID), auctionId, "Should be the first auction");
            bidIdToCancel = parseFloat(ev.bidId);
            assert.equal(parseFloat(ev.bidAmount/10**18).toFixed(0), 950, "Should be correct amount");
        });

        await truffleAssert.fails(
            auction.improveBid(bidIdToImprove, web3.utils.toWei('902.5'), {from:bidder2}),
            truffleAssert.ErrorType.REVERT,
            "You may improve only your personal bids");

        await time.increase(time.duration.seconds(30));

        bidTx = await auction.improveBid(bidIdToImprove, web3.utils.toWei('902.5'), {from:bidder});
        bestBidAmount = await auction.getBestBidAmount(auctionId);
        assert.equal(parseFloat(bestBidAmount/10**18).toFixed(1), 902.5, "Should be correct bestBid");

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal(parseFloat(ev.auctionID), auctionId, "Should be correct auction");
            assert.equal(parseFloat(ev.bidId), bidIdToImprove, "Should be correct auction");
            assert.equal(parseFloat(ev.bidAmount/10**18).toFixed(1), 902.5, "Should be correct amount");
        });

        await time.increase(time.duration.minutes(30));

        let ruleSupplyBefore = await rule.totalSupply();

        assert.equal(parseFloat(await stableCoin.balanceOf(auction.address)/10**18).toFixed(), 100, "wrong balance");

        await auction.claimToFinalizeAuction(auctionId);

        let ruleSupplyAfter = await rule.totalSupply();

        assert.equal(parseFloat(await stableCoin.balanceOf(bidder)/10**18).toFixed(), 2000, "wrong balance");
        assert.equal(parseFloat(await stableCoin.balanceOf(bidder2)/10**18).toFixed(), 0, "wrong balance");
        assert.equal(parseFloat(await stableCoin.balanceOf(cdp.address)/10**18).toFixed(), 50, "wrong balance");
        assert.equal(parseFloat(await stableCoin.balanceOf(auction.address)/10**18).toFixed(), 50, "wrong balance");

        assert.equal(parseFloat(ruleSupplyBefore)+902.5*10**18, parseFloat(ruleSupplyAfter), "wrong ruleSupply");
        assert.equal(parseFloat(await rule.balanceOf(bidder)/10**18).toFixed(1), 902.5, "wrong balance");

        await auction.cancelBid(bidIdToCancel, {from: bidder2});
        assert.equal(parseFloat(await stableCoin.balanceOf(auction.address)/10**18).toFixed(), 0, "wrong balance");
        assert.equal(parseFloat(await stableCoin.balanceOf(bidder2)/10**18).toFixed(), 50, "wrong balance");

        /*
            1. Проверяем стаб фонд, что нужны деньги.
            2. Инициируем выкуп (проверяем, что выкупаем нужное количество монет.
            3. Проверяем, что аукцион идет на понижение.
            4. После финализации, проверяем, что произошел минт рулов, что стэйблы перешли куда надо.
            5. Проверяем, что за раз нельзя выкупить более 50 стэйблов с рынка
            6. Проверяем, что нельзя сделать более 1% эмиссии рулов.
        */
    });

    //TODO: test improve bid
});



