// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./stableCoin.sol";

//started at 11.30 25/05/2020

contract Auction {
    uint256 auctionNum;
    stableCoin coin;
    INTDAO dao;


    mapping(uint256 => auctionEntity) public auctions;
    mapping (uint => Bid) public bids;

    event buyOutInit (uint256 auctionID, uint256 stableCoinAmount);
    event buyOutFinished (uint256 auctionID, uint256 stableCoinAmount, uint256 ruleBurned);

    struct auctionEntity {
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint bestBidId;
        uint initTime;
        uint lastTimeUpdated;
    }

    struct Bid {
        address owner;
        uint256 auctionID;
        uint256 bidAmount;
        uint256 time;
    }

    event liquidateColleteral(uint posID, uint liquidateColleteral, uint startPrice);

    constructor(address _INTDAOaddress){
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("auction", address(this));
    }

    function initRuleBuyOut() public returns (uint256 auctionID){
        auctionID = auctionNum++;
        auctionEntity storage a = auctions[auctionID];

        coin = stableCoin(payable(dao.addresses('stableCoin')));

        a.finalized = false;
        a.lotToken = dao.addresses('stableCoin');
        a.lotAmount = coin.balanceOf(address(this));
        a.paymentToken = dao.addresses('rule');
        a.bestBidId = 0;
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;

        emit buyOutInit (auctionID, a.lotAmount);
        return auctionID;
    }
}
