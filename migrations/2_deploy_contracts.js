var rule = artifacts.require("Rule");
var stableCoin = artifacts.require ("stableCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");
var weth = artifacts.require("WETH9");
var deposit = artifacts.require("DepositContract");
var InflationFund = artifacts.require("inflationFund.sol");
var cartContract = artifacts.require("cartContract");
const { getContractAddress } = require('@ethersproject/address')
const Migrations = artifacts.require("Migrations");

module.exports = async function(deployer, network, accounts) {

    var adapter = Migrations.interfaceAdapter;
    const web3 = adapter.web3;
    const transactionCount0 = await web3.eth.getTransactionCount(accounts[0]);

    if (network == "dashboard") {
        //await deployer.deploy(weth);
        //await deployer.deploy(INTDAO, '0x82A618305706B14e7bcf2592D4B9324A366b6dAd'); //weth.address
        //let daoAddress = '0xd1c5A469191E45a4D06D725681F2B73a402737b4';
        //await deployer.deploy(exchangeRateContract, daoAddress);
        //await deployer.deploy(cartContract, daoAddress);
        //await deployer.deploy(stableCoin, daoAddress);
        //await deployer.deploy(Rule, daoAddress);
        //await deployer.deploy(auction, daoAddress);
        //await deployer.deploy(cdp, daoAddress);
        //await deployer.deploy(deposit, daoAddress);
        //await deployer.deploy(InflationFund, daoAddress);
        //await deployer.deploy(Platform, daoAddress);

        const daofutureAddress = getContractAddress({
            from: accounts[0],
            nonce: transactionCount0 + 8
        })
        console.log("futureAddress INTDAO: "+daofutureAddress);
        //await deployer.deploy(weth);
        await deployer.deploy(stableCoin, daofutureAddress);
        await deployer.deploy(cartContract, daofutureAddress);
        const auctionContract = await deployer.deploy(auction, daofutureAddress);
        const cdpContract = await deployer.deploy(cdp, daofutureAddress);
        const depositContract = await deployer.deploy(deposit, daofutureAddress);
        const inflationContract = await deployer.deploy(InflationFund, daofutureAddress);
        await deployer.deploy(exchangeRateContract, daofutureAddress);
        await deployer.deploy(rule, daofutureAddress);
        const cart = await cartContract.deployed();

        await deployer.deploy(INTDAO, ['0x82A618305706B14e7bcf2592D4B9324A366b6dAd', cdp.address, auction.address, deposit.address, exchangeRateContract.address, InflationFund.address, rule.address, stableCoin.address, cart.address],{from: accounts[0]});
        await cart.renewContracts();
        await auctionContract.renewContracts();
        await cdpContract.renewContracts();
        await depositContract.renewContracts();
        await inflationContract.renewContracts();
    }
    else if (network == "development"){

        const daofutureAddress = getContractAddress({
            from: accounts[0],
            nonce: transactionCount0 + 7
        })

        const exRAuthour = accounts[5];
        await deployer.deploy(weth,{from: accounts[0]});
        await deployer.deploy(stableCoin, daofutureAddress,{from: accounts[0]});
        await deployer.deploy(cartContract, daofutureAddress,{from: accounts[0]});
        const auctionContract = await deployer.deploy(auction, daofutureAddress,{from: accounts[0]});
        const cdpContract = await deployer.deploy(cdp, daofutureAddress,{from: accounts[0]});
        const depositContract = await deployer.deploy(deposit, daofutureAddress,{from: accounts[0]});
        const inflationContract = await deployer.deploy(InflationFund, daofutureAddress,{from: accounts[0]});
        await deployer.deploy(exchangeRateContract, daofutureAddress, {from: exRAuthour, value:web3.utils.toWei('0.1')});
        await deployer.deploy(rule, daofutureAddress, {from: accounts[7]});

        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(1, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(2, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(3, 414100000, {from: exRAuthour});



        const cart = await cartContract.deployed();

        await deployer.deploy(INTDAO, [weth.address, cdp.address, auction.address, deposit.address, exchangeRateContract.address, InflationFund.address, rule.address, stableCoin.address, cart.address],{from: accounts[0]});

        //console.log (INTDAO.address + " " + daofutureAddress);

        await cart.renewContracts();

        await cart.addItem("Gold", 10, 1867650000, {from: exRAuthour});
        await cart.addItem("Lumber", 5, 414100000, {from: exRAuthour});

        await auctionContract.renewContracts();
        await cdpContract.renewContracts();
        await depositContract.renewContracts();
        await inflationContract.renewContracts();



        /*
    weth.address, cdp.address, auction.address, deposit.address, exchangeRateContract.address, InflationFund.address, Rule.address, stableCoin.address, cart.address
    * */


    }
    else{
        const exRAuthour = accounts[5];
        await deployer.deploy(weth);
        await deployer.deploy(INTDAO, weth.address, {from: accounts[1]});
        await deployer.deploy(exchangeRateContract, INTDAO.address, {from: exRAuthour, value:web3.utils.toWei('0.1')});
        const eRC = await exchangeRateContract.deployed();

        await eRC.addInstrument("etc", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(1, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(2, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(3, 414100000, {from: exRAuthour});

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
