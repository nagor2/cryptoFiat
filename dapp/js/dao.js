var DAOAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "WETH",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "name",
                "type": "string"
            }
        ],
        "name": "NewVoting",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "VotingFailed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "VotingSucceed",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "activeVoting",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "name": "addresses",
        "outputs": [
            {
                "internalType": "address payable",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "authorized",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "name": "params",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "paused",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "pooled",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalPooled",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "votings",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "totalPositive",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "voteingType",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "internalType": "address payable",
                "name": "addr",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "startTime",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "decision",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "addressName",
                "type": "string"
            },
            {
                "internalType": "address payable",
                "name": "addr",
                "type": "address"
            }
        ],
        "name": "setAddressOnce",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "votingType",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "internalType": "address payable",
                "name": "addr",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "_decision",
                "type": "bool"
            }
        ],
        "name": "addVoting",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renewContracts",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "poolTokens",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "returnTokens",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "votingId",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "_vote",
                "type": "bool"
            }
        ],
        "name": "vote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "votingId",
                "type": "uint256"
            }
        ],
        "name": "claimToFinalizeVoting",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var daoAddress = "0xAFB159B19bf46b50d37a2Ee0d985Eb9163F7cd7A";

var userAddress;
var masterChef;
var lp;

const decimals = 18;
var ethereum;

unlock();

async function unlock(){
    alert('unlock');
    if (typeof web3 !== 'undefined') {
        // Use the browser's ethereum provider
        window.web3 = new Web3(web3.currentProvider);
        ethereum = window.ethereum;

        if (ethereum !== 'undefined' && ethereum.isConnected()) {
            try {
                await ethereum.enable();
                console.log ('Connected ' + ethereum.selectedAddress)

                userAddress = ethereum.selectedAddress;
                console.log (userAddress);
                //initGlobals();
                //misoBalance(userAddress);
                //misoTotalSupply();
                //pendingMiso(userAddress);
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


