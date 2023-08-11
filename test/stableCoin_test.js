var INTDAO = artifacts.require("./INTDAO.sol");
var stableCoin = artifacts.require("./stableCoin.sol");
var Oracle = artifacts.require("./exchangeRateContract.sol");

const truffleAssert = require('truffle-assertions');

contract('stableCoin', (accounts) => {

    let dao;
    let oracle;
    let coin;


    before(async () => {
        dao = await INTDAO.deployed();
        oracle = await Oracle.deployed(dao.address);
        coin = await stableCoin.deployed();
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