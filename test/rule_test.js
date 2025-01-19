const truffleAssert = require('truffle-assertions');
const { getContractAddress } = require('@ethersproject/address')

var INTDAO = artifacts.require("./INTDAO.sol");
var Rule = artifacts.require("./Rule.sol");
var CDP = artifacts.require("./CDP.sol");

contract('Rule', (accounts) => {

    let dao;
    let rule;
    let cdp;

    before(async () => {
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})
        rule = await Rule.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        dao = await INTDAO.deployed([0x0, cdp.address, 0x0, 0x0, 0x0, rule.address, 0x0, 0x0]);
    });

    it('deploys successfully', async () => {
        const address = await rule.address;
        assert.notEqual(address, '');
        assert.notEqual(address, undefined);
        assert.notEqual(address, null);
        assert.notEqual(address, 0x0);
        assert.equal(await dao.addresses('rule'),rule.address);
    });

    it('should not mint from unauthorized address', async () => {
        const account = accounts[2];
        await truffleAssert.fails(
            rule.mint(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "authorized only"
        );
    });

    it('should not burn from unauthorized address', async () => {
        const account = accounts[3];
        await truffleAssert.fails(
            rule.burn(account, 1, {from: account}),
            truffleAssert.ErrorType.REVERT,
            "authorized only"
        );
    });

    it('should set params name and symbol', async () => {
        assert.equal(await rule.symbol(), "RLE");
        assert.equal(await rule.name(), "Rule token");
    });

    it('should mint initial supply for creator', async () => {
        let total_supply = await rule.totalSupply();
        assert.equal(web3.utils.toWei('1000000'), total_supply, "wrong total supply");
        let creator_balance = await rule.balanceOf(accounts[7]);
        assert.equal (web3.utils.fromWei(creator_balance), web3.utils.fromWei(total_supply), "wrong creator's balance");
    });
});