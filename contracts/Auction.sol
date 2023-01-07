// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./stableCoin.sol";

interface ERC20 {
    function totalSupply() external view returns (uint supply);
    function balanceOf(address who) external view returns (uint value);
    function allowance(address owner, address spender) external view returns (uint remaining);

    function transfer(address to, uint value) external returns (bool ok);
    function transferFrom(address from, address to, uint value) external returns (bool ok);
    function approve(address spender, uint value) external returns (bool ok);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract Auction {
    uint256 auctionNum;
    uint256 bidsNum;
    stableCoin coin;
    INTDAO dao;

    mapping(uint256 => auctionEntity) public auctions;
    mapping (uint => Bid) public bids;

    event buyOutInit (uint256 auctionID, uint256 lotAmount, address lotAddress);
    event buyOutFinished (uint256 auctionID, uint256 stableCoinAmount, uint256 ruleBurned);

    struct auctionEntity {
        bool initialized;
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint bestBidId;
        uint initTime;
        uint lastTimeUpdated;
        uint bestBidId;
    }

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
    }

    function initRuleBuyOut(uint256 stableCoinAmount) public returns (uint256 auctionID){
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        require transferFrom();
        require(coin.balanceOf(address(this))>=dao.params('minAuctionBalanceToInitBuyOut'), "Should be enough stableCoins to initAuction");
        auctionID = auctionNum++;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('stableCoin');
        a.lotAmount = //coin.balanceOf(address(this));
        a.paymentToken = dao.addresses('rule');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;

        emit buyOutInit (auctionID, a.lotAmount, a.lotToken);
        return auctionID;
    }

    function makeBid(uint256 auctionId, uint256 bidAmount) public{
        auctionEntity storage a = auctions[auctionID];
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

    function cancelBid(uint256 bidId){
        Bid storage b = bids[bidId];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidId!=bidId, "You can not cancel a bid if it is a highest one");
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        require(paymentToken.transfer(msg.sender, bidAmount), "we were not able to transfer your bid back");
        b.canceled = true;
    }

    function claimToFinalizeAuction(uint256 auctionId) public{
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized && !a.finalized, "the auction is finished or non-existent");
        require(block.timestamp-a.lastTimeUpdated>=dao.params('auctionDuration'), "it is too early to finalize, wait a bit");
        require(a.bestBidId!=0 && a.initTime!=a.lastTimeUpdated, "there should be at least one bid");
        Bid storage bestBid = bids[a.bestBidId];
        ERC20 lotToken = ERC20(address(a.lotToken));
        require(lotToken.transfer(bestBid.owner, a.lotAmount));
        a.finalized = true;
        //что делать с полученными активами?
    }
}
