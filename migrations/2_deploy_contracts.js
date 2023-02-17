var Rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");
var weth = artifacts.require("WETH9");
var deposit = artifacts.require("DepositContract");
var InflationFund = artifacts.require("inflationFund.sol");
var cartContract = artifacts.require("cartContract");

module.exports = async function(deployer, network) {
    if (network == "dashboard") {
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address);
        await deployer.deploy(exchangeRateContract, INTDAO.address, {value:"100000000000000"});
        await deployer.deploy(cartContract, INTDAO.address);
        const cart = await cartContract.deployed();
        await cart.addItem("Gold", 10, 1867650000);
        await cart.addItem("Lumber", 5, 414100000);
        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address);
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);
    }
    else{
        let accounts = await web3.eth.getAccounts();
        const exRAuthour = accounts[5];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: accounts[1]});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:"1000000000000000000"});
        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("eth", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "eth", 0, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "Gold", 0, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(exRAuthour, "Lumber", 0, 414100000, {from: exRAuthour});



        await deployer.deploy(cartContract, INTDAO.address);

        const cart = await cartContract.deployed();

        await cart.addItem("Gold", 10, 1867650000, {from: accounts[1]});
        await cart.addItem("Lumber", 5, 414100000, {from: accounts[1]});

        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address, {from: accounts[7]});
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);
    }
};
