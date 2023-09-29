const truffleAssert = require('truffle-assertions');
const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var stableCoin = artifacts.require("./stableCoin.sol");

contract('stableCoin', (accounts) => {

    let dao;
    let coin;

    before(async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        coin = await stableCoin.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, coin.address, 0x0]);

    });

    it('deploys successfully', async () => {
        const address = await stableCoin.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
        assert.equal(await dao.addresses('stableCoin'),coin.address);
    });

    it('should mint only from CDP', async () => {
        const account = accounts[2];
        await truffleAssert.fails(
            coin.mint(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only collateral contract is authorized to mint"
        );
    });

    it('should burn only from CDP', async () => {
        const account = accounts[3];
        await truffleAssert.fails(
            coin.burn(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only collateral contract is authorized to burn"
        );
    });

    it('should set params name and symbol', async () => {
        assert.equal(await coin.symbol(), "TSC");
        assert.equal(await coin.name(), "True Stable Coin");
    });

});