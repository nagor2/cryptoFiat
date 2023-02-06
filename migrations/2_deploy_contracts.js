var Rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");
var weth = artifacts.require("WETH9");
var deposit = artifacts.require("DepositContract");
var InflationFund = artifacts.require("inflationFund.sol");

module.exports = async function(deployer) {
    let accounts = await web3.eth.getAccounts();
    const exRAuthour = accounts[5];
    await deployer.deploy(weth);
    await deployer.deploy(INTDAO, weth.address);
    await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:"1000000000000000000"});
    const eRC = await exchangeRateContract.deployed();
    await eRC.addInstrument("eth", "Ethereum", 2, {from: exRAuthour});
    await eRC.updateSinglePrice(exRAuthour, "eth", 0, 310000, {from: exRAuthour});
    await deployer.deploy(stableCoin, INTDAO.address);
    await deployer.deploy(Rule, INTDAO.address, {from: accounts[7]});
    await deployer.deploy(auction, INTDAO.address);
    await deployer.deploy(cdp, INTDAO.address);
    await deployer.deploy(deposit, INTDAO.address);
    await deployer.deploy(InflationFund, INTDAO.address);
};
