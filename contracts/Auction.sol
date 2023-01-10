// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";

    struct auctionEntity {
        bool initialized;
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint initTime;
        uint lastTimeUpdated;
        uint bestBidId;
    }

contract Auction {
    uint256 auctionNum;
    uint256 bidsNum;
    stableCoin coin;
    INTDAO dao;
    CDP cdp;

    mapping(uint256 => auctionEntity) public auctions;
    mapping (uint => Bid) public bids;

    event buyOutInit (uint256 auctionID, uint256 lotAmount, address lotAddress);
    event buyOutFinished (uint256 auctionID, uint256 stableCoinAmount, uint256 ruleBurned);

    struct Bid {
        address owner;
        uint256 auctionID;
        uint256 bidAmount;
        uint256 time;
        bool canceled;
    }

    event liquidateCollateral(uint posID, uint liquidateColleteral, uint startPrice);

    constructor(address _INTDAOaddress){
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("auction", address(this));
        cdp = CDP(dao.addresses('cdp'));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(dao.addresses('cdp'));
    }

    function initRuleBuyOut(uint256 stableCoinAmount) public returns (uint256 auctionID){
        uint256 allowed = coin.allowance(dao.addresses('cdp'), address(this));
        require (coin.transferFrom(dao.addresses('cdp'), address(this), allowed));
        auctionID = auctionNum++;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('stableCoin');
        a.lotAmount = allowed;
        a.paymentToken = dao.addresses('rule');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;

        emit buyOutInit (auctionID, a.lotAmount, a.lotToken);
        return auctionID;
    }

    function makeBid(uint256 auctionId, uint256 bidAmount) public{
        auctionEntity storage a = auctions[auctionId];
        require(a.initialized&&!a.finalized, "auctionId is wrong or it is already finished");
        Bid storage bestBid = bids[a.bestBidId];
        require(a.bestBidId==0||bestBid.bidAmount<bidAmount, "your bid is not higher than the best bid");

        ERC20 paymentToken = ERC20(address(a.paymentToken));
        require(paymentToken.transferFrom(msg.sender, address(this), bidAmount), "You should first approve bidAmount to auction contract address");

        uint256 bidId = ++bidsNum;
        Bid storage b = bids[bidId];
        b.owner = msg.sender;
        b.auctionID = auctionId;
        b.bidAmount = bidAmount;
        b.time = block.timestamp;
        b.canceled = false;

        a.bestBidId = bidId;
        a.lastTimeUpdated = block.timestamp;
    }

    function cancelBid(uint256 bidId) public{
        Bid storage b = bids[bidId];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidId!=bidId, "You can not cancel a bid if it is a highest one");
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        require(paymentToken.transfer(msg.sender, b.bidAmount), "we were not able to transfer your bid back");
        b.canceled = true;
    }

    function claimToFinalizeAuction(uint256 auctionId) public{
        auctionEntity storage a = auctions[auctionId];
        require(a.initialized && !a.finalized, "the auction is finished or non-existent");
        require(block.timestamp-a.lastTimeUpdated>=dao.params('auctionTurnDuration'), "it is too early to finalize, wait a bit");
        require(a.bestBidId!=0 && a.initTime!=a.lastTimeUpdated, "there should be at least one bid");
        Bid storage bestBid = bids[a.bestBidId];
        ERC20 lotToken = ERC20(address(a.lotToken));
        require(lotToken.transfer(bestBid.owner, a.lotAmount));
        a.finalized = true;
        //что делать с полученными активами?

        //require(cdp.finalizeAuction(auctionId), "Can not finilize auction, CDP contract failiar");
    }

    function finalizeAuction (uint256 auctionId) public returns (bool success){

        auctionEntity storage a = auctions[auctionId];
        require(a.finalized, "Auction is not finished yet");
        if (a.paymentToken == dao.addresses('stableCoin')){

            return true;
        }
        if (a.paymentToken == dao.addresses('WETH')) {
            //
            return true;
        }
        return false;
    }
}
