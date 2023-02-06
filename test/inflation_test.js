const { time } = require('@openzeppelin/test-helpers');

var CDP = artifacts.require("./CDP.sol");
var INTDAO = artifacts.require("./INTDAO.sol");
var StableCoin = artifacts.require("./stableCoin.sol");
var InflationFund = artifacts.require("./inflationFund.sol");
const truffleAssert = require('truffle-assertions');

contract('Inflation', (accounts) => {
    let dao;
    let cdp;
    let coin;
    let inflationFund;

    before('should setup the contracts instance', async () => {
        dao = await INTDAO.deployed(0x0);
        coin = await StableCoin.deployed(dao.address);
        cdp = await CDP.deployed(dao.address);
        inflationFund = await InflationFund.deployed(dao.address);
    });

    it("should fail, because to early", async () => {
        await truffleAssert.fails(
            inflationFund.claimEmission(),
            truffleAssert.ErrorType.REVERT,
            "too early to claim");
    });

    it("should emit zero", async () => {
        await time.increase(time.duration.years(1));
        await truffleAssert.fails(
            inflationFund.claimEmission(),
            truffleAssert.ErrorType.REVERT,
            "nothing to emit");
    });

    it("should emit 2", async () => {
        await cdp.openCDP(web3.utils.toWei('200', 'ether'), {
            from: accounts[3],
            value: web3.utils.toWei('0.2', 'ether')
        });

        await inflationFund.claimEmission();
        let balanceB = await coin.balanceOf(cdp.address);
        assert.equal(parseFloat(balanceB/10**18).toFixed(5), parseFloat("0").toFixed(5), "should be 0");
        await inflationFund.claimTransfer();
        let balanceA = await coin.balanceOf(cdp.address);
        assert.equal(parseFloat(balanceA/10**18).toFixed(5), parseFloat("2").toFixed(5), "should increase");
    });

    it("should fail, because to early", async () => {
        await time.increase(time.duration.days(360));
        await truffleAssert.fails(
            inflationFund.claimEmission(),
            truffleAssert.ErrorType.REVERT,
            "too early to claim");
    });
});
