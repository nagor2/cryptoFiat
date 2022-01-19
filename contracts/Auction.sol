// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;


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

    constructor() {

    }
}
