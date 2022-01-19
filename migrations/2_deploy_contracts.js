var Rule = artifacts.require("Rule");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");

module.exports = function(deployer) {

    deployer.deploy(Rule).then(function() {
        return deployer.deploy(INTDAO, Rule.address).then(function() {
            return deployer.deploy(cdp, INTDAO.address);
        });
    });

};
