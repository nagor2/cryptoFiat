const { time } = require('@openzeppelin/test-helpers');
const { getContractAddress } = require('@ethersproject/address');

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
        const futureDaoAddress = await getContractAddress({from: accounts[0],nonce: ((await web3.eth.getTransactionCount(accounts[0]))-2)})

        coin = await StableCoin.deployed(futureDaoAddress);
        cdp = await CDP.deployed(futureDaoAddress);
        inflationFund = await InflationFund.deployed(futureDaoAddress);

        dao = await INTDAO.deployed([0x0, cdp.address, 0x0, 0x0, 0x0, inflationFund.address, 0x0, coin.address, 0x0]);

        await cdp.renewContracts();
        await inflationFund.renewContracts();
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

        let balanceB = await coin.balanceOf(cdp.address);
        assert.equal(parseFloat(balanceB/10**18).toFixed(5), parseFloat("0").toFixed(5), "should be 0");
        await inflationFund.claimEmission();
        let balanceA = await coin.balanceOf(cdp.address);
        assert.equal(parseFloat(balanceA/10**18).toFixed(5), parseFloat("2").toFixed(5), "should increase");
        //TODO: check event
    });

    it("should fail, because to early", async () => {
        await time.increase(time.duration.days(360));
        await truffleAssert.fails(
            inflationFund.claimEmission(),
            truffleAssert.ErrorType.REVERT,
            "too early to claim");
    });
});
