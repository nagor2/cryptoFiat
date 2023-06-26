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
var cdpAddress;
var depositAddress;
var auctionAddress;
var auction;
var oracle;
var platform;

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

    daoStatic.methods.addresses("platform").call().then(function (result) {
        platform = new web3.eth.Contract(platformABI,result);
    });

    daoStatic.methods.addresses("stableCoin").call().then(function (result) {
        stableCoin = new web3.eth.Contract(stableCoinABI,result);
        stableCoinBalance();
    });

    daoStatic.methods.addresses("cdp").call().then(function (result) {
        cdpAddress = result;
        cdp = new web3.eth.Contract(cdpABI,result);
        getMyDebtPositions();
        stableCoin.methods.allowance(userAddress, cdpAddress).call().then(function (result) {
            document.getElementById('cdpAllowance').innerText = (result/(10**18)).toFixed(5);
        });
    });

    daoStatic.methods.addresses("oracle").call().then(function (result) {
        oracle = new web3.eth.Contract(oracleABI,result);
    });


    daoStatic.methods.addresses("deposit").call().then(function (result) {
        deposit = new web3.eth.Contract(depositABI,result);
        depositAddress = result;
        getMyDeposits();
        stableCoin.methods.allowance(userAddress, depositAddress).call().then(function (result) {
            document.getElementById('depositAllowance').innerText = (result/(10**18)).toFixed(5);
        });
        stableCoin.methods.allowance(cdpAddress, userAddress).call().then(function (result) {
            document.getElementById('myCDPAllowance').innerText = (result/(10**18)).toFixed(5);
        });
    });

    daoStatic.methods.addresses("cart").call().then(function (result) {
        cart = new web3.eth.Contract(cartABI,result);
    });

    daoStatic.methods.addresses("weth").call().then(function (result) {
        weth = new web3.eth.Contract(wethABI,result);
        weth.methods.balanceOf(userAddress).call().then (function (result){
            document.getElementById('wethBalance').innerText = (result/(10**18)).toFixed(6);
            document.getElementById('wethConvert').innerHTML = ' <input type="button" value="convert" onclick="weth.methods.withdraw(\''+result.toString()+'\').send({from:userAddress})">';
        })
    });

    daoStatic.methods.addresses("auction").call().then(function (result) {
        auction = new web3.eth.Contract(auctionABI,result);
    });

    subscribeToMetamaskEvents();

    ruleStatic.methods.balanceOf(userAddress).call().then(function (result) {
        document.getElementById('ruleBalance').innerText = (result/(10**18)).toFixed(2);});
    ruleStatic.methods.allowance(userAddress, daoAddress).call().then(function (result) {
        document.getElementById('allowed').innerText = (result/(10**18)).toFixed(2);
    });
    ruleStatic.methods.balanceOf(daoAddress).call().then(function (result) {
        document.getElementById('ruleBalanceOfDAO').innerText = (result / (10 ** 18)).toFixed(2);
        daoStatic.methods.totalPooled().call().then(function (result) {
            document.getElementById('overallPooled').innerText = (result / (10 ** 18)).toFixed(2);
        });

        stableCoinStatic.methods.balanceOf(userAddress).call().then(function (result) {
            document.getElementById('stableCoinBalance').innerText = (result / (10 ** 18)).toFixed(2);
        });

        daoStatic.methods.pooled(userAddress).call().then(function (result) {
            var pooledTokens = (result / 10 ** 18).toFixed(2);
            console.log('pooled: ' + pooledTokens);
            printStr('pooled', pooledTokens);
        });

        daoStatic.methods.activeVoting().call().then(function (result) {
            document.getElementById('activeVoting').innerText = result;
            if (result.toString() == 'true') {
                $('#votingParams').slideToggle();
                document.getElementById("claimToFinalizeButton").disabled = false;
            } else document.getElementById("claimToFinalizeButton").disabled = true;
        });

        window.web3.eth.getBalance(userAddress).then(function (result) {
            document.getElementById('userAddress').innerText = userAddress;
            document.getElementById('ethValue').innerText = ((result / 10 ** 11).toFixed(10) / 10 ** 7).toFixed(4);
            //est();

        });

        subscribeToDaoEvents();

        var chain = getChain(ethereum.chainId);
        //console.log ('You use '+ chain[0])
        //document.getElementById('network').innerHTML = 'Вы используете <a href="'+chain[1]+'" target="_blank">'+chain[0]+'</a>';
    });
}

function openCDP(){
    let collateral = document.getElementById('ethCollateral').value;
    let amount = document.getElementById('stableCoinsAmount').value;
    cdp.methods.openCDP(localWeb3.utils.toWei(amount.toString())).send({from:userAddress, value: web3.utils.toWei(collateral.toString())}).then(function (result) {
        window.location.reload();
    });
}

function stableCoinBalance(){
stableCoin.methods.balanceOf(userAddress).call().then(function (result){
    document.getElementById("stableCoinBalance").innerText = parseFloat(result/10**18).toFixed(2);
});
}

function allowRuleTokensToDao(){
    let amount = document.getElementById('tokensToPool').value;
    rule.methods.approve(daoAddress, localWeb3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function poolTokens(){
        dao.methods.poolTokens().send({from:userAddress}).then(function (result) {
            alert('success');
        });
}

function newVoting(){
    let votingType = document.getElementById('votingType').value
    let name = document.getElementById('name').value
    let value = document.getElementById('value').value
    let addr = document.getElementById('addr').value
    let decision = document.getElementById('decision').value;

    dao.methods.addVoting(votingType, name, value, addr, decision).send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function sendVote(){
    let decision = document.getElementById('VoteDecision').checked;
    console.log(decision);

    dao.methods.vote(votingId, decision).send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function claimToFinalize(){
    dao.methods.claimToFinalizeVoting(votingId).send({from:userAddress}).then(function (result) {
        alert('success');
    });}

function returnDAOTokens(){
    dao.methods.returnTokens().send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function printStr(id, str) {
    document.getElementById(id).innerHTML = str;
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
    cdp.getPastEvents('PositionOpened', {fromBlock: 0,toBlock: 'latest'}).then(function(events){

        for (var i =0; i<events.length; i++) {
            let event = events[i];
            if (event.returnValues.owner.toLowerCase()==userAddress.toLowerCase()){
                //let posId = event.returnValues.posId;

                printDebtPosition(event.returnValues.posId);


                    //cdpStatic.methods.totalCurrentFee(posId).call().then(function (result) {
                        //document.getElementById('accInterest-id-'+id).innerText = localWeb3.utils.fromWei(result);
                   // });

            }
        }


    });
}

function printDebtPosition(id){
    let html='';
    console.log (id+" printDebtPosition");

    cdpStatic.methods.totalCurrentFee(id).call().then(function (fee) {
        cdpStatic.methods.positions(id).call().then(function(position){
            cdpStatic.methods.getMaxStableCoinsToMint(position.wethAmountLocked).call().then(function(maxCoins) {

                if (!position.liquidated)
                    html = "<div id='position-" + id + "'>" +
                        "<p>opened: " + dateFromTimestamp(position.timeOpened) + "</p>" +
                        "<p>updated: " + dateFromTimestamp(position.lastTimeUpdated) + "</p>" +
                        "<p>coinsMinted (red/yellow/green): " + localWeb3.utils.fromWei(position.coinsMinted) + "</p>" +
                        "<p>wethLocked: " + localWeb3.utils.fromWei(position.wethAmountLocked) + "</p>" +
                        "<p>collateral (red/yellow/green): " + localWeb3.utils.fromWei(position.wethAmountLocked) + "</p>" +
                        "<p>maxCoinsToMint : " + localWeb3.utils.fromWei(maxCoins) + "</p>" +
                        "<p>recorded:  " + web3.utils.fromWei(position.feeGeneratedRecorded) + "</p>" +
                        "<p>accumulated interest:  " + web3.utils.fromWei(fee) + "</p>" +
                        "<input type=\"button\" value=\"closeCDP\" onclick=\"cdp.methods.closeCDP(" + id + ").send({from:userAddress});\">" +
                        "<input type=\"button\" value=\"updateCDP\" onclick=\"updateCDP(" + id + ")\">" +
                        "<input type=\"button\" value=\"withdraw\" onclick=\"withdrawEther(" + id + ")\">" +
                        "<input type=\"button\" value=\"payInterest\" onclick=\"payInterest(" + id + ")\">" +
                        "</div>";
                document.getElementById("cdps").innerHTML += html;
            });
        });
    });
}

function printDeposit(id){
    let html='';

    depositStatic.methods.overallInterest(id).call().then(function (interest) {
        depositStatic.methods.deposits(id).call().then(function(deposit){
            if (!deposit.closed)
                html = "<div id='deposit-"+id+"'>" +
                    "<p>opened: "+dateFromTimestamp(deposit.timeOpened)+"</p>" +
                    "<p>updated: "+dateFromTimestamp(deposit.lastTimeUpdated)+"</p>" +
                    "<p>coinsDeposited: "+localWeb3.utils.fromWei(deposit.coinsDeposited)+"</p>"+
                    "<p>accumulated interest:  "+web3.utils.fromWei(interest)+"</p>"+
                    "<input type=\"button\" value=\"claimInterest\" onclick=\"deposit.methods.claimInterest("+id+").send({from:userAddress});\">"+
                    "<input type=\"button\" value=\"topUp\" onclick=\"topUp("+id+")\">"+
                    "<input type=\"button\" value=\"withdraw\" onclick=\"withdrawFromDeposit("+id+")\">"+
                    "<input type=\"button\" value=\"close\" onclick=\"closeDeposit("+id+");\">"+
                    "</div>";
            document.getElementById("myDeposits").innerHTML += html;
        });
    });
}

function printAuction(id){
    let html='';
    auctionStatic.methods.auctions(id).call().then(function (auction) {
        auctionStatic.methods.bids(auction.bestBidId).call().then(function(bid){
            if (!auction.finalized)
                html = "<div id='auction-"+id+"'>" +
                    "<p>initTime: "+dateFromTimestamp(auction.initTime)+"</p>" +
                    "<p>updated: "+dateFromTimestamp(auction.lastTimeUpdated)+"</p>" +
                    "<p>lotToken: "+auction.lotToken+"</p>" +
                    "<p>lotAmount: "+localWeb3.utils.fromWei(auction.lotAmount)+"</p>" +
                    "<p>paymentToken: "+auction.paymentToken+"</p>" +
                    "<p>paymentAmount: "+localWeb3.utils.fromWei(auction.paymentAmount)+"</p>" +
                    "<p>best bid: "+bid.owner+"</p>" +
                    "<p>bidAmount: "+localWeb3.utils.fromWei(bid.bidAmount)+"</p>" +
                    "<p>bid time: "+dateFromTimestamp(bid.time)+"</p>" +
                    "<input type=\"button\" value=\"claim to finalize\" onclick=\"claimToFinalizeAuction("+id+")\">"+
                    "<input type=\"text\" value=\"0\" id='bidAmount'>"+
                    "<input type=\"button\" value=\"approve\" onclick=\"approveForAuction()\">"+
                    "<input type=\"button\" value=\"approveRuleForAuction\" onclick=\"approveRuleForAuction()\">"+

                    "<input type=\"button\" value=\"make new bid\" onclick=\"makeBid("+id+")\">"+
                    "</div>";
            document.getElementById("activeAuctions").innerHTML += html;
        });
    });
}

function printBid(auctionId, bidId){
    let html='';
    auctionStatic.methods.auctions(auctionId).call().then(function (auction) {
        auctionStatic.methods.bids(bidId).call().then(function(bid){
            if (!auction.finalized) {
                html = "<div id='bid-" + bidId + "'>" +
                    "<p>bidAmount: " + localWeb3.utils.fromWei(bid.bidAmount) + "</p>" +
                    "<p>bid time: " + dateFromTimestamp(bid.time) + "</p>" +
                    "<input type=\"button\" value=\"improve bid\" onclick=\"improveBid(" + bidId + ")\">" +
                    "<input type=\"button\" value=\"cancel bid\" onclick=\"cancelBid(" + bidId + ")\">" +
                    "</div>";
                document.getElementById("auction-"+auctionId).innerHTML += html;

            }
            else if (!bid.canceled && auction.bestBidId!=bidId) {
                html = "<div id='bid-"+bidId+"'>" +
                    "<h3>You have bid on finilized auction. Please, cancel it to return assets</h3>"+
                    "<p>paymentToken: "+auction.paymentToken+"</p>" +
                    "<p>paymentAmount: "+localWeb3.utils.fromWei(auction.paymentAmount)+"</p>" +
                    "<p>bidAmount: "+localWeb3.utils.fromWei(bid.bidAmount)+"</p>" +
                    "<p>bid time: "+dateFromTimestamp(bid.time)+"</p>" +
                    "<input type=\"button\" value=\"cancel bid\" onclick=\"cancelBid("+bidId+")\">"+
                    "</div>";
                document.getElementById("bidsToCancel").innerHTML += html;
            }

        });
    });
}

function printBidCanceled(auctionId, bidId){
    let html='';
    auctionStatic.methods.auctions(auctionId).call().then(function (auction) {
        auctionStatic.methods.bids(bidId).call().then(function(bid){
            if (!auction.finalized)
                html = "<div id='bidCanceled-"+bidId+"'>" +
                    "<b>bid was canceled: "+bidId+"</b>" +
                    "<p>bidAmount: "+localWeb3.utils.fromWei(bid.bidAmount)+"</p>" +
                    "<p>bid time: "+dateFromTimestamp(bid.time)+"</p>" +
                    "</div>";
            document.getElementById("canceledBids").innerHTML += html;
        });
    });
}

function makeBid(id){
    let amount = document.getElementById("bidAmount").value;
    auction.methods.makeBid(id,web3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert ('bid successful');
    });
}

function claimToFinalizeAuction(auctionId){
    auction.methods.claimToFinalizeAuction(auctionId).send({from:userAddress}).then(function (result) {
        alert ('finalized successfully');
    });
}

function cancelBid(id){
    auction.methods.cancelBid(id).send({from:userAddress}).then(function (result) {
        alert('bid canceled');
    });
}

function approveForAuction(){
    let amount = document.getElementById("bidAmount").value;
    stableCoin.methods.approve(auctionAddress,web3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert('approved');
    });
}

function approveRuleForAuction(){
    let amount = document.getElementById("bidAmount").value;
    rule.methods.approve(auctionAddress,web3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert ('rule tokens approved')
    });
}


function improveBid(bidId){
    let amount = document.getElementById("bidAmount").value;
    auction.methods.improveBid(bidId,web3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert ('bid improved');
    });
}

function withdrawFromDeposit(id){
    let amount = document.getElementById("stableCoinsToDeposit").value;
    deposit.methods.withdraw(id,web3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function topUp(id){
    deposit.methods.topUp(id).send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function closeDeposit(id){
    deposit.methods.deposits(id).call().then(function (d){
        deposit.methods.withdraw(id,d.coinsDeposited).send({from:userAddress}).then(function (result) {
            alert ('deposit closed');
        });
    });
}

function withdrawEther(id){
    let withdraw = document.getElementById('ethCollateral').value;
    cdp.methods.withdrawEther(id, localWeb3.utils.toWei(withdraw)).send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function payInterest(id){
    cdp.methods.transferFee(id).send({from:userAddress}).then(function (result) {
        alert('success');
    });
}

function putOndeposit(){
        deposit.methods.deposit().send({from:userAddress}).then(function (result) {
            alert('success');
        });
}

function getMyDeposits(){
    deposit.getPastEvents('DepositOpened', {fromBlock: 0,toBlock: 'latest'}).then(function(events){
        for (let i =0; i<events.length; i++) {
            let event = events[i];
            if (event.returnValues.owner.toLowerCase()==userAddress.toLowerCase()){
                printDeposit(event.returnValues.id);
            }
        }
    });
}

function allowToDeposit (){
    let amount = document.getElementById('stableCoinsToDeposit').value;
    stableCoin.methods.approve(depositAddress, localWeb3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert('allowed');
    });
}

function updateCDP(id){
    let collateral = document.getElementById('ethCollateral').value;
    let amount = document.getElementById('stableCoinsAmount').value;
    cdp.methods.updateCDP(id, localWeb3.utils.toWei(amount)).send({from:userAddress, value: web3.utils.toWei(collateral)}).then(function (result) {
        alert('success');
    });
}

function allowCoinsToCDP(){
    let amount = document.getElementById('stableCoinsAmount').value;
    stableCoin.methods.approve(cdpAddress, localWeb3.utils.toWei(amount)).send({from:userAddress}).then(function (result) {
        alert('success');
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

function initCoinsBuyOut(){
    daoStatic.methods.addresses('cdp').call().then(function (add){
        stableCoinStatic.methods.totalSupply().call().then(function (supply){
            stableCoinStatic.methods.balanceOf(add).call().then(function (stabFund){
                dao.methods.params('stabilizationFundPercent').call().then(function (percent){
                        let coinsNeeded = supply*percent/100 - stabFund;
                    if (coinsNeeded>0){
                        console.log("needed: "+localWeb3.utils.fromWei(coinsNeeded.toString()));
                        auction.methods.initCoinsBuyOutForStabilization(coinsNeeded.toString()).send({from:userAddress}).then(function (result) {
                            window.location.reload();
                        });
                    }
                    else alert ('there is no need to init buyout. Stub fund is full enough')
                })
            });
        });
    });

}

function initRuleBuyOut(){
    auction.methods.initRuleBuyOut().send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function transferFromCDP() {
    stableCoin.methods.allowance(cdpAddress, userAddress).call().then(function (approved) {
        stableCoin.methods.transferFrom(cdpAddress, userAddress, approved).send({from:userAddress});
    })
}


function allowSurplusToAuction(){
    cdp.methods.allowSurplusToAuction().send({from:userAddress}).then(function (result) {
        window.location.reload();
    });
}

function fillVoting(id) {
    daoStatic.methods.votings(id).call().then(function (result) {

        document.getElementById('totalPositive').innerText = web3.utils.fromWei(result[0]);
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

function claimEmission(){
    daoStatic.methods.addresses('inflationFund').call().then(function (result){
        let inflation = new web3.eth.Contract(inflationABI,result);
        inflation.methods.claimEmission().send({from:userAddress});
    })
}


