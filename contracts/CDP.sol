pragma solidity ^0.4.0;

contract stableCoin {
    function totalSupply() public view returns (uint supply);
    function balanceOf(address who) public view returns (uint value);
    function allowance(address owner, address spender) public view returns (uint remaining);

    function transfer(address to, uint value) public returns (bool ok);
    function transferFrom(address from, address to, uint value) public returns (bool ok);
    function approve(address spender, uint value) public returns (bool ok);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract INTDAO {
    function interestRate() public view returns (uint);
    function liquidationFee() public view returns (uint);
    function depositRate() public view returns (uint);
    function stabilityFundPercent() public view returns (uint);

    function interestTokenAddress() public view returns (address);
    function auctionAddress() public view returns (address);
    function oracleAddress() public view returns (address);
    function stableCoinAddress() public view returns (address);
}

contract interestToken {
    function mintForCollateral() public returns (bool success);
    function burnFromCollateral() public returns (bool success);
}

contract Oracle {
    function getPrice(string symbol) public view returns (uint256);
}

//previous Interest price is saved during INT auction - no need or make auction longer in time
//started at 11.30 25/05/2020

contract CDP {
    uint posId;

    address INTDAOaddress = address(0);
    INTDAO dao;
    Oracle oracle;

    address auctionAddress;

    mapping(uint => Position) public positions;
    mapping (uint => Bid) public bids;
    mapping (address => uint) allowedToMint;

    struct Position {
        bool onLiquidation;
        bool liquidated;
        address owner;
        uint stableCoins_minted;
        uint ethAmountLocked;
        uint feeGenerated;
        uint timeOpened;
        uint lastTimeUpdated;
        uint feeRate;
    }

    struct Bid {
        address owner;
        uint posID;
        uint stableCoins;
    }

    event liquidateColleteral(uint posID, uint liquidateColleteral, uint startPrice);
    event overplusAuction(uint stableCoinsSold);

    constructor(address _INTDAOaddress) public {
        INTDAOaddress = _INTDAOaddress;
        dao = INTDAO(INTDAOaddress);
        oracle = Oracle(dao.oracleAddress());
    }

    function getAllowedToMint(address minter) public view returns (uint amount){
        return allowedToMint[minter];
    }

    function openCDP (uint StableCoinsToMint) payable returns (bool success){
        require(msg.value > 1/10,'Too small value of Colleteral');
        bool success = false;
        return success;
        //uint maxAmount =

    }

    function closeCDP (uint posID) { //shows minimum amount of INT you have to own
        //sendEtherToOwner
    }

    function amountOfINTtoHave(uint posID);

    function updateCDP(uint posID, uint newStableCoinsAmount) payable returns (bool success){
        ethAmountLocked += msg.value;
    }

    function liquidateColleteral (uint posID) {

        //Add liquidationFee to startPrice;
        //Add interestFee to startPrice;
        //open Auction in the same contract
        //if (stableCoinContract.balanceOf(address(this))>stabilityFundPercent*stableCoinContract.totalSupply()/100)
        /*{
            createAuction() StableCoin/INT;
            emit overplusAuction(uint stableCoinsSold);
        }
        */
        //INT mint for auction
    }

    function withdrawEther (uint posID, uint etherToWithdraw) {
        //open Auction in the same contract
    }

    function makeBid(uint posID, uint stableCoins) {
        //require (positions[posID].onLiquidation = true, 'Position is not on liquidation');
        //require (positions[posID].liquidated != true, 'Position already liquidated');

    }

    function finishInterestAuction (uint InterestAuctionID) public {
        //require last bid 5 min.
        // until finalized recieve bids
        //allowedToMint[bidOwner] += bidAmount;
        //call recieveTokens()

    }

    function recieveInterestAfterAuction() public {
        INT.mintForCDP();
    }

    function groundAllowedToMint() public {
        allowedToMint[msg.sender] = 0;
    }
}
