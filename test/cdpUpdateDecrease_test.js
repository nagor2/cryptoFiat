const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var Oracle = artifacts.require("./Oracle.sol");
var StableCoin = artifacts.require("./stableCoin.sol");

const truffleAssert = require('truffle-assertions');

contract('CDP Update Decrease', (accounts) => {
    let dao;
    let cdp;
    let oracle;
    let stableCoin;
    let position;
    let positionID;
    let positionUpdate;
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed();
        oracle = await Oracle.deployed(dao.address);
        stableCoin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);

        positionID = await cdp.openCDP(web3.utils.toWei('2000', 'ether'), {
            from: accounts[ownerId],
            value: web3.utils.toWei('1', 'ether')
        });

        posId = 0;

        expectedOwner = accounts[ownerId];

        await time.increase(31536000);//1 year in seconds. It may sometimes fail

        position = await cdp.positions(posId);

        positionUpdate = await cdp.updateCDP(posId, web3.utils.toWei('100', 'ether'), {from: accounts[ownerId]});
    });

    it("should emit PositionUpdated", async () => {
        truffleAssert.eventEmitted(positionUpdate, 'PositionUpdated', async (ev) => {
            assert.equal(ev.posID, posId, 'positionID is wrong');
            assert.equal(ev.newStableCoinsAmount, web3.utils.toWei('100', 'ether'), 'amount is wrong');
        });
    });

    it("should not change ethAmount locked", async () => {
        position = await cdp.positions(posId);
        assert.equal(position.ethAmountLocked, web3.utils.toWei('1','ether'), "ethAmountLocked should be 1 ether");
    });

    it("should decrease owner's balance", async () => {
        const balance = await stableCoin.balanceOf(position.owner);
        assert.equal(balance, web3.utils.toWei('100', 'ether'), "owner's balance should be 100 stableCoin");
    });
});