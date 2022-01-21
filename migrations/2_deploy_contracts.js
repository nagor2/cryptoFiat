var Rule = artifacts.require("Rule");
var oracle = artifacts.require("Oracle");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");

module.exports = function(deployer) {

    deployer.deploy(Rule).then(function() {
        return deployer.deploy(oracle).then(function () {
        return deployer.deploy(INTDAO, Rule.address, oracle.address).then(function() {
            return deployer.deploy(cdp, INTDAO.address);
        });
    });
    });
};
