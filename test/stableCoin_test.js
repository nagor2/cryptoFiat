var INTDAO = artifacts.require("./INTDAO.sol");
var stableCoin = artifacts.require("./stableCoin.sol");
const truffleAssert = require('truffle-assertions');

contract('stableCoin', (accounts) => {

    let dao;


    before(async () => {
        dao = await INTDAO.deployed();
        stableCoin = await stableCoin.deployed();
    });

    it('deploys successfully', async () => {
        const address = await stableCoin.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
        assert.equal(await dao.addresses('stableCoin'),stableCoin.address);
    });

    it('should mint only from CDP', async () => {
        const account = accounts[2];
        await truffleAssert.fails(
            stableCoin.mint(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only collateral contract is authorized to mint"
        );
    });

    it('should burn only from CDP', async () => {
        const account = accounts[3];
        await truffleAssert.fails(
            stableCoin.burn(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "only collateral contract is authorized to burn"
        );
    });
});