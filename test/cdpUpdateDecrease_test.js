const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");
var StableCoin = artifacts.require("./stableCoin.sol");

const truffleAssert = require('truffle-assertions');

contract('CDP Update Decrease', (accounts) => {
    let dao;
    let cdp;
    let oracle;
    let stableCoin;
    let position;
    let positionTx;
    let positionUpdate;
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        positionTx = await cdp.openCDP(web3.utils.toWei('1000', 'ether'), {
            from: accounts[ownerId],
            value: web3.utils.toWei('1', 'ether')
        });

        await truffleAssert.eventEmitted(positionTx, 'PositionOpened', async (ev) => {
            posId = ev.posID.toNumber();
        });


        expectedOwner = accounts[ownerId];

        await time.increase(time.duration.years(1));

        position = await cdp.positions(posId);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('100', 'ether'), {from: accounts[ownerId]});
    });

    it("should emit PositionUpdated", async () => {
        truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            assert.equal(ev.posID.toNumber(), posId, 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('100', 'ether'), 'amount is wrong');
        });
    });

    it("should not change ethAmount locked", async () => {
        position = await cdp.positions(posId);
        assert.equal(position.wethAmountLocked, web3.utils.toWei('1','ether'), "ethAmountLocked should be 1 ether");
    });

    it("should decrease owner's balance", async () => {
        const balance = await stableCoin.balanceOf(position.owner);
        assert.equal(balance, web3.utils.toWei('100', 'ether'), "owner's balance should be 100 stableCoin");
    });

    it("should decrease coinsMinted", async () => {
        assert.equal(position.coinsMinted, web3.utils.toWei('100', 'ether'), "coinsMinted should be 100 stableCoin");
    });
});
