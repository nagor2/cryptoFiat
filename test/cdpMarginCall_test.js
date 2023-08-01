const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');
const { expectEvent } = require('@openzeppelin/test-helpers');

contract('CDP margin call', (accounts) => {

    let dao;
    let cdp;
    let weth;
    let oracle;
    let stableCoin;
    let auction;
    let posId;
    let rule;

    const author = accounts[5];
    const recipient = accounts[8];

    var CDP = artifacts.require("./CDP.sol");
    var INTDAO = artifacts.require("./INTDAO.sol");
    var Oracle = artifacts.require("./exchangeRateContract.sol");
    var StableCoin = artifacts.require("./stableCoin.sol");
    var Auction = artifacts.require("./Auction.sol");
    var Weth = artifacts.require("./WETH9.sol");
    var Rule = artifacts.require("./Rule.sol");

    before('should setup the contracts instance', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        rule = await Rule.deployed(dao.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        auction = await Auction.deployed(dao.address);
        await cdp.renewContracts();
        await auction.renewContracts();
    });

    it("should openCDP", async () => {
        let owner = accounts[5];
        let coinsMintAmount = 2000;
        let posTx = await cdp.openCDP(web3.utils.toWei(String(coinsMintAmount)), {from: owner,value: web3.utils.toWei('1')});
        await truffleAssert.eventEmitted(posTx, 'PositionOpened', async (ev) => {
            posId = ev.posID.toNumber();
        });

        const position = await cdp.positions(posId);
        let actualBalance = await stableCoin.balanceOf(position.owner);
        assert.equal(actualBalance.toString(),web3.utils.toWei(String(coinsMintAmount)),"smth wrong");
        await stableCoin.transfer(recipient, web3.utils.toWei(String(coinsMintAmount)),{from:owner})
    });

    it("should not mark pos on liquidation if eth value is still enough and mark if not", async () => {
        await oracle.updateSinglePrice(0, 3000000000, {from: author});
        let markTx = await cdp.markToLiquidate(posId);
        truffleAssert.eventNotEmitted(markTx,'markedOnLiquidation');
        await oracle.updateSinglePrice(0, 1428000000, {from: author});
        markTx = await cdp.markToLiquidate(posId);
        truffleAssert.eventEmitted(markTx, 'markedOnLiquidation', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            let block = await web3.eth.getBlock("latest");
            assert.equal(ev.timestamp, block.timestamp, 'time is wrong');
            let position = await cdp.positions(posId);
            block = await web3.eth.getBlock("latest");
            assert.equal(position.markedOnLiquidationTimestamp.toString(), block.timestamp, "time is wrong 2")
        });
    });

    it("should set position on liquidation and claim margin call", async () => {
        const positionBefore = await cdp.positions(posId);
        assert.isFalse (positionBefore.onLiquidation, "position should not be no liquidation");

        await truffleAssert.fails(
            cdp.claimMarginCall(posId),
            truffleAssert.ErrorType.REVERT,
            "Position is not marked on liquidation or owner still has time"
        );

        await time.increase(time.duration.days(1)+1);

        let liquidationTx = await cdp.claimMarginCall(posId);

        truffleAssert.eventEmitted(liquidationTx, 'OnLiquidation', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            let block = await web3.eth.getBlock("latest");
            assert.equal(ev.timestamp, block.timestamp, 'time is wrong');
        });
    });

    it("should init auction", async () => {
        const positionBefore = await cdp.positions(posId);
        assert.equal (positionBefore.liquidationAuctionID, 0, "there should be no liquidationAuctionID before");


        await truffleAssert.fails(
            auction.initCoinsBuyOut(posId, positionBefore.wethAmountLocked),
            truffleAssert.ErrorType.REVERT,
            "Only CDP contract may invoke this method. Please, use startCoinsBuyOut in CDP contract"
        );

        const auctionWethBalanceBefore = await weth.balanceOf(auction.address);
        assert.equal(auctionWethBalanceBefore, 0, "wrong balance auctionWethBalanceBefore");

        const cdpWethBalanceBefore = await weth.balanceOf(cdp.address);
        expect(cdpWethBalanceBefore).to.eql(positionBefore.wethAmountLocked, "wrong balance auctionWethBalanceAfter");

        let liquidationTx = await cdp.startCoinsBuyOut(posId);



        await expectEvent.inTransaction(liquidationTx.tx, auction, 'liquidateCollateral', { auctionID:web3.utils.toBN(1), posID:web3.utils.toBN(posId), collateral:positionBefore.wethAmountLocked});

        const auctionWethBalanceAfter = await weth.balanceOf(auction.address);

        expect(auctionWethBalanceAfter).to.eql(positionBefore.wethAmountLocked, "wrong balance auctionWethBalanceAfter");

        const cdpWethBalanceAfter = await weth.balanceOf(cdp.address);
        assert.equal(cdpWethBalanceAfter, 0, "wrong balance cdpWethBalanceAfter");

        const positionAfter = await cdp.positions(posId);
        assert.isTrue(positionAfter.liquidationAuctionID!=0, "there should be a liquidationAuctionID after");
    });

    it("should finishMarginCall and decrease coinsMinted and totalSupply (with bids improvement)", async () => {
        let position = await cdp.positions(posId);
        await time.increase(1);
        await stableCoin.approve(auction.address, web3.utils.toWei('1900'),{from:recipient})
        let bidTx = await auction.makeBid(position.liquidationAuctionID, web3.utils.toWei('1800'),{from:recipient});
        let bidId;

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            bidId = ev.bidId.toNumber();
            assert.equal (ev.owner, recipient, "wrong bid owner");
            assert.equal (ev.bidAmount, web3.utils.toWei('1800'), "wrong bid amount");
        })

        await truffleAssert.fails(
            auction.improveBid(bidId, web3.utils.toWei('1801'),{from:recipient}),
            truffleAssert.ErrorType.REVERT,
            "your bid is not high enough"
        );

        await truffleAssert.fails(
            auction.improveBid(bidId, web3.utils.toWei('9000')),
            truffleAssert.ErrorType.REVERT,
            "You may improve only your personal bids"
        );

        bidTx = await auction.improveBid(bidId, web3.utils.toWei('1900'),{from:recipient});

        truffleAssert.eventEmitted(bidTx, 'newBid', async (ev) => {
            assert.equal (ev.bidId.toNumber(), bidId, "wrong bid id");
            assert.equal (ev.owner, recipient, "wrong bid owner");
            assert.equal (ev.bidAmount, web3.utils.toWei('1900'), "wrong bid amount");
        })

        await time.increase(time.duration.minutes(15)+1);
        await cdp.openCDP(web3.utils.toWei('2000'), {from: accounts[4],value: web3.utils.toWei('3')});
        await cdp.finishMarginCall(posId);

        position = await cdp.positions(posId);
        assert.equal(await stableCoin.totalSupply(), web3.utils.toWei('2100'), "wrong total supply");
        assert.equal(position.coinsMinted, web3.utils.toWei('100'), "wrong coins minted");
    });

    it("should recieve 10000 rules to recipient and decrease stubFund deficit (with bids improvement)", async () => {

        let position = await cdp.positions(posId);
        let bidId;

        assert.isFalse(position.liquidated, "position should not be liquidated");

        await stableCoin.approve(auction.address, web3.utils.toWei('50'),{from:recipient})

        const auctionId = (parseInt(position.liquidationAuctionID)+1); //next auction in loop

        const auctionEntity = await auction.auctions(auctionId);

        assert.equal(auctionEntity.paymentAmount, web3.utils.toWei('50'), "wrong auction payment amount");

        await time.increase(1);

        await truffleAssert.fails(
            auction.makeBid(auctionId, web3.utils.toWei('10001'),{from:recipient}),
            truffleAssert.ErrorType.REVERT,
            "too many rules for one emission"
        );

        let bidTx = await auction.makeBid(auctionId, web3.utils.toWei('10000'),{from:recipient});

        truffleAssert.eventEmitted(bidTx, 'newBid',async (ev) => {
            bidId = ev.bidId.toNumber();
            assert.equal (ev.owner, recipient, "wrong bid owner");
        })

        await truffleAssert.fails(
            auction.improveBid(bidId, web3.utils.toWei('9950'),{from:recipient}),
            truffleAssert.ErrorType.REVERT,
            "your bid is not high enough"
        );

        await truffleAssert.fails(
            auction.improveBid(bidId, web3.utils.toWei('9000')),
            truffleAssert.ErrorType.REVERT,
            "You may improve only your personal bids"
        );

        bidTx = await auction.improveBid(bidId, web3.utils.toWei('9000'),{from:recipient});

        truffleAssert.eventEmitted(bidTx, 'newBid',async (ev) => {
            assert.equal (bidId, ev.bidId.toNumber(), "wrong bid owner");
            assert.equal (ev.owner, recipient, "wrong bid owner");
            assert.equal (ev.bidAmount, web3.utils.toWei('9000'), "wrong bid amount");
        })

        await time.increase(time.duration.minutes(15)+1);
        await auction.claimToFinalizeAuction(auctionId);

        assert.equal(await stableCoin.totalSupply(),web3.utils.toWei('2100'), "wrong total supply")
        assert.equal(position.coinsMinted,web3.utils.toWei('100'), "wrong coinsMinted")
        assert.equal(await rule.balanceOf(recipient),web3.utils.toWei('9000'),  "wrong rule balance")
        assert.equal(await stableCoin.balanceOf(cdp.address),web3.utils.toWei('50'), "wrong cdp balance")
    });

    it("should create the last coinsBuyOut", async () => {
        await cdp.finishMarginCall(posId);
        let position = await cdp.positions(posId);
        assert.equal(await stableCoin.totalSupply(),web3.utils.toWei('2050'), "wrong total supply");
        assert.equal(position.coinsMinted,web3.utils.toWei('50'), "wrong coins minted");

        const auctionId = (parseInt(position.liquidationAuctionID)+2);
        await time.increase(1);

        await stableCoin.approve(auction.address, web3.utils.toWei('50'),{from:recipient})

        await auction.makeBid(auctionId, web3.utils.toWei('10000'),{from:recipient});

        await time.increase(time.duration.minutes(15)+1);

        await auction.claimToFinalizeAuction(auctionId);

        await cdp.finishMarginCall(posId);
        position = await cdp.positions(posId);

        assert.isTrue(position.liquidated, "position should be liquidated");
        assert.equal(await stableCoin.totalSupply(),web3.utils.toWei('2000'), "wrong total supply")
        assert.equal(await rule.balanceOf(recipient),web3.utils.toWei('19000'), "wrong rule balance")
    });


    it("should set quotes back to initial values auction", async () => {
        await oracle.updateSinglePrice(0, 3100000000, {from: author});
    });

});