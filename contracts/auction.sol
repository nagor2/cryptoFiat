pragma solidity ^0.4.0;

contract Oracle {
    function ethPrice() public view returns (uint);
    function intPrice() public view returns (uint);
}

//started at 11.30 25/05/2020

contract auction {
    uint auctionID;

    mapping(uint => auctionEntity) public auctions;
    mapping (uint => Bid) public bids;

    struct auctionEntity {
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint bestBidId;
        uint lastTimeUpdated;
    }

    struct Bid {
        address owner;
        uint auctionID;
        uint bidAmount;
        uint time;
    }

    event liquidateColleteral(uint posID, uint liquidateColleteral, uint startPrice);


    constructor() public {
    }


    modifier onlyAuthor{
        require(msg.sender == author, "This function is for author only!");
        _;
    }



    function openCDP (uint StableCoinsToMint) payable returns (bool success){
        require(msg.value > 1.,'Too small value of Colleteral');
        return false;
    }

    function closeCDP (uint posID) { //shows minimum amount of INT you have to own
        //sendEtherToOwner
    }

    function updateCDP(uint posID, uint newStableCoinsAmount) payable returns (bool success){

        ethAmountLocked += msg.value;

        return false;
    }

    function liquidateColleteral (uint posID) {

        //Add liquidationFee to startPrice;
        //Add interestFee to startPrice;
        //open Auction in the same contract
        //
    }

    function withdrawEther (uint posID, uint etherToWithdraw) {
        //open Auction in the same contract
    }

    function makeBid(uint posID, uint stableCoins) {
        //require (positions[posID].onLiquidation = true, 'Position is not on liquidation');
        //require (positions[posID].liquidated != true, 'Position already liquidated');

    }

    function finishAuction (uint posID) {
        //require last bid 5 min.

    }

}
