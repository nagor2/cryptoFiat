const { time } = require('@openzeppelin/test-helpers');


var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var FlatCoin = artifacts.require("./flatCoin.sol");
const { getContractAddress } = require('@ethersproject/address');


const truffleAssert = require('truffle-assertions');

contract('CDP Update Decrease', (accounts) => {
    let dao;
    let cdp;
    let flatCoin;
    let position;
    let positionTx;
    let positionUpdate;
    const ownerId = 2;

    before('should setup the contracts instance', async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-5)})

        flatCoin = await FlatCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([cdp.address, 0x0, 0x0, 0x0, 0x0, flatCoin.address, 0x0]);

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
            assert.equal(ev.newFlatCoinsAmount, web3.utils.toWei('100', 'ether'), 'amount is wrong');
        });
    });

    it("should not change ethAmount locked", async () => {
        position = await cdp.positions(posId);
        assert.equal(position.ethAmountLocked, web3.utils.toWei('1','ether'), "ethAmountLocked should be 1 ether");
    });

    it("should decrease owner's balance", async () => {
        const balance = await flatCoin.balanceOf(position.owner);
        assert.equal(balance, web3.utils.toWei('100', 'ether'), "owner's balance should be 100 flatCoin");
    });

    it("should decrease coinsMinted", async () => {
        assert.equal(position.coinsMinted, web3.utils.toWei('100', 'ether'), "coinsMinted should be 100 flat" +
            "Coin");
    });
});
