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
        uint256 initTime;
        uint256 lastTimeUpdated;
        uint256 bestBidId;
    }

    struct Bid {
        address owner;
        uint256 auctionID;
        uint256 bidAmount;
        uint256 time;
        bool canceled;
    }

contract Auction {
    uint256 auctionNum;
    uint256 bidsNum;
    stableCoin coin;
    INTDAO dao;
    CDP cdp;

    mapping(uint256 => auctionEntity) public auctions;
    mapping (uint256 => Bid) public bids;

    event buyOutInit(uint256 auctionID, uint256 lotAmount, address lotAddress);
    event buyOutFinished(uint256 auctionID, uint256 lotAmount, uint256 bestBid);
    event newBid(uint256 auctionID, uint256 bidAmount);
    event bidCanceled(uint256 bidId);

    event liquidateCollateral(uint256 auctionID, uint256 posID, uint256 liquidateColleteral);

    constructor(address _INTDAOaddress){
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("auction", payable(address(this)));
        cdp = CDP(dao.addresses('cdp'));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(dao.addresses('cdp'));
    }

    function initRuleBuyOut() public returns (uint256 auctionID){
        uint256 allowed = coin.allowance(dao.addresses('cdp'), address(this));
        require (coin.transferFrom(dao.addresses('cdp'), address(this), allowed), "Can not transfer surplus from CDP");
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

    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) public returns (uint256 auctionID){
        uint256 actualStabilizationFund = coin.balanceOf(address(cdp));
        uint256 preferableStabilizationFund = coin.totalSupply() * dao.params("stabilizationFundPercent")/100;

        require (actualStabilizationFund<preferableStabilizationFund/5, "not so low to init Rule emission");
        if (coinsAmountNeeded > preferableStabilizationFund - actualStabilizationFund)
            coinsAmountNeeded = preferableStabilizationFund - actualStabilizationFund;

        auctionID = auctionNum++;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('rule');
        a.paymentToken = dao.addresses('stableCoin');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;
        emit buyOutInit(auctionID, 0, a.lotToken);
        return auctionID;
    }

    function initCoinsBuyOut(uint256 posID) public returns (uint256 auctionID){
        require(cdp.isOnLiquidation(posID), "position is not on liquidation");
        ERC20 weth = ERC20(dao.addresses('weth'));
        uint256 wethLocked = cdp.wethLocked(posID);
        require(weth.transferFrom(dao.addresses('cdp'), address(this), wethLocked), "could not transfer weth for some reason");

        auctionID = auctionNum++;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = dao.addresses('weth');
        a.lotAmount = wethLocked;
        a.paymentToken = dao.addresses('stableCoin');
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidId = 0;

        emit liquidateCollateral(auctionID, posID, wethLocked);
        return auctionID;
    }

    function makeBid(uint256 auctionId, uint256 bidAmount) public{
        auctionEntity storage a = auctions[auctionId];
        require(a.initialized&&!a.finalized, "auctionId is wrong or it is already finished");

        if (a.bestBidId!=0){
            Bid storage bestBid = bids[a.bestBidId];
            if (a.lotToken == dao.addresses('stableCoin') || a.lotToken == dao.addresses('weth'))
                require(bidAmount>0 && bestBid.bidAmount*(100+dao.params('minAuctionPriceMove'))/100<bidAmount, "your bid is not high enough");
            if (a.lotToken == dao.addresses('rule'))
                require(bidAmount>0 && bestBid.bidAmount*(100+dao.params('minAuctionPriceMove'))/100>bidAmount, "your bid is not high enough");
        }
        require(bidAmount>0, "your bid is not high enough");
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
        emit newBid(auctionId, bidAmount);
    }

    function cancelBid(uint256 bidId) public{
        Bid storage b = bids[bidId];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidId!=bidId, "You can not cancel a bid if it is a best one");
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        require(paymentToken.transfer(msg.sender, b.bidAmount), "we were not able to transfer your bid back");
        emit bidCanceled(bidId);
        b.canceled = true;
    }

    function claimToFinalizeAuction(uint256 auctionId) public returns (bool success){
        auctionEntity storage a = auctions[auctionId];
        require(a.initialized && !a.finalized, "the auction is finished or non-existent");
        require(block.timestamp-a.lastTimeUpdated>=dao.params('auctionTurnDuration'), "it is too early to finalize, wait a bit");
        require(a.bestBidId!=0 && a.initTime!=a.lastTimeUpdated, "there should be at least one bid");
        Bid storage bestBid = bids[a.bestBidId];
        ERC20 lotToken = ERC20(address(a.lotToken));
        ERC20 paymentToken = ERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses('stableCoin') && a.paymentToken == dao.addresses('rule')) {
            require(lotToken.transfer(bestBid.owner, a.lotAmount));
            require(paymentToken.transfer(dao.addresses('cdp'), bestBid.bidAmount));
            emit buyOutFinished(auctionId, a.lotAmount, bestBid.bidAmount);
        }
        if (a.lotToken == dao.addresses('rule') && a.paymentToken == dao.addresses('stableCoin')){
            require(cdp.mintRule(bestBid.owner, bestBid.bidAmount));
            require(coin.transfer(dao.addresses('cdp'), a.lotAmount));
        }
        if (a.lotToken == dao.addresses('weth') && a.paymentToken == dao.addresses('stableCoin')){
            require(lotToken.transfer(bestBid.owner, a.lotAmount));
            require(paymentToken.transfer(dao.addresses('cdp'), bestBid.bidAmount));
            emit buyOutFinished(auctionId, a.lotAmount, bestBid.bidAmount);
        }
        a.finalized = true;
        return true;
    }
}
