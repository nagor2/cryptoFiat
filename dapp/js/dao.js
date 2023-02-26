var userAddress;
const decimals = 18;
var ethereum;
var dao;
var rule;
var stableCoin;
var cart;
var cdp;
var deposit;
var votingId;
var weth;



async function unlock(){
    if (typeof web3 !== 'undefined') {
        // Use the browser's ethereum provider
        window.web3 = new Web3(web3.currentProvider);
        ethereum = window.ethereum;
        if (ethereum !== 'undefined' || !ethereum.isConnected()) {
            try {
                await ethereum.enable();
                console.log ('Connected ' + ethereum.selectedAddress)

                userAddress = await ethereum.selectedAddress;
                console.log (userAddress);
                initGlobals();
                //misoBalance(userAddress);
                //misoTotalSupply();
                //pendingMiso(userAddress);
            }
            catch(error){

                console.dir (error);
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

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        console.log('Please connect to MetaMask.');
    } else if (accounts[0] !== userAddress) {
        userAddress = accounts[0];
        alert (userAddress);
        // Do any other work!
    }
}

function initGlobals() {

    rule = new web3.eth.Contract(ruleABI,ruleAddress);
    dao = new web3.eth.Contract(daoABI,daoAddress);
    daoStatic.methods.addresses("cdp").call().then(function (result) {
        cdp = new web3.eth.Contract(cdpABI,result);
        getMyDebtPositions();
    });

    daoStatic.methods.addresses("cart").call().then(function (result) {
        cart = new web3.eth.Contract(cartABI,result);
    });

    daoStatic.methods.addresses("weth").call().then(function (result) {
        weth = new web3.eth.Contract(wethABI,result);
    });


    subscribeToMetamaskEvents();


    ruleStatic.methods.balanceOf(userAddress).call().then(function (result) {
        document.getElementById('ruleBalance').innerText = (result/(10**18)).toFixed(2);});
    ruleStatic.methods.allowance(userAddress, daoAddress).call().then(function (result) {
        document.getElementById('allowed').innerText = (result/(10**18)).toFixed(2);
    });
    ruleStatic.methods.balanceOf(daoAddress).call().then(function (result) {
        document.getElementById('ruleBalanceOfDAO').innerText = (result/(10**18)).toFixed(2);
    });
    daoStatic.methods.totalPooled().call().then(function (result) {
        document.getElementById('overallPooled').innerText = (result/(10**18)).toFixed(2);
    });

    stableCoinStatic.methods.balanceOf(userAddress).call().then(function (result) {
        document.getElementById('stableCoinBalance').innerText = (result/(10**18)).toFixed(2);
    });

    daoStatic.methods.pooled(userAddress).call().then(function ( result) {
        var pooledTokens = (result/10**18).toFixed(2);
        console.log('pooled: '+pooledTokens);
        printStr('pooled', pooledTokens);
    });

    daoStatic.methods.activeVoting().call().then(function (result) {
        document.getElementById('activeVoting').innerText = result;
        if (result.toString()=='true') {
            $('#votingParams').slideToggle();
            document.getElementById("claimToFinalizeButton").disabled = false;
        }
        else document.getElementById("claimToFinalizeButton").disabled = true;
    });

/*
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

    lpDecimals = 18;*/
/*
    hashBalance(userAddress);
    dividends(userAddress);
    pooledTokens(userAddress);

*/

    window.web3.eth.getBalance(userAddress).then(function (result) {
        document.getElementById('userAddress').innerText = userAddress;
        document.getElementById('ethValue').innerText = ((result/10**11).toFixed(10)/10**7).toFixed(4);
        //est();

    });
    subscribeToDaoEvents();

    var chain = getChain(ethereum.chainId);
    console.log ('You use '+ chain[0])
    document.getElementById('network').innerHTML = 'Вы используете <a href="'+chain[1]+'" target="_blank">'+chain[0]+'</a>';
}
function openCDP(){
    let collateral = document.getElementById('ethCollateral').value;
    cdp.methods.openCDP(daoAddress, localWeb3.utils.toWei(amount)).send({from:userAddress, value: web3.utils.toWei(collateral)}).then(function (result) {
        window.location.reload();
    });
}

function allowRuleTokensToDao(){
    let amount = document.getElementById('tokensToPool').value;
    rule.methods.approve(daoAddress, localWeb3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function poolTokens(){
        dao.methods.poolTokens().send({from:userAddress}).then(function (result) {
            window.location.reload();
        });
}

function newVoting(){
    let votingType = document.getElementById('votingType').value
    let name = document.getElementById('name').value
    let value = document.getElementById('value').value
    let addr = document.getElementById('addr').value
    let decision = document.getElementById('decision').value;

    dao.methods.addVoting(votingType, name, value, addr, decision).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function sendVote(){
    let decision = document.getElementById('VoteDecision').checked;
    console.log(decision);

    dao.methods.vote(votingId, decision).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function claimToFinalize(){
    dao.methods.claimToFinalizeVoting(votingId).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });}

function returnTokens(){
    dao.methods.returnTokens().send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}


function printStr(id, str) {
    document.getElementById(id).innerHTML = str;
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

function getMyDebtPositions(){
    cdp.getPastEvents('PositionOpened', {fromBlock: 0,toBlock: 'latest'}).then(function(event){
        if (event[1]==userAddress){
            console.log(event);
            let posId = event[0];
            printDebtPosition(posId).then(function (){
                cdpStatic.methods.totalCurrentFee(posId).call().then(function (result) {
                    document.getElementById('accInterest-id-'+id).innerText = localWeb3.utils.fromWei(result);
                });
            });
        }
    });
}

function printDebtPosition(id){
    let html;
cdpStatic.methods.positions(id).call().then(function(position){
    html = "<div id='position-"+id+"'>" +
        "<p>opened: "+dateFromTimestamp(position.timeOpened)+"</p>" +
        "<p>updated: "+dateFromTimestamp(position.lastTimeUpdated)+"</p>" +
        "<p>coinsMinted: "+localWeb3.utils.fromWei(position.coinsMinted)+"</p>"+
        "<p>accumulated interest:  <span style='font-weight: bold;' id='accInterest-id-"+id+"'></span></p>"+
        "</div>"
    return html;
});

}

async function subscribeToDaoEvents() {
    let votingEvents = await daoStatic.getPastEvents('NewVoting', {
        fromBlock: 0,
        toBlock: 'latest'
    });

    if (votingEvents.length>0){
        let lastEvent = votingEvents[votingEvents.length -1];
        votingId = lastEvent.returnValues[0];
        fillVoting(votingId);
    }


    //    event VotingSucceed (uint256 id);
    //     event VotingFailed (uint256 id);
}

function fillVoting(id) {
    daoStatic.methods.votings(id).call().then(function (result) {

        document.getElementById('totalPositive').innerText = result[0];
        document.getElementById('voteingType').innerText = result[1];
        document.getElementById('voteingName').innerText = result[2];
        document.getElementById('voteingValue').innerText = result[3];
        document.getElementById('voteingAddress').innerText = result[4];
        document.getElementById('voteingStartTime').innerText = dateFromTimestamp(result[5]);
        document.getElementById('voteingDecision').innerText = result[6];
        console.log(result);
    });
}

function subscribeToMetamaskEvents(){
    ethereum.on('chainChanged', (chainId) => {
        // Handle the new chain.
        // Correctly handling chain changes can be complicated.
        // We recommend reloading the page unless you have good reason not to.
        window.location.reload();
    });

    ethereum.on('accountsChanged', handleAccountsChanged);

    ethereum.on('connect', (ConnectInfo) => {
        console.log (ConnectInfo);
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
          alert ('dividends arrived, juicy feedback')
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


