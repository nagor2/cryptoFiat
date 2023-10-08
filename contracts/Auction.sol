// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";
import "./ICDP.sol";

    struct auctionEntity {
        bool initialized;
        bool finalized;
        address lotToken;
        uint lotAmount;
        address paymentToken;
        uint256 paymentAmount;
        uint256 initTime;
        uint256 lastTimeUpdated;
        uint32 bestBidID;
    }

    struct Bid {
        address owner;
        uint32 auctionID;
        uint256 bidAmount;
        uint256 time;
        bool canceled;
    }

contract Auction is ReentrancyGuard{
    uint32 public auctionNum;
    uint32 public bidsNum;
    IERC20 coin;
    IDAO immutable dao;
    ICDP cdp;
    IERC20 rule;
    bool isCoinsBuyOutForStabilization;
    bool ruleBuyOut;

    mapping(uint32 => auctionEntity) public auctions;
    mapping (uint32 => Bid) public bids;

    event newAuction(uint32 indexed auctionID, uint256 lotAmount, address lotAddress, uint256 paymentAmount);
    event auctionFinished(uint32 indexed auctionID, uint256 lotAmount, uint32 bestBidID);
    event newBid(uint32 indexed auctionID, uint32 indexed bidID, uint256 bidAmount, address owner);
    event bidCanceled(uint256 indexed bidID);

    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    function renewContracts() public{
        cdp = ICDP(dao.addresses("cdp"));
        coin = IERC20(dao.addresses("stableCoin"));
        rule = IERC20(dao.addresses("rule"));
    }

    function initRuleBuyOut() nonReentrant external returns (uint32 auctionID){
        require (!ruleBuyOut, "Rule buyOut auction already exist");
        require ((rule.balanceOf(msg.sender)>=rule.totalSupply()/100*dao.params("minRuleTokensToInitVotingPercent")), "not enough rule balance");

        uint256 allowed = coin.allowance(dao.addresses("cdp"), address(this));
        require (allowed>0, "Can not transfer surplus from CDP");

        coin.transferFrom(dao.addresses("cdp"), address(this), allowed);

        auctionID = createNewAuction(dao.addresses("stableCoin"), allowed, dao.addresses("rule"), 0);
        ruleBuyOut = true;
        return auctionID;
    }

    function initCoinsBuyOutForStabilization(uint256 coinsAmountNeeded) nonReentrant external returns (uint32 auctionID){
        require (!isCoinsBuyOutForStabilization, "CoinsBuyOutForStabilization already exists and not finished");
        uint256 actualStabilizationFund = coin.balanceOf(address(cdp));
        uint256 preferableStabilizationFund = coin.totalSupply() * dao.params("stabilizationFundPercent")/100;
        require (actualStabilizationFund<preferableStabilizationFund, "not so low to init Rule emission");

        if (coinsAmountNeeded > preferableStabilizationFund - actualStabilizationFund)
            coinsAmountNeeded = preferableStabilizationFund - actualStabilizationFund;
        if (coinsAmountNeeded>dao.params("maxCoinsForStabilization"))
            coinsAmountNeeded = dao.params("maxCoinsForStabilization");

        auctionID = createNewAuction(dao.addresses("rule"), 0, dao.addresses("stableCoin"), coinsAmountNeeded);
        isCoinsBuyOutForStabilization = true;
        return auctionID;
    }

    function initCoinsBuyOut(uint128 collateral) nonReentrant external returns (uint32 auctionID){
        require (msg.sender == dao.addresses("cdp"), "Only CDP contract may invoke this method. Please, use claimMarginCall in CDP contract");
        auctionID = createNewAuction(dao.addresses("weth"), collateral, dao.addresses("stableCoin"),0);
        return auctionID;
    }

    function createNewAuction(address lotToken, uint256 lotAmount, address paymentToken, uint256 paymentAmount) internal returns (uint32 auctionID){
        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        a.initialized = true;
        a.finalized = false;
        a.lotToken = lotToken;
        a.lotAmount = lotAmount;
        a.paymentToken = paymentToken;
        a.paymentAmount = paymentAmount;
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidID = 0;

        emit newAuction(auctionID, lotAmount, lotToken, paymentAmount);
        return auctionID;
    }

    function makeBid(uint32 auctionID, uint256 bidAmount) nonReentrant external returns (uint32 bidID){
        auctionEntity storage a = auctions[auctionID];
        require(a.initialized&&!a.finalized, "auctionID is wrong or it is already finished");

        if (a.bestBidID !=0){
            Bid storage bestBid = bids[a.bestBidID];
            if (a.lotToken == dao.addresses("stableCoin") || a.lotToken == dao.addresses("weth"))
                require(bidAmount>0 && bestBid.bidAmount*(100+dao.params("minAuctionPriceMove"))/100<=bidAmount, "your bid is not high enough");
            if (a.lotToken == dao.addresses("rule"))
                require(bidAmount>0 && bestBid.bidAmount*(100-dao.params("minAuctionPriceMove"))/100>=bidAmount, "your bid is not low enough");
        }
        require(bidAmount>0, "your bid is not high enough");
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses("rule")){
            require(bidAmount<=rule.totalSupply()*dao.params("maxRuleEmissionPercent")/100, "too many rules for one emission");
            require(paymentToken.transferFrom(msg.sender, address(this), a.paymentAmount), "You should first approve stableCoins to auction contract address");
        }
        else
            require(paymentToken.transferFrom(msg.sender, address(this), bidAmount), "You should first approve bidAmount to auction contract address");

        bidID = ++bidsNum;
        Bid storage b = bids[bidID];
        b.owner = msg.sender;
        b.auctionID = auctionID;
        b.bidAmount = bidAmount;
        b.time = block.timestamp;
        b.canceled = false;

        a.bestBidID = bidID;
        a.lastTimeUpdated = block.timestamp;
        emit newBid(auctionID, bidID, bidAmount, b.owner);
        return bidID;
    }

    function improveBid(uint32 bidID, uint256 newBidAmount) nonReentrant external{
        Bid storage b = bids[bidID];
        require(b.owner == msg.sender, "You may improve only your personal bids");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized&&!a.finalized, "auctionID is wrong or it is already finished");
        Bid storage bestBid = bids[a.bestBidID];

        if (a.lotToken == dao.addresses("stableCoin") || a.lotToken == dao.addresses("weth"))
            require(newBidAmount>0 && bestBid.bidAmount*(100+dao.params("minAuctionPriceMove"))/100<=newBidAmount, "your bid is not high enough");
        if (a.lotToken == dao.addresses("rule"))
            require(newBidAmount>0 && bestBid.bidAmount*(100-dao.params("minAuctionPriceMove"))/100>=newBidAmount, "your bid is not high enough");

        IERC20 paymentToken = IERC20(address(a.paymentToken));

        if (a.lotToken == dao.addresses("stableCoin") || a.lotToken == dao.addresses("weth")){
            uint256 difference = newBidAmount-b.bidAmount;
            require(paymentToken.transferFrom(msg.sender, address(this), difference), "You should first approve payment to auction contract address");
        }

        b.bidAmount = newBidAmount;
        a.lastTimeUpdated = block.timestamp;
        a.bestBidID = bidID;
        emit newBid(b.auctionID, bidID, newBidAmount, b.owner);
    }

    function cancelBid(uint32 bidID) nonReentrant external{
        Bid storage b = bids[bidID];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidID != bidID, "You can not cancel a bid if it is a best one");
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.lotToken == dao.addresses("rule"))
            require(paymentToken.transfer(b.owner, a.paymentAmount), "we were not able to transfer your bid back");
        else
            require(paymentToken.transfer(b.owner, b.bidAmount), "we were not able to transfer your bid back");
        emit bidCanceled(bidID);
        b.canceled = true;
    }

    function claimToFinalizeAuction(uint32 auctionID) nonReentrant external returns (bool success){
        auctionEntity storage a = auctions[auctionID];
        if (a.lotToken == dao.addresses("weth"))
            require (msg.sender == dao.addresses("cdp"), "Only CDP contract may finish this auction. Please, use finishMarginCall method");

        require(a.initialized && !a.finalized, "the auction is finished or non-existent");
        require(block.timestamp-a.lastTimeUpdated>=dao.params("auctionTurnDuration"), "it is too early to finalize, wait a bit");
        require(a.bestBidID !=0 && a.initTime!=a.lastTimeUpdated, "there should be at least one bid");

        finalizeAuction(auctionID);
        return true;
    }

    function finalizeAuction(uint32 auctionID) internal {
        auctionEntity storage a = auctions[auctionID];
        Bid storage bestBid = bids[a.bestBidID];

        if (a.lotToken == dao.addresses("stableCoin")){
            require(IERC20(address(a.lotToken)).transfer(bestBid.owner, a.lotAmount), "lotToken transfer failed for some reason");
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.bidAmount), "paymentToken transfer failed for some reason");
            ruleBuyOut = false;
        }
        if (a.lotToken == dao.addresses("rule")){
            require(cdp.mintRule(bestBid.owner, bestBid.bidAmount), "could not mint rule");
            require(coin.transfer(dao.addresses("cdp"), a.paymentAmount), "could not transfer coins");
            isCoinsBuyOutForStabilization = false;
        }
        if (a.lotToken == dao.addresses("weth")){
            require(IERC20(address(a.lotToken)).transfer(bestBid.owner, a.lotAmount));
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.bidAmount));
        }
        a.finalized = true;
        emit auctionFinished(auctionID, a.lotAmount, a.bestBidID);
    }

    function isFinalized(uint32 auctionID) external view returns (bool finalized){
        return auctions[auctionID].finalized;
    }

    function getPaymentAmount(uint32 auctionID) external view returns (uint256){
        return auctions[auctionID].paymentAmount;
    }

    function getBestBidAmount(uint32 auctionID) external view returns (uint256){
        return bids[auctions[auctionID].bestBidID].bidAmount;
    }
}
