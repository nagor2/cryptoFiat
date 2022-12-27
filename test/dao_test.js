var INTDAO = artifacts.require("./INTDAO.sol");
const truffleAssert = require('truffle-assertions');

contract('DAO', (accounts) => {

    let dao;

    before(async () => {
        dao = await INTDAO.deployed();
    });

    it('deploys successfully', async () => {
        const address = await dao.address;
        //console.log (address);
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
    });

    it('addresses filled successfully', async () => {
        const address = await dao.address;
        assert.equal(await dao.addresses('dao'),address);
    });

    it('should set address only once', async () => {
        await truffleAssert.fails(
            dao.setAddressOnce('dao', accounts[2]),
            truffleAssert.ErrorType.REVERT,
            "address can be set only once");
    });

});
