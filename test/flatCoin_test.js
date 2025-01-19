const truffleAssert = require('truffle-assertions');
const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var flatCoin = artifacts.require("./flatCoin.sol");

contract('flatCoin', (accounts) => {

    let dao;
    let coin;

    before(async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        coin = await flatCoin.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, cdp.address, 0x0, 0x0, 0x0, 0x0, coin.address, 0x0]);
    });

    it('deploys successfully', async () => {
        const address = await flatCoin.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
        assert.equal(await dao.addresses('flatCoin'),coin.address);
    });

    it('should not mint from unauthorized address', async () => {
        const account = accounts[2];
        await truffleAssert.fails(
            coin.mint(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "authorized only"
        );
    });

    it('should not burn from unauthorized address', async () => {
        const account = accounts[3];
        await truffleAssert.fails(
            coin.burn(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "authorized only"
        );
    });

    it('should set params name and symbol', async () => {
        assert.equal(await coin.symbol(), "DFC");
        assert.equal(await coin.name(), "dotFlat");
    });

});