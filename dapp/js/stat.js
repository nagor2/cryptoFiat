var localWeb3 = new Web3(new Web3.providers.HttpProvider('https://goerli.infura.io/v3/7005259595814e4185411127fb00ecf4'));


var wethAddress;
var daoAddress = '0xF85366a7eD78c51A60A2a06Bc666c63240dAfB96';

var stableCoinABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_INTDAOaddress",
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
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Burned",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Mint",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "stateMutability": "payable",
        "type": "receive",
        "payable": true
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "remaining",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "approve",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint",
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
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "burn",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var ruleABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_INTDAOaddress",
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
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Burned",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Mint",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "supply",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tokenHolder",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "approve",
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
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint",
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
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "burn",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var daoABI = [
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
        "type": "function",
        "constant": true
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
var depositABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "INTDAOaddress",
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
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "rate",
                "type": "uint256"
            }
        ],
        "name": "DepositOpened",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "counter",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "deposits",
        "outputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "coinsDeposited",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "timeOpened",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "period",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "currentInterestRate",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "lastTimeUpdated",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "accumulatedInterest",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
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
        "name": "deposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "topUp",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "overallInterest",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "interest",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "updateInterest",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "accumulated",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "claimInterest",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var cdpABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "INTDAOaddress",
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
                "name": "posID",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "name": "OnLiquidation",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            }
        ],
        "name": "PositionOpened",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newStableCoinsAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "wethLocked",
                "type": "uint256"
            }
        ],
        "name": "PositionUpdated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "name": "markedOnLiquidation",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "numPositions",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "positions",
        "outputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "coinsMinted",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "wethAmountLocked",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "feeGeneratedRecorded",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "timeOpened",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "lastTimeUpdated",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "feeRate",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "markedOnLiquidation",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "onLiquidation",
                "type": "bool"
            },
            {
                "internalType": "bool",
                "name": "liquidated",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "liquidationAuctionID",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "renewContracts",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "StableCoinsToMint",
                "type": "uint256"
            }
        ],
        "name": "openCDP",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "stateMutability": "payable",
        "type": "function",
        "payable": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "generatedFeeUnrecorded",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "fee",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "totalCurrentFee",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "fee",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "ethValue",
                "type": "uint256"
            }
        ],
        "name": "getMaxStableCoinsToMint",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "getMaxStableCoinsToMintForPos",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "maxAmount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "beneficiary",
                "type": "address"
            }
        ],
        "name": "claimInterest",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "beneficiary",
                "type": "address"
            }
        ],
        "name": "claimEmission",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "closeCDP",
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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "transferFee",
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
        "name": "allowSurplusToAuction",
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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "claimMarginCall",
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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "startCoinsBuyOut",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "finishMarginCall",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "markToLiquidate",
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
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "eraseMarkToLiquidate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "newStableCoinsAmount",
                "type": "uint256"
            }
        ],
        "name": "updateCDP",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            }
        ],
        "stateMutability": "payable",
        "type": "function",
        "payable": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "etherToWithdraw",
                "type": "uint256"
            }
        ],
        "name": "withdrawEther",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "wethLocked",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posID",
                "type": "uint256"
            }
        ],
        "name": "isOnLiquidation",
        "outputs": [
            {
                "internalType": "bool",
                "name": "result",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "burnRule",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mintRule",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var wethABI = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "src",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "guy",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "dst",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "Deposit",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "src",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "dst",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "src",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "Withdrawal",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "stateMutability": "payable",
        "type": "receive",
        "payable": true
    },
    {
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
        "payable": true
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "guy",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "approve",
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
                "internalType": "address",
                "name": "dst",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "transfer",
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
                "internalType": "address",
                "name": "src",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "dst",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "wad",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
var inflationABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "INTDAOaddress",
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
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "inflationEmission",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "lastEmission",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function",
        "constant": true
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
        "name": "claimEmission",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimTransfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

var dao = new localWeb3.eth.Contract(daoABI,daoAddress);

var stableCoin;
var rule;

dao.methods.addresses('rule').call().then(function (result) {
    ruleAddress = result;
    rule = new localWeb3.eth.Contract(ruleABI,ruleAddress);

    getTransfers(rule).then(function (result) {
        document.getElementById('ruleTxCount').innerText = result.length;
        //console.log(result);
    });


    getHolders(rule).then(function (result) {
        document.getElementById('ruleHolders').innerText = result.length;
        //console.log(result);
    });

    document.getElementById('ruleLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + ruleAddress + '>'+ruleAddress+'</a>';
    rule.methods.totalSupply().call().then(function (result) {
        document.getElementById('ruleSupply').innerText = (result/(10**18)).toFixed(2);
    });
});

dao.methods.addresses('weth').call().then(function (result) {
    wethAddress = result;
    var weth = new localWeb3.eth.Contract(wethABI,wethAddress);

    document.getElementById('wethLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + wethAddress + '>'+wethAddress+'</a>';

    dao.methods.addresses('cdp').call().then(function (result) {
        weth.methods.balanceOf(result).call().then(function (result) {
            document.getElementById('overallCollateral').innerText = (result/(10**18)).toFixed(2);
        });
    });
});

dao.methods.addresses('inflationFund').call().then(function (result) {
    var inflationAddress = result;
    var inflation = new localWeb3.eth.Contract(inflationABI,inflationAddress);

    document.getElementById('inflationLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + inflationAddress + '>'+inflationAddress+'</a>';

    inflation.methods.lastEmission().call().then(function (result) {
            document.getElementById('lastEmission').innerText = dateFromTimestamp(result);
    });
});

dao.methods.addresses('cart').call().then(function (result) {
    var cartAddress = result;

    document.getElementById('cartLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + cartAddress + '>'+cartAddress+'</a>';

});

dao.methods.addresses('auction').call().then(function (result) {
    var auctionAddress = result;

    document.getElementById('auctionLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + auctionAddress + '>'+auctionAddress+'</a>';

});



dao.methods.addresses('stableCoin').call().then(function (result) {
    stableCoinAddress = result;
    stableCoin = new localWeb3.eth.Contract(stableCoinABI,stableCoinAddress);
    getTransfers(stableCoin).then(function (result) {
        document.getElementById('stableTxCount').innerText = result.length;
        //console.log(result);
    });


    getHolders(stableCoin).then(function (result) {
        document.getElementById('stableHolders').innerText = result.length;
        //console.log(result);
    });

    document.getElementById('stableCoinLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + stableCoinAddress + '>'+stableCoinAddress+'</a>';
    stableCoin.methods.totalSupply().call().then(function (result) {
        document.getElementById('stableCoinSupply').innerText = (result/(10**18)).toFixed(2);
    });


    dao.methods.addresses('cdp').call().then(function (result) {
        var cdpAddress = result;
        document.getElementById('cdpLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + cdpAddress + '>'+cdpAddress+'</a>';

        stableCoin.methods.balanceOf(cdpAddress).call().then(function (result) {
            document.getElementById('stabFund').innerText = (result/(10**18)).toFixed(2);
        });

        var cdp = new localWeb3.eth.Contract(cdpABI,cdpAddress);

        cdp.methods.numPositions().call().then(function (result) {
            document.getElementById('positionsCount').innerText = result;
        });
    });

    dao.methods.addresses('deposit').call().then(function (result) {
        var depositAddress = result;
        document.getElementById('depositLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + depositAddress + '>'+depositAddress+'</a>';
        stableCoin.methods.balanceOf(depositAddress).call().then(function (result) {
            document.getElementById('overallDeposits').innerText = (result/(10**18)).toFixed(2);
        });

        var deposit = new localWeb3.eth.Contract(depositABI,depositAddress);

        deposit.methods.counter().call().then(function (result) {
            document.getElementById('depositsCount').innerText = result;
        });
    });
});

dao.methods.params("annualInflationPercent").call().then(function (result) {
    document.getElementById('annualInflation').innerText = result + "%";
});

dao.methods.params("interestRate").call().then(function (result) {
    document.getElementById('interestRate').innerText = result + "%";
});

dao.methods.params("depositRate").call().then(function (result) {
    document.getElementById('depositRate').innerText = result + "%";
});

dao.methods.params("collateralDiscount").call().then(function (result) {
    document.getElementById('collateralDiscount').innerText = result + "%";
});

/*
dao.methods.params().call().then(function (result) {
    document.getElementById('stableCoinSupply').innerText = (result/(10**18)).toFixed(2);
});*/

function dateFromTimestamp(timeStamp){
    var d = new Date(timeStamp * 1000);
    return ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" +
        d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) +":"+ ("0" + d.getSeconds()).slice(-2);
}

async function getTransfers(contract) {
    var txs = await contract.getPastEvents('Transfer', {
        fromBlock: 0,
        toBlock: 'latest'
    })
    return txs;
}

async function getHolders(contract){
    txs = await getTransfers(contract);

    var holders = [];

    for (var i = 0; i< txs.length; i++) {
        if(holders.indexOf(txs[i].returnValues['from']) === -1) {
            holders.push(txs[i].returnValues['from']);
        }
        if(holders.indexOf(txs[i].returnValues['to']) === -1) {
            holders.push(txs[i].returnValues['to']);
        }
    }
    return holders;
}





/*
hashToken.methods.poolAddress().call().then(function (result) {

    console.log('poolAddress ' + result);

    pool = new localWeb3.eth.Contract(lpABI,result);

    pool.methods.getReserves().call().then (function (result) {
        var pooledUsd = (result[1]/(10**18)).toFixed(2);
        var pooledTokens = (result[0]/(10**18)).toFixed(2);

        document.getElementById('pooledUsd').innerText = pooledUsd;
        document.getElementById('pooledTokens').innerText = pooledTokens;

        console.dir ('pooledUsd: '+pooledUsd);
        console.dir ('pooledTokens: '+pooledTokens);
    });

    pool.methods.price0CumulativeLast().call().then (function (result) {
        console.dir ('price0CumulativeLast: '+(result/(10**18)).toFixed(2));
    });
    pool.methods.price0CumulativeLast().call().then (function (result) {
        console.dir ('price0CumulativeLast: '+(result/(10**18)).toFixed(2));
    });

});


hashToken.methods.currentPrice().call().then(function (result) {
    var price = (result/(10**5)).toFixed(2);
    document.getElementById('currentPrice').innerText = price;
    console.log("currentPrice: " + price);

    hashToken.methods.totalSupply().call().then(function (result) {
        var supply = (result/(10**18)).toFixed(2);
        document.getElementById('totalSupply').innerText = supply;
        console.log("totalSupply: "+ supply);

        var marketCap = (supply*price).toFixed(2);
        document.getElementById('marketCap').innerText = marketCap;
        console.log("marketCap: "+ marketCap);
    });


    hashToken.methods.latestUSDPrice().call().then(function (result) {
        var usdPrice = (result/(10**8)).toFixed(2);
        document.getElementById('latestUSDPrice').innerText = usdPrice;
        console.log("latestUSDPrice: " + usdPrice);

        hashToken.methods.currentDividendsRound().call().then(function (result) {
            var round = result;
            document.getElementById('currentDividendsRound').innerText = round;
            console.log("currentDividendsRound: " + round);

            hashToken.methods.secondsBetweenLastRounds().call().then(function (result) {
                var seconds = result;
                document.getElementById('secondsBetweenLastRounds').innerText = seconds;
                console.log("secondsBetweenLastRounds: " +  seconds);

                hashToken.methods.dividendsRounds(round).call().then(function (result) {

                    var perToken = result;
                    var perTokenUSD = (usdPrice*result/10**18).toFixed(2);


                    document.getElementById('perToken').innerText = perTokenUSD;
                    console.log("perToken: " +  perTokenUSD);

                    var yearly = (usdPrice*(result/seconds)*31536000/10**16/price).toFixed(2);

                    document.getElementById('yearly').innerText = yearly;
                    console.log("yearly: " +  yearly);
                });

            });

        });
    });

});

hashToken.methods.totalDividends().call().then(function (result) {
    document.getElementById('totalDividends').innerText = (result/(10**18)).toFixed(5);
    console.log("totalDividends: " +  (result/(10**18)).toFixed(5));
});


localWeb3.eth.getBalance(hashAddress).then(function (result) {
    document.getElementById('avaliableDividends').innerText = (result/(10**18)).toFixed(5);
    console.log("avaliableDividends: " + (result/(10**18)).toFixed(5));
});

hashToken.methods.daysFromStart().call().then(function (result) {
    document.getElementById('daysFromStart').innerText = result;
    console.log("daysFromStart: " + result);
});

*/
window.onload = function() {
    document.getElementById('daoLink').innerHTML = '<a target=_blank href = https://goerli.etherscan.io/address/' + daoAddress + '>'+daoAddress+'</a>';
};


