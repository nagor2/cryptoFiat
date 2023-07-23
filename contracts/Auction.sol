// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";
import "./Rule.sol";

    struct auctionEntity {
        bool initialized;
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint256 paymentAmount;
        uint256 initTime;
        uint256 lastTimeUpdated;
        uint256 bestBidId;
        bool isMarginCall;
    }

    struct Bid {
        address owner;
        uint256 auctionID;
        uint256 bidAmount;
        uint256 time;
        bool canceled;
    }

contract Auction {
    uint256 public auctionNum;
    uint256 public bidsNum;
    stableCoin coin;
    INTDAO dao;
    CDP cdp;
    Rule rule;
    bool isCoinsBuyOutForStabilization;
    bool ruleBuyOut;

    mapping(uint256 => auctionEntity) public auctions;
    mapping (uint256 => Bid) public bids;

    event buyOutInit(uint256 auctionID, uint256 lotAmount, address lotAddress);
    event buyOutFinished(uint256 auctionID, uint256 lotAmount, uint256 bestBid);
    event newBid(uint256 auctionID, uint256 bidId, uint256 bidAmount, address owner);
    event bidCanceled(uint256 bidId);

    event liquidateCollateral(uint256 auctionID, uint256 posID, uint256 liquidateColleteral);

    constructor(address payable _INTDAOaddress){
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("auction", payable(address(this)));
        cdp = CDP(dao.addresses('cdp'));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        rule = Rule(payable(dao.addresses('rule')));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(dao.addresses('cdp'));
        rule = Rule(payable(dao.addresses('rule')));
    }

    function initRuleBuyOut() public returns (uint256 auctionID){
        require (!ruleBuyOut, "Rule buyOut auction already exist");
        uint256 allowed = coin.allowance(dao.addresses('cdp'), address(this));
        require (coin.transferFrom(dao.addresses('cdp'), address(this), allowed), "Can not transfer surplus from CDP");
        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('stableCoin');
        a.lotAmount = allowed;
        a.paymentToken = dao.addresses('rule');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;
        ruleBuyOut = true;

        emit buyOutInit(auctionID, a.lotAmount, a.lotToken);
        return auctionID;
    }

    function getBestBidAmount (uint256 auctionID) public view returns (uint256){
        auctionEntity storage a = auctions[auctionID];
        if (a.bestBidId >0) {
            Bid storage b = bids[a.bestBidId];
            return b.bidAmount;
        }
        else return 0;
    }

    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) external returns (uint256 auctionID){
        require (!isCoinsBuyOutForStabilization, "CoinsBuyOutForStabilization already exists and not finished");
        uint256 actualStabilizationFund = coin.balanceOf(address(cdp));
        uint256 preferableStabilizationFund = coin.totalSupply() * dao.params("stabilizationFundPercent")/100;
        require (actualStabilizationFund<preferableStabilizationFund, "not so low to init Rule emission");

        if (coinsAmountNeeded > preferableStabilizationFund - actualStabilizationFund)
            coinsAmountNeeded = preferableStabilizationFund - actualStabilizationFund;
        if (coinsAmountNeeded>dao.params("maxCoinsForStabilization"))
            coinsAmountNeeded = dao.params("maxCoinsForStabilization");

        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        a.paymentAmount = coinsAmountNeeded;
        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('rule');
        a.paymentToken = dao.addresses('stableCoin');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;
        isCoinsBuyOutForStabilization = true;

        emit buyOutInit(auctionID, 0, a.lotToken);
        return auctionID;
    }

    function initCoinsBuyOut(uint256 posID, uint256 collateral) external returns (uint256 auctionID){
        require (msg.sender == dao.addresses('cdp'), "Only CDP contract may invoke this method. Please, use startCoinsBuyOut in CDP contract");
        ERC20 weth = ERC20(dao.addresses('weth'));
        require(weth.transferFrom(dao.addresses('cdp'), address(this), collateral), "could not transfer weth for some reason");

        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('weth');
        a.lotAmount = collateral;
        a.paymentToken = dao.addresses('stableCoin');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;
        a.isMarginCall = true;

        emit liquidateCollateral(auctionID, posID, 0);
        return auctionID;
    }

    function makeBid(uint256 auctionId, uint256 bidAmount) public{
        auctionEntity storage a = auctions[auctionId];
        require(a.initialized&&!a.finalized, "auctionId is wrong or it is already finished");

        if (a.bestBidId!=0){
            Bid storage bestBid = bids[a.bestBidId];
            if (a.lotToken == dao.addresses('stableCoin') || a.lotToken == dao.addresses('weth'))
                require(bidAmount>0 && bestBid.bidAmount*(100+dao.params('minAuctionPriceMove'))/100<=bidAmount, "your bid is not high enough");
            if (a.lotToken == dao.addresses('rule'))
                require(bidAmount>0 && bestBid.bidAmount*(100-dao.params('minAuctionPriceMove'))/100>=bidAmount, "your bid is not low enough");
        }
        require(bidAmount>0, "your bid is not high enough");
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses('rule')){
            require(bidAmount<=rule.totalSupply()*dao.params('maxRuleEmissionPercent')/100, "too many rules for one emission");
            require(paymentToken.transferFrom(msg.sender, address(this), a.paymentAmount), "You should first approve stableCoins to auction contract address");
        }
        else
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
        emit newBid(auctionId, bidId, bidAmount, b.owner);
    }

    function improveBid(uint256 bidId, uint256 newBidAmount) public{
        Bid storage b = bids[bidId];
        require(b.owner == msg.sender, "You may improve only your personal bids");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized&&!a.finalized, "auctionId is wrong or it is already finished");
        Bid storage bestBid = bids[a.bestBidId];

        if (a.lotToken == dao.addresses('stableCoin') || a.lotToken == dao.addresses('weth'))
            require(newBidAmount>0 && bestBid.bidAmount*(100+dao.params('minAuctionPriceMove'))/100<=newBidAmount, "your bid is not high enough");
        if (a.lotToken == dao.addresses('rule'))
            require(newBidAmount>0 && bestBid.bidAmount*(100-dao.params('minAuctionPriceMove'))/100>=newBidAmount, "your bid is not high enough");

        ERC20 paymentToken = ERC20(address(a.paymentToken));

        if (a.lotToken == dao.addresses('stableCoin') || a.lotToken == dao.addresses('weth')){
            uint256 difference = newBidAmount-b.bidAmount;
            require(paymentToken.transferFrom(msg.sender, address(this), difference), "You should first approve payment to auction contract address");
        }

        b.bidAmount = newBidAmount;
        a.lastTimeUpdated = block.timestamp;
        a.bestBidId = bidId;
        emit newBid(b.auctionID, bidId, newBidAmount, b.owner);
    }

    function cancelBid(uint256 bidId) public{
        Bid storage b = bids[bidId];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidId!=bidId, "You can not cancel a bid if it is a best one");
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses('rule') && a.paymentToken == dao.addresses('stableCoin'))
            require(paymentToken.transfer(b.owner, a.paymentAmount), "we were not able to transfer your bid back");
        else
            require(paymentToken.transfer(b.owner, b.bidAmount), "we were not able to transfer your bid back");
        emit bidCanceled(bidId);
        b.canceled = true;
    }

    function isFinalized(uint256 auctionId) public view returns (bool finalized){
        return auctions[auctionId].finalized;
    }

    function claimToFinalizeAuction(uint256 auctionId) public returns (bool success){
        auctionEntity storage a = auctions[auctionId];
        if (a.isMarginCall)
            require (msg.sender == dao.addresses('cdp'), "Only CDP contract may finish this auction. Please, use finishMarginCall method.");

        require(a.initialized && !a.finalized, "the auction is finished or non-existent");
        require(block.timestamp-a.lastTimeUpdated>=dao.params('auctionTurnDuration'), "it is too early to finalize, wait a bit");
        require(a.bestBidId!=0 && a.initTime!=a.lastTimeUpdated, "there should be at least one bid");
        Bid storage bestBid = bids[a.bestBidId];
        ERC20 lotToken = ERC20(address(a.lotToken));
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses('stableCoin') && a.paymentToken == dao.addresses('rule')) {
            require(lotToken.transfer(bestBid.owner, a.lotAmount));
            require(paymentToken.transfer(dao.addresses('cdp'), bestBid.bidAmount));
            ruleBuyOut = false;
            emit buyOutFinished(auctionId, a.lotAmount, bestBid.bidAmount);
        }
        if (a.lotToken == dao.addresses('rule') && a.paymentToken == dao.addresses('stableCoin')){
            require(cdp.mintRule(bestBid.owner, bestBid.bidAmount), "could not mint rule");
            require(coin.transfer(dao.addresses('cdp'), a.paymentAmount), "could not transfer coins");
            isCoinsBuyOutForStabilization = false;
        }
        if (a.lotToken == dao.addresses('weth') && a.paymentToken == dao.addresses('stableCoin')){
            require(lotToken.transfer(bestBid.owner, a.lotAmount));
            require(paymentToken.transfer(dao.addresses('cdp'), bestBid.bidAmount));
            emit buyOutFinished(auctionId, a.lotAmount, bestBid.bidAmount);
        }
        a.finalized = true;
        return true;
    }

    receive() external payable {
        dao.addresses('oracle').transfer(address(this).balance);
    }
}
