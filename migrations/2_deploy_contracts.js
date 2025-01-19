var rule = artifacts.require("Rule");
var flatCoin = artifacts.require ("flatCoin");
var exchangeRateContract = artifacts.require("exchangeRateContract");
var INTDAO = artifacts.require("INTDAO");
var cdp = artifacts.require("CDP");
var auction = artifacts.require("Auction");
var deposit = artifacts.require("DepositContract");
//var InflationFund = artifacts.require("inflationFund.sol");
var basketContract = artifacts.require("basketContract");
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
        //await deployer.deploy(basketContract, daoAddress);
        //await deployer.deploy(flatCoin, daoAddress);
        //await deployer.deploy(Rule, daoAddress);
        //await deployer.deploy(auction, daoAddress);
        //await deployer.deploy(cdp, daoAddress);
        //await deployer.deploy(deposit, daoAddress);
                                                            //await deployer.deploy(InflationFund, daoAddress);
        //await deployer.deploy(Platform, daoAddress);

        const daofutureAddress = getContractAddress({
            from: accounts[0],
            nonce: transactionCount0 + 7
        })
        console.log("futureAddress INTDAO: "+daofutureAddress);
        //await deployer.deploy(weth);
        await deployer.deploy(flatCoin, daofutureAddress);
        await deployer.deploy(basketContract, daofutureAddress);
        const auctionContract = await deployer.deploy(auction, daofutureAddress);
        const cdpContract = await deployer.deploy(cdp, daofutureAddress);
        const depositContract = await deployer.deploy(deposit, daofutureAddress);
        await deployer.deploy(exchangeRateContract, daofutureAddress);
        await deployer.deploy(rule, daofutureAddress);
        const basket = await basketContract.deployed();

        await deployer.deploy(INTDAO, [cdp.address, auction.address, deposit.address, exchangeRateContract.address, rule.address, flatCoin.address, basket.address],{from: accounts[0]});
        await basket.renewContracts();
        await auctionContract.renewContracts();
        await cdpContract.renewContracts();
        await depositContract.renewContracts();

    }
    else if (network == "development"){

        const daofutureAddress = getContractAddress({
            from: accounts[0],
            nonce: transactionCount0 + 4
        })

        const exRAuthour = accounts[5];
        await deployer.deploy(flatCoin, daofutureAddress,{from: accounts[0]});
        await deployer.deploy(basketContract, daofutureAddress,{from: exRAuthour});
        const auctionContract = await deployer.deploy(auction, daofutureAddress,{from: accounts[0]});
        const cdpContract = await deployer.deploy(cdp, daofutureAddress,{from: accounts[0]});
        const depositContract = await deployer.deploy(deposit, daofutureAddress,{from: accounts[0]});
        await deployer.deploy(exchangeRateContract, daofutureAddress, {from: exRAuthour, value:web3.utils.toWei('0.1')});
        await deployer.deploy(rule, daofutureAddress, {from: accounts[7]});



        await deployer.deploy(INTDAO, [cdp.address, auction.address, deposit.address, exchangeRateContract.address, rule.address, flatCoin.address, basketContract.address],{from: accounts[0]});

        //console.log (INTDAO.address + " " + daofutureAddress);

        const eRC = await exchangeRateContract.deployed();

        const basket = await basketContract.deployed();

        await eRC.addInstrument("eth", "Ethereum", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(1, 3100000000, {from: exRAuthour});

        await eRC.addInstrument("Gold", "Gold", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(2, 1867650000, {from: exRAuthour});

        await eRC.addInstrument("Lumber", "Lumber", 6, {from: exRAuthour});
        await eRC.updateSinglePrice(3, 414100000, {from: exRAuthour});

        await basket.renewContracts();

        await basket.addItem("Gold", 10, 1867650000, {from: exRAuthour});
        await basket.addItem("Lumber", 5, 414100000, {from: exRAuthour});

        await auctionContract.renewContracts();
        await cdpContract.renewContracts();
        await depositContract.renewContracts();

    }
};
