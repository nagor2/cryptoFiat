const truffleAssert = require('truffle-assertions');
const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var stableCoin = artifacts.require("./stableCoin.sol");
var CDP = artifacts.require("./CDP.sol");

contract('stableCoin', (accounts) => {

    let dao;
    let coin;
    let cpd;

    before(async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        coin = await stableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, cdp.address, 0x0, 0x0, 0x0, 0x0, coin.address, 0x0]);

    });

    it('deploys successfully', async () => {
        const address = await stableCoin.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
        assert.equal(await dao.addresses('stableCoin'),coin.address);
    });

    it('should not mint from unauthorized address', async () => {
        const account = accounts[2];
        await truffleAssert.fails(
            coin.mint(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only authorized address may do this"
        );
    });

    it('should not burn from unauthorized address', async () => {
        const account = accounts[3];
        await truffleAssert.fails(
            coin.burn(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only authorized address may do this"
        );
    });

    it('should set params name and symbol', async () => {
        assert.equal(await coin.symbol(), "DFC");
        assert.equal(await coin.name(), "dot Flat coin");
    });

});