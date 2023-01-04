var Rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var oracle = artifacts.require("Oracle");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");

module.exports = function(deployer) {

    deployer.deploy(INTDAO).then(function() {
        return deployer.deploy(oracle, INTDAO.address).then(function () {
            return deployer.deploy(stableCoin, INTDAO.address).then(function () {
                return deployer.deploy(Rule, INTDAO.address).then(function () {
                    deployer.deploy(auction, INTDAO.address);
                    return deployer.deploy(cdp, INTDAO.address);
                });
            });
        });
    });
};
