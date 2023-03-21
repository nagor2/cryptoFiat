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
var Platform = artifacts.require("Platform");
var tokenTemplate = artifacts.require("tokenTemplate");

module.exports = async function(deployer, network, accounts) {
    if (network == "dashboard") {
        //await deployer.deploy(weth);
        //await deployer.deploy(INTDAO, '0x82A618305706B14e7bcf2592D4B9324A366b6dAd'); //weth.address
        let daoAddress = '0xd1c5A469191E45a4D06D725681F2B73a402737b4';
        //await deployer.deploy(exchangeRateContract, daoAddress);
        await deployer.deploy(cartContract, daoAddress);
        await deployer.deploy(stableCoin, daoAddress);
        await deployer.deploy(Rule, daoAddress);
        await deployer.deploy(auction, daoAddress);
        await deployer.deploy(cdp, daoAddress);
        await deployer.deploy(deposit, daoAddress);
        await deployer.deploy(InflationFund, daoAddress);
        await deployer.deploy(Platform, daoAddress);
    }
    else if (network == "development"){
        const author = accounts[1];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: author});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: author, value:web3.utils.toWei('0.1')});
        await deployer.deploy(cartContract, INTDAO.address);
        await deployer.deploy(stableCoin, INTDAO.address);
        await deployer.deploy(Rule, INTDAO.address, {from: author});
        await deployer.deploy(auction, INTDAO.address);
        await deployer.deploy(cdp, INTDAO.address);
        await deployer.deploy(deposit, INTDAO.address);
        await deployer.deploy(InflationFund, INTDAO.address);

        await deployer.deploy(Platform, INTDAO.address, {from: author});

        let addresses = [accounts[7], stableCoin.address, Platform.address]; //teamAddress, coin, platform
        let params = [10, 1000, 5, 6, 70, 5184000, 604800, 600]; /*initialPrice, initialSupply, platformFeePercent,
                                             number of stages, percentOfTokensToTeam,
                                             crowdsaleDuration in seconds (30 days)
                                             holdDuration (7 days), softCap*/
        let budgetPercent = [5, 10, 10, 10, 15, 20, 30];
        let extraChargePercent = [10, 20, 30, 40, 50, 100];
        let stagesDuration = [2592000,2592000,2592000,2592000,2592000,2592000];
        let stagesShortDescription = ["first stage bla-bla-bla", "second stage bla-bla-bla",
            "third stage bla-bla-bla", "fourth stage bla-bla-bla", "fifth stage bla-bla-bla",
            "sixth stage bla-bla-bla"];

        await deployer.deploy(tokenTemplate, addresses, params, "start", "Startup token",
            budgetPercent, extraChargePercent, stagesDuration, stagesShortDescription, {from: author});


        let token = await tokenTemplate.deployed();
        let platform = await Platform.deployed();

        await platform.addMintedToken(token.address, {from: author});

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
        await deployer.deploy(Platform, INTDAO.address, {from: accounts[2]});

        let addresses = [accounts[7], stableCoin.address, Platform.address]; //teamAddress, coin, platform
        let params = [10, 1000, 5, 6, 70, 5184000, 604800, 600]; /*initialPrice, initialSupply, platformFeePercent,
                                             number of stages, percentOfTokensToTeam,
                                             crowdsaleDuration in seconds (30 days)
                                             holdDuration (7 days), softCap*/
        let budgetPercent = [5, 10, 10, 10, 15, 20, 30];
        let extraChargePercent = [10, 20, 30, 40, 50, 100];
        let stagesDuration = [2592000,2592000,2592000,2592000,2592000,2592000];
        let stagesShortDescription = ["first stage bla-bla-bla", "second stage bla-bla-bla",
            "third stage bla-bla-bla", "fourth stage bla-bla-bla", "fifth stage bla-bla-bla",
            "sixth stage bla-bla-bla"];

        await deployer.deploy(tokenTemplate, addresses, params, "start", "Startup token",
            budgetPercent, extraChargePercent, stagesDuration, stagesShortDescription, {from: accounts[2]});
    }
};
