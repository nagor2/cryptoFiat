const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var Weth = artifacts.require("./WETH9.sol");
const truffleAssert = require('truffle-assertions');

contract('CDP', (accounts) => {

    let dao;
    let cdp;
    let rule;
    let weth;
    let oracle;
    let expectedOwner;
    let stableCoin;
    let posNumber;
    let positionIDtx;
    let positionID;

    before('should setup the contracts instance', async () => {
        weth = await Weth.deployed();
        dao = await INTDAO.deployed(weth.address);
        rule = await Rule.deployed(dao.address);
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        posNumber = await cdp.numPositions();

        positionIDtx = await cdp.openCDP(web3.utils.toWei('8000', 'ether'), {
            from: accounts[1],
            value: web3.utils.toWei('1', 'ether')
        });

        //console.log (positionID + " - positionID"); //posID vs posNumber! posID - tx. Should make a tricky convert to int

        expectedOwner = accounts[1];
    });

    it("should create a valid Position", async () => {
        truffleAssert.eventEmitted(positionIDtx, 'PositionOpened', async (ev) => {
            positionID = ev.posId.toNumber();
            const position = await cdp.positions(positionID);
            assert.equal(position.owner, expectedOwner, "position.owner should be " + expectedOwner);
            assert.equal(position.wethAmountLocked, web3.utils.toWei('1', 'ether'), "ethAmountLocked should be 1 ether");
            const block = await web3.eth.getBlock("latest");
            assert.equal(position.timeOpened, block.timestamp, "time of the position should be set to now");
            assert.equal(position.feeGeneratedRecorded, 0, "fee generated should be set to 0");

            const rate = await dao.params('interestRate');

            expect(rate).to.eql(position.feeRate, "fee rate should be set to dao.params value"); //compare 2 BN
            assert.equal(position.coinsMinted, 2170 * (10 ** 18), "should mint 2170*10^18 stableCoins");
        });

    });

    it("should mint max 2170 coins per 1 ether", async () => {
        const coins = await cdp.getMaxStableCoinsToMint(web3.utils.toWei('1', 'ether'));
        assert.equal(coins, 2170 * (10 ** 18), "should mint max 2170 coins per 1 ether");
    });

    it("should put 1 ether on contract's balance", async () => {
        const contractBalance = await weth.balanceOf(cdp.address);
        assert.equal(contractBalance, web3.utils.toWei('1', 'ether'), "contract's balance should be 1 ether");
    });


    it("should mint coins", async () => {
        const position = await cdp.positions(posNumber);
        const owner = await position.owner;
        const coinsMinted = await position.coinsMinted;
        const ballance = await stableCoin.balanceOf(owner);
        assert.equal(coinsMinted.toString(), ballance.toString(), "notEqual mint coins");
    });

    it("time rewind", async () => {
        await time.increase(time.duration.years(1));
        const fee = await cdp.generatedFeeUnrecorded(0);
        assert.equal(parseFloat(fee/10**18).toFixed(4), parseFloat(195.3).toFixed(4), "should increase generated fee. It may sometimes fail due to time rewind (not precise)");
    });

    it("should return valid position ID", async () => {
        const numPos = await cdp.numPositions.call();
        truffleAssert.eventEmitted(positionIDtx, 'PositionOpened', (ev) => {
            return ev.owner === accounts[1] && ev.posId.toNumber() === numPos - 1;
        });
    });

    it("should increase numPositions", async () => {
        const numPos = await cdp.numPositions();
        assert.equal(numPos, parseInt(posNumber) + 1, "number of positions should increase while opening");
    });

    it("should throw if update from another account", async () => {
        const wrongAccount = accounts[9];
        await truffleAssert.fails(
            cdp.updateCDP(positionID, web3.utils.toWei('100', 'ether'), {from: wrongAccount}),
            truffleAssert.ErrorType.REVERT,
            "Only owner may update the position"
        );
    });
});