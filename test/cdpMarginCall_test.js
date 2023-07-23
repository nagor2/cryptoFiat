const truffleAssert = require("truffle-assertions");
const { time } = require('@openzeppelin/test-helpers');

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
            posId = ev.posId.toNumber();
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

        //truffleAssert.eventEmitted(liquidationTx, 'Transfer');
        /*
        truffleAssert.eventEmitted(liquidationTx, 'liquidateCollateral', async (ev) => {
            assert.equal(ev.auctionID, 1, 'auctionID is wrong');
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.collateral, positionBefore.wethAmountLocked, 'collateral amount is wrong');
        });
         */

        const auctionWethBalanceAfter = await weth.balanceOf(auction.address);

        expect(auctionWethBalanceAfter).to.eql(positionBefore.wethAmountLocked, "wrong balance auctionWethBalanceAfter");

        const cdpWethBalanceAfter = await weth.balanceOf(cdp.address);
        assert.equal(cdpWethBalanceAfter, 0, "wrong balance cdpWethBalanceAfter");


        const positionAfter = await cdp.positions(posId);
        assert.isTrue(positionAfter.liquidationAuctionID!=0, "there should be a liquidationAuctionID after");
    });

    it("should finishMarginCall and decrease coinsMinted and totalSupply", async () => {
        let position = await cdp.positions(posId);
        await time.increase(1);
        await stableCoin.approve(auction.address, web3.utils.toWei('1900'),{from:recipient})
        await auction.makeBid(position.liquidationAuctionID, web3.utils.toWei('1900'),{from:recipient});
        await time.increase(time.duration.minutes(15)+1);
        await cdp.finishMarginCall(posId);

        position = await cdp.positions(posId);
        assert.equal(await stableCoin.totalSupply(), web3.utils.toWei('100'), "wrong total supply");
        assert.equal(position.coinsMinted, web3.utils.toWei('100'), "wrong coins minted");
    });

    it("should recieve 10000 rules to recipient and decrease stubFund deficit", async () => {
        await cdp.openCDP(web3.utils.toWei('2000'), {from: accounts[4],value: web3.utils.toWei('1')});
        let position = await cdp.positions(posId);
        assert.isFalse(position.liquidated, "position should not be liquidated");

        await stableCoin.approve(auction.address, web3.utils.toWei('50'),{from:recipient})

        const auctionId = (parseInt(position.liquidationAuctionID)+1);

        await time.increase(1);

        await truffleAssert.fails(
            auction.makeBid(auctionId, web3.utils.toWei('10001'),{from:recipient}),
            truffleAssert.ErrorType.REVERT,
            "too many rules for one emission"
        );

        await auction.makeBid(auctionId, web3.utils.toWei('10000'),{from:recipient});

        await time.increase(time.duration.minutes(15)+1);

        await auction.claimToFinalizeAuction(auctionId);

        console.log((await stableCoin.totalSupply()).toString())
        assert.equal(await stableCoin.totalSupply(),web3.utils.toWei('2100'), "wrong total supply")
        assert.equal(position.coinsMinted,web3.utils.toWei('100'), "wrong coinsMinted")
        assert.equal(await rule.balanceOf(recipient),web3.utils.toWei('10000'),  "wrong rule balance")
        let cdpBalance = await stableCoin.balanceOf(cdp.address);
        console.log (parseFloat(cdpBalance/10**18));
        assert.equal(cdpBalance,web3.utils.toWei('50'), "wrong cdp balance")
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
        expect(await stableCoin.totalSupply()).to.eql(200, "wrong total supply");
        expect(await rule.balanceOf(recipient)).to.eql(web3.utils.toWei('20000'), "wrong rule balance");
    });


    it("should set quotes back to initial values auction", async () => {
        await oracle.updateSinglePrice(0, 3100000000, {from: author});
    });

});

//TODO: need to test full logic (finishMarginCall invoke several times!)