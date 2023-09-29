const { time } = require('@openzeppelin/test-helpers');


var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
const { getContractAddress } = require('@ethersproject/address');


const truffleAssert = require('truffle-assertions');

contract('CDP Update Decrease', (accounts) => {
    let dao;
    let cdp;
    let stableCoin;
    let position;
    let positionTx;
    let positionUpdate;
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

        stableCoin = await StableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([0x0, cdp.address, 0x0, 0x0, 0x0, 0x0, 0x0, stableCoin.address, 0x0]);

        await cdp.renewContracts();

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
