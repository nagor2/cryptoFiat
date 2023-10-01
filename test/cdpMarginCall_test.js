const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');
const { expectEvent } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address');

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
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        weth = await Weth.deployed();

        rule = await Rule.deployed(futureDaoAddress);
        oracle = await Oracle.deployed(futureDaoAddress);
        stableCoin = await StableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        auction = await Auction.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([weth.address, cdp.address, auction.address, 0x0, oracle.address, 0x0, rule.address, stableCoin.address, 0x0]);

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
        await oracle.updateSinglePrice(1, 3000000000, {from: author});
        await truffleAssert.fails(
            cdp.markToLiquidate(posId),
            truffleAssert.ErrorType.REVERT,
            "collateral is enough"
        );
        await oracle.updateSinglePrice(1, 1428000000, {from: author});
        let markTx = await cdp.markToLiquidate(posId);
        truffleAssert.eventEmitted(markTx, 'liquidationStatusChanged', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.liquidationStatus, 1, 'liquidationStatus is wrong');
            let position = await cdp.positions(posId);
            let block = await web3.eth.getBlock("latest");
            assert.equal(position.markedOnLiquidationTimestamp.toString(), block.timestamp, "time is wrong")
        });
    });

    it("should set position on liquidation and claim margin call", async () => {
        const positionBefore = await cdp.positions(posId);
        assert.equal(parseInt(positionBefore.liquidationStatus), 1, "position should not be no liquidation");
        assert.equal (positionBefore.liquidationAuctionID, 0, "there should be no liquidationAuctionID before");

        await truffleAssert.fails(
            cdp.claimMarginCall(posId),
            truffleAssert.ErrorType.REVERT,
            "Position is not marked on liquidation or owner still has time"
        );

        await time.increase(await dao.params("marginCallTimeLimit"));

        const auctionWethBalanceBefore = await weth.balanceOf(auction.address);
        assert.equal(auctionWethBalanceBefore, 0, "wrong balance auctionWethBalanceBefore");

        const cdpWethBalanceBefore = await weth.balanceOf(cdp.address);
        expect(cdpWethBalanceBefore).to.eql(positionBefore.wethAmountLocked, "wrong balance auctionWethBalanceAfter");


        let liquidationTx = await cdp.claimMarginCall(posId);

        truffleAssert.eventEmitted(liquidationTx, 'liquidationStatusChanged', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.liquidationStatus, 2, 'liquidationStatus is wrong');
        });

        truffleAssert.eventEmitted(liquidationTx, 'liquidateCollateral', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.auctionID, 1, 'auctionID is wrong');
            assert.equal(parseFloat(ev.collateral/10**18).toFixed(5), parseFloat(positionBefore.wethAmountLocked/10**18).toFixed(5), 'wethAmountLocked is wrong');
        });

        await expectEvent.inTransaction(liquidationTx.tx, auction, 'newAuction', { auctionID:web3.utils.toBN(1), lotAmount:positionBefore.wethAmountLocked, lotAddress:await dao.addresses('weth'), paymentAmount:web3.utils.toBN(0)});

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
            bidId = ev.bidID.toNumber();
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
            assert.equal (ev.bidID.toNumber(), bidId, "wrong bid id");
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

        assert.equal(parseInt(position.liquidationStatus), 2, "position should not be liquidated");

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
            bidId = ev.bidID.toNumber();
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
            assert.equal (bidId, ev.bidID.toNumber(), "wrong bid owner");
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

        assert.equal(parseInt(position.liquidationStatus), 3, "position should be liquidated");
        assert.equal(await stableCoin.totalSupply(),web3.utils.toWei('2000'), "wrong total supply")
        assert.equal(await rule.balanceOf(recipient),web3.utils.toWei('19000'), "wrong rule balance")
    });


    it("should set quotes back to initial values auction", async () => {
        await oracle.updateSinglePrice(1, 3100000000, {from: author});
    });

});