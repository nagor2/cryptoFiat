var userAddress;

var misoAddress;
var misoABI;
var miso;

var masterChefAddress;
var masterChefABI;
var masterChef;

var lpAddress;
var lpABI;
var lp;

const decimals = 18;
var lpDecimals;


var userAddress;

var ethereum;




async function unlock(){
    if (typeof web3 !== 'undefined') {
        // Use the browser's ethereum provider
        window.web3 = new Web3(web3.currentProvider);
        ethereum = window.ethereum;

        if (ethereum !== 'undefined' && ethereum.isConnected()) {
            try {
                await ethereum.enable();
                console.log ('Connected ' + ethereum.selectedAddress)

                userAddress = ethereum.selectedAddress;
                initGlobals();
                misoBalance(userAddress);
                misoTotalSupply();
                pendingMiso(userAddress);
            }
            catch(error){
                console.log ('Message: ' + error.message);
                if (error.code==4001)
                    alert('You have to connect')
            }
        }

        else
        {
            document.getElementById('getMetaMask').style.visibility = 'visible';
            console.log('No web3? You should consider trying MetaMask!')
        }
    }

}

function initGlobals() {
    hashAddress = '0x8338b13F0bd40bcD452bD34ffD2f729a04aeD035';

    var hashABI = [{"inputs":[],"stateMutability":"payable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"ChangedPriceFeed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"DividendsTransfered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Minted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"SetBonus","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"remaining","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"success","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"bonus","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"buyTokens","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"changedPriceFeed","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"claimDividends","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"crowdSale","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"crowdSaleStart","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"currentDividendsRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"currentPrice","outputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"daysFromStart","outputs":[{"internalType":"uint256","name":"daysCount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_minutes","type":"uint256"}],"name":"depositLP","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"dividendsAccumulated","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"dividendsRounds","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"dividendsTimestamps","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"getCurrentDividends","outputs":[{"internalType":"uint256","name":"currentDividends","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"getLockedTokens","outputs":[{"internalType":"uint256","name":"pooled","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"getMergedDividends","outputs":[{"internalType":"uint256","name":"currentDividends","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"getPooledTokens","outputs":[{"internalType":"uint256","name":"pooled","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getWholeBalance","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"initialUsdPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"lastClaimedRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"lastMergedRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestUSDPrice","outputs":[{"internalType":"uint256","name":"currentETHprice","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"lockedBalances","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"mergeDividends","outputs":[{"internalType":"uint256","name":"_dividendsAccumulated","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"poolAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"priceFeedAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"secondsBetweenLastRounds","outputs":[{"internalType":"uint256","name":"secondsCount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_bonus","type":"uint256"}],"name":"setBonus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newPoolAddress","type":"address"}],"name":"setPool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"switchCrowdSale","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"teamAddress","outputs":[{"internalType":"address payable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"tokensForEther","outputs":[{"internalType":"uint256","name":"tokens","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"topUp","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"totalDividends","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"success","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"success","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"unlockTimeStamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"withdrawLP","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];
    var lpABI = [{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount0Out","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1Out","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Swap","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint112","name":"reserve0","type":"uint112"},{"indexed":false,"internalType":"uint112","name":"reserve1","type":"uint112"}],"name":"Sync","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MINIMUM_LIQUIDITY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PERMIT_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_token0","type":"address"},{"internalType":"address","name":"_token1","type":"address"}],"name":"initialize","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"kLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"mint","outputs":[{"internalType":"uint256","name":"liquidity","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"price0CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"price1CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"skim","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount0Out","type":"uint256"},{"internalType":"uint256","name":"amount1Out","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"sync","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];
    hash  = new window.web3.eth.Contract(hashABI,hashAddress);

    hash.methods.poolAddress().call().then(function (result) {
        lp = new window.web3.eth.Contract(lpABI,result);

        lp.methods.totalSupply().call().then(function (result3) {
            var total = result3;
            console.log('total LP: '+ result3);

            hash.methods.unlockTimeStamp(userAddress).call().then(function ( result) {
                var date = new Date(result * 1000);
                console.log (date);

            });

            lp.methods.balanceOf(userAddress).call().then(function (result) {
                console.log('balance: '+ result);
                var lpBalance = parseInt(result);

                hash.methods.lockedBalances(userAddress).call().then(function ( result) {
                    var locked = parseInt(result);
                    console.log('locked LP: '+ locked);

                    var sum = locked+lpBalance;

                    console.log (sum);


                    var share2 = (100*sum/total).toFixed(2);
                    console.log ('poolShare: '+ share2);


                    printStr('poolShare', share2);
                    lp.methods.getReserves().call().then (function (result) {
                        var userPooledUsd = ((share2/100)*(result[1]/(10**18))).toFixed(2);
                        document.getElementById('userPooledUsd').innerText = userPooledUsd;
                        console.dir ('userPooledUsd: '+userPooledUsd);
                    });
                });
            });


        });
    });

    lpDecimals = 18;

    hashBalance(userAddress);
    dividends(userAddress);
    pooledTokens(userAddress);



    web3.eth.getBalance(userAddress).then(function (result) {
        document.getElementById('ethValue').value = ((result/10**11).toFixed(10)/10**7).toFixed(4);
        est();

    });
    //subscribeToMisoTransfer();

    var chain = getChain(ethereum.chainId);
    console.log ('You use '+ chain[0])
    document.getElementById('network').innerHTML = 'Вы используете <a href="'+chain[1]+'" target="_blank">'+chain[0]+'</a>';
}

function printStr(id, str) {
    document.getElementById(id).innerHTML = str;
}

function approveLp() {
    lp.methods.balanceOf(userAddress).call().then(function (result) {
        lp.methods.approve(hashAddress, result.toString()).send({from:userAddress}).on('receipt',function (result) {
            console.log('Lp tokens approved');
        });

    });
}

function deposit() {
    lp.methods.allowance(userAddress, hashAddress).call().then(function (result) {
        console.log('lp tokens allowed: ' + result);
        var min = document.getElementById('minutesToBlock').value;
        hash.methods.depositLP(min).send({from:userAddress}).on('receipt',function (result) {
            console.log('Lp tokens transfered');
        });
    });

}

function withdraw() {
    hash.methods.withdrawLP().send({from:userAddress}).on('receipt',function (result) {
        console.log('Lp tokens transfered');
    });
}


function getChain (chainId) {
    switch (chainId) {
        case '0x1':
            return ['основную сеть Ethereum','https://etherscan.io/'];
        case '0x3':
            return ['Ropsten Test Network','https://ropsten.etherscan.io/'];
        case '0x4':
            return ['Rinkeby Test Network','https://rinkeby.etherscan.io/'];
        case '0x5':
            return ['Goerli Test Network','https://goerli.etherscan.io/'];
        case '0x2a':
            return ['Kovan Test Network','https://kovan.etherscan.io/'];
        case 'undefined':
            return ['Network is undefined. Connect metamask or try to refresh the page.','#'];
    }
}

function subscribeToMisoTransfer() {
    miso.events.Transfer({}, {fromBlock: 'latest'},function (result) {
        console.log(result)}).on('data', function(event){
    });

}

function est() {

    var ethValue = document.getElementById('ethValue').value*10**5;

    hash.methods.tokensForEther(ethValue).call().then(function ( result) {

        var tokens = (result/10**5).toFixed(2);

        printStr('est', tokens);
    });

}


function claim() {
      hash.methods.claimDividends().send({from:userAddress}).then(function ( result) {
          alert ('dividends arrived, jucy feedback')
    });

}

function pooledTokens(address){
    hash.methods.getPooledTokens(address).call().then(function ( result) {
        var pooledTokens = (result/10**18).toFixed(2);
        console.log('getPooledTokens: '+pooledTokens);
        printStr('getPooledTokens', pooledTokens);

    });

    hash.methods.getLockedTokens(address).call().then(function ( result) {
        var lockedTokens = (result/10**18).toFixed(2)
        console.log('getLockedTokens: '+lockedTokens);
        printStr('getLockedTokens', lockedTokens);

    });
}

//user MISO Balance
function hashBalance(userAddress) {
    hash.methods.balanceOf(userAddress).call().then(function ( result) {
        var balance = (result/10**decimals).toFixed(2);

        console.log('Your hash balance: '+balance);
        printStr('hashBalance', balance);

        hash.methods.totalSupply().call().then(function ( result) {
            var percent = (100*balance/(result/10**decimals)).toFixed(2);
            printStr('shares', percent+'%');
        });

        hash.methods.currentPrice().call().then(function ( result) {
            var cap = (balance*result/10**5).toFixed(2);
            printStr('usdBalance', cap);
        });

    });
}


function buy() {
    //gas est 60000
    var ethValue = document.getElementById('ethValue').value * 10**18;
    hash.methods.buyTokens().send({from:userAddress, value:ethValue}).then(function (result) {
        alert ('jucy feedback')
    });
}


//pending miso #pendingMiso(uint256 _pid, address _user)
function dividends(address) {
    hash.methods.getCurrentDividends(address).call().then(function (result) {
        var ethDiv = result/10**18;
        printStr('dividends', ethDiv.toFixed(5));

        hash.methods.latestUSDPrice().call().then(function (result) {
            var usdPrice = result/10**8;
            printStr('usdDividends', (usdPrice*ethDiv).toFixed(2));

        });
    });
}


//MISO ETH UNI-V2 LP Tokens Staked
function userInfo(address) {
    masterChef.methods.userInfo(0, address).call().then(function ( result) {
        console.log('lp tokens provided: '+result[0]/10**lpDecimals);
        printStr('deposit', (Math.floor(result[0]/10**(lpDecimals-4))/10000).toFixed(decimalDisp));
        //console.log('rewardDebt: '+result[1]/10**misoDecimals);
        return result;

    });
}

//Harvest
//Harvest
function harvestMiso() {
    masterChef.methods.withdraw(0, 0).send({from:userAddress}).on('receipt',function (result) {
        console.log('Miso harvested');
    });
}

function lpBalance(){
    lp.methods.balanceOf(userAddress).call().then(function (result) {
        printStr('lptokens', (Math.floor(result/10**(lpDecimals-4))/10000).toFixed(decimalDisp));

    });
}

//Approve MISO ETH UNI-V2 LP Tokens


//Supply MISO ETH UNI-V2 LP Tokens


