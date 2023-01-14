var Rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");

module.exports = function(deployer) {
    deployer.deploy(INTDAO, '0xE13cbE98FD0f617336690E4e20b6985bE418D523').then(function() {
        return deployer.deploy(exchangeRateContract, INTDAO.address).then(async function () {
            await exchangeRateContract.addInstrument("eth", "Ethereum", 2);
            await exchangeRateContract.updateSinglePrice(0x0, "eth", 0, 310000);
            return deployer.deploy(stableCoin, INTDAO.address).then(function () {
                return deployer.deploy(Rule, INTDAO.address).then(function () {
                    deployer.deploy(auction, INTDAO.address);
                    return deployer.deploy(cdp, INTDAO.address);
                });
            });
        });
    });
};
