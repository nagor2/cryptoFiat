// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
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

/// @title A contract for different types of auctions
contract Auction is ReentrancyGuard{
    /// @notice Auctions counter
    uint32 public auctionNum;
    /// @notice Bids counter
    uint32 public bidsNum;

    /// @notice Stablecoin interface
    IERC20 coin;

    /// @notice DAO contract interface
    IDAO immutable dao;
    /// @notice CDP contract interface
    ICDP cdp;
    /// @notice Governance token interface
    IERC20 rule;
    /// @notice Flag, that shows if there is an active auction to top up stabilization fund.
    bool isCoinsBuyOutForStabilization;
    /// @notice Flag, that shows if there is an active auction for governance tokens buyout.
    bool ruleBuyOut;
    /// @notice All the existing auctions are stored in this mapping.
    mapping(uint32 => auctionEntity) public auctions;
    /// @notice All the existing bids are stored in this mapping.
    mapping (uint32 => Bid) public bids;

    /// @notice This event is fired when a new auction is created. Follow this events to participate in auctions.
    /// @param auctionID The id of new auction.
    /// @param lotAmount The amount of certain asset, which the winner will get.
    /// @param lotAddress Token address of the asset.
    /// @param paymentAmount The minimum amount of payment for the lot the auction should receive. It is a non-zero value only
    /// if we need to top up the stabilization fund of the system with certain amount of stablecoins.
    /// @dev You can catch this event to participate in auction automatically.
    event newAuction(uint32 indexed auctionID, uint256 lotAmount, address lotAddress, uint256 paymentAmount);

    /// @notice This event is fired when a new auction is finished.
    /// @param auctionID The id of a finished auction.
    /// @param lotAmount The amount of certain asset, which the winner will receive.
    /// @param bestBidID The id of best bid.
    event auctionFinished(uint32 indexed auctionID, uint256 lotAmount, uint32 bestBidID);

    /// @notice This event is fired when a new bid is created or bid is improved. Follow this events to improve your bids.
    /// @param auctionID The id of new auction.
    /// @param bidID The id of the bid.
    /// @param bidAmount Amount of a bid.
    /// @param owner Bidder address.
    event newBid(uint32 indexed auctionID, uint32 indexed bidID, uint256 bidAmount, address owner);

    /// @notice This event is fired when a new bid is canceled. You can not cancel your bid, if your bid is the best one for now.
    /// @param bidID The id of the bid.
    event bidCanceled(uint256 indexed bidID);

    /// @notice Constructor for auction contract.
    /// @param _INTDAOaddress - the address of main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice This method is used to reinit needed interfaces when the addresses of contracts to use are changed by voting or to init interfaces just after deploy.
    function renewContracts() external{
        cdp = ICDP(dao.addresses("cdp"));
        coin = IERC20(dao.addresses("stableCoin"));
        rule = IERC20(dao.addresses("rule"));
    }

    /// @notice This method is used when stabilization fund on CDP contract exceeds its limit for Rule buy out.
    /// @return auctionID New auction ID.
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

    /// @notice Inits stablecoins buyout for stabilization fund, if it is low. The stabilization fund should always be a certain
    /// percent from stablecoin total supply (stabilizationFundPercent parameter in DAO contract). Maximum stablecoins per one auction is regulated by maxCoinsForStabilization parameter in DAO contract.
    /// @param coinsAmountNeeded Needed amount of stablecoins.
    /// @return auctionID New auction ID.
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

    /// @notice Inits auction if margin-call occurred and system needs to sell the collateral.
    /// @param collateral Ether collateral amount.
    /// @return auctionID New auction ID.
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

    /// @notice Use this method to make a new bid. Make sure that you allowed needed amount of bid for Auction contract address.
    /// minAuctionPriceMove percent is the param from DAO contract, which means that you have to improve the previous best bid on a certain percent.
    /// @param auctionID The ID of auction to participate in.
    /// @param bidAmount The amount of bid user wants to make.
    /// @return bidID New bid ID.
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

    /// @notice Use this method to improve your own bid.
    /// @param bidID The ID of your bid.
    /// @param newBidAmount New bid amount.
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

    /// @notice Use this method to cancel your own bid. Notice, that you can not cancel your bid if it is the best one for now.
    /// @param bidID The ID of your bid.
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

    /// @notice If there is no more bids made and the timeout has expired, you can claim to finalize the auction.
    /// Notice, that when the collateral is sold through auction, you have to use another method - finishMarginCall from CDP contract.
    /// @param auctionID The ID of the auction to finalize.
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

    /// @notice This method just shows, whether a certain auction is finished or not.
    /// @param auctionID The ID of the auction.
    function isFinalized(uint32 auctionID) external view returns (bool finalized){
        return auctions[auctionID].finalized;
    }

    /// @notice This method shows paymentAmount of an auction. It is mainly used when collateral is sold.
    /// @param auctionID The ID of the auction.
    function getPaymentAmount(uint32 auctionID) external view returns (uint256){
        return auctions[auctionID].paymentAmount;
    }

    /// @notice This method shows current best bid amount of an auction.
    /// @param auctionID The ID of the auction.
    function getBestBidAmount(uint32 auctionID) external view returns (uint256){
        return bids[auctions[auctionID].bestBidID].bidAmount;
    }
}
