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

module.exports = async function(deployer, network, accounts) {

    if (network == "dashboard") {
        //await deployer.deploy(weth);
        //await deployer.deploy(INTDAO, '0x82A618305706B14e7bcf2592D4B9324A366b6dAd'); //weth.address
        let daoAddress = '0xd1c5A469191E45a4D06D725681F2B73a402737b4';
        //await deployer.deploy(exchangeRateContract, daoAddress);
        //await deployer.deploy(cartContract, daoAddress);
        //await deployer.deploy(stableCoin, daoAddress);
        //await deployer.deploy(Rule, daoAddress);
        //await deployer.deploy(auction, daoAddress);
        await deployer.deploy(cdp, daoAddress);
        //await deployer.deploy(deposit, daoAddress);
        //await deployer.deploy(InflationFund, daoAddress);
        //await deployer.deploy(Platform, daoAddress);
    }
    else if (network == "development"){
        const author = accounts[1];
        const exRAuthour = accounts[5];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: author});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:web3.utils.toWei('0.1')});

        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(0, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(1, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(2, 414100000, {from: exRAuthour});

        await deployer.deploy(cartContract, INTDAO.address);

        const cart = await cartContract.deployed();

        await cart.addItem("Gold", 10, 1867650000, {from: exRAuthour});
        await cart.addItem("Lumber", 5, 414100000, {from: exRAuthour});

        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address, {from: accounts[7]});
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);

        console.log (INTDAO.address);
    }
    else{
        const exRAuthour = accounts[5];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: accounts[1]});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:web3.utils.toWei('0.1')});
        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(0, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(1, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(2, 414100000, {from: exRAuthour});

        await deployer.deploy(cartContract, INTDAO.address);

        const cart = await cartContract.deployed();

        await cart.addItem("Gold", 10, 1867650000, {from: exRAuthour});
        await cart.addItem("Lumber", 5, 414100000, {from: exRAuthour});

        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address, {from: accounts[7]});
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);
    }
};
