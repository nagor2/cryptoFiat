// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";
import "./ICDP.sol";

    struct auctionEntity {
        uint8 auctionType;  // 1 - Rule buyout, 2 -  stablecoins buyout, 3 - collateral liquidation
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

/// @title A Contract for Different Types of Auctions  asdfasdf
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
    /// @notice Flag indicating that there is an active auction to top up the stabilization fund.
    bool isCoinsBuyOutForStabilization;
    /// @notice Flag indicating that there is an active auction for governance token buyout.
    bool ruleBuyOut;
    /// @notice Mapping storing all existing auctions.
    mapping(uint32 => auctionEntity) public auctions;
    /// @notice Mapping storing all existing bids.
    mapping (uint32 => Bid) public bids;

    /// @notice This event is emitted when a new auction is created. Follow this event to participate in auctions.
    /// @param auctionType Type of the auction 1 - Rule buyout, 2 - stablecoins buyout, 3 - collateral liquidation
    /// @param auctionID The ID of the new auction.
    /// @param lotAmount The amount of the asset that the winner will receive.
    /// @param lotAddress Token address of the asset.
    /// @param paymentAmount The minimum amount of payment required for the lot.
    /// This is non-zero only if topping up the stabilization fund with a certain amount of stablecoins.
    /// @dev You can catch this event to participate in auction automatically.
    event newAuction(uint8 auctionType, uint32 indexed auctionID, uint256 lotAmount, address lotAddress, uint256 paymentAmount);

    /// @notice This event is emitted when an auction finishes.
    /// @param auctionID The ID of the finished auction.
    /// @param lotAmount The amount of the asset that the winner will receive.
    /// @param bestBidID The ID of the best bid.
    event auctionFinished(uint32 indexed auctionID, uint256 lotAmount, uint32 bestBidID);

    /// @notice This event is emitted when a new bid is created or an existing bid is improved. Follow this event to improve your bids.
    /// @param auctionID The ID of the auction.
    /// @param bidID The ID of the bid.
    /// @param bidAmount The amount of the bid.
    /// @param owner Address of the bidder.
    event newBid(uint32 indexed auctionID, uint32 indexed bidID, uint256 bidAmount, address owner);

    /// @notice This event is emitted when a bid is canceled. You cannot cancel your bid if it is currently the best one.
    /// @param bidID The ID of the bid.
    event bidCanceled(uint256 indexed bidID);

    /// @notice Constructor for the auction contract.
    /// @param _INTDAOaddress The address of the main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice Reinitialize the needed interfaces when the addresses of contracts are changed by voting or initialize interfaces after deployment.
    function renewContracts() external{
        cdp = ICDP(dao.addresses("cdp"));
        coin = IERC20(dao.addresses("stableCoin"));
        rule = IERC20(dao.addresses("rule"));
    }

    /// @notice Initiates an auction for Rule buyout when the stabilization fund on the CDP contract exceeds its limit.
    /// @return auctionID New auction ID.
    function initRuleBuyOut() nonReentrant external returns (uint32 auctionID){
        require (!ruleBuyOut, "Rule buyOut auction already exist");
        require ((rule.balanceOf(msg.sender)>=rule.totalSupply()/100*dao.params("minRuleTokensToInitVotingPercent")), "not enough rule balance");

        uint256 allowed = coin.allowance(dao.addresses("cdp"), address(this));
        require (allowed>0, "Can not transfer surplus from CDP");

        require (coin.transferFrom(dao.addresses("cdp"), address(this), allowed), "could not transfer coins for some reason");

        auctionID = createNewAuction(1, allowed, 0);
        ruleBuyOut = true;
    }

    /// @notice Initiates a stablecoin buyout for the stabilization fund if it is low. The stabilization fund should always be a certain percentage of the total stablecoin supply (as defined by the stabilizationFundPercent parameter in the DAO contract). The maximum stablecoins per auction is regulated by the maxCoinsForStabilization parameter in the DAO contract.
    /// @param coinsAmountNeeded The amount of stablecoins needed.
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

        auctionID = createNewAuction(2, 0, coinsAmountNeeded);
        isCoinsBuyOutForStabilization = true;
    }

    /// @notice Initiates an auction if a margin call occurs and the system needs to sell the collateral.
    /// @return auctionID New auction ID.
    function initCoinsBuyOut() nonReentrant payable external returns (uint32 auctionID){
        require (msg.sender == dao.addresses("cdp"), "Only CDP contract may invoke this method. Please, use claimMarginCall in CDP contract");
        auctionID = createNewAuction(3, msg.value, 0);
    }

    function createNewAuction(uint8 auctionType, uint256 lotAmount, uint256 paymentAmount) internal returns (uint32 auctionID){
        auctionID = ++auctionNum;
        auctionEntity storage a = auctions[auctionID];

        if (auctionType == 1) {
            a.lotToken = dao.addresses("stableCoin");
            a.paymentToken = dao.addresses("rule");
        }
        if (auctionType == 2) {
            a.lotToken = dao.addresses("rule");
            a.paymentToken = dao.addresses("stableCoin");
        }
        if (auctionType == 3) {
            a.lotToken = address(0);
            a.paymentToken = dao.addresses("stableCoin");
        }

        a.auctionType = auctionType;
        a.initialized = true;
        a.finalized = false;
        a.lotAmount = lotAmount;
        a.paymentAmount = paymentAmount;
        a.lastTimeUpdated = block.timestamp;
        a.initTime = block.timestamp;
        a.bestBidID = 0;

        emit newAuction(auctionType, auctionID, lotAmount, a.lotToken, paymentAmount);
    }

    /// @notice Use this method to place a new bid. Ensure you have allowed the needed amount for the Auction contract address. The minAuctionPriceMove percentage (from the DAO contract) means you must improve the previous best bid by a certain percentage.
    /// @param auctionID The ID of the auction to participate in.
    /// @param bidAmount The amount of the bid.
    /// @return bidID New bid ID.
    function makeBid(uint32 auctionID, uint256 bidAmount) nonReentrant external returns (uint32 bidID){
        auctionEntity storage a = auctions[auctionID];
        require(a.initialized&&!a.finalized, "auctionID is wrong or it is already finished");

        if (a.bestBidID !=0){
            Bid storage bestBid = bids[a.bestBidID];
            if (a.auctionType == 2)
                require(bidAmount>0 && bestBid.bidAmount*(100-dao.params("minAuctionPriceMove"))/100>=bidAmount, "your bid is not low enough");
            else
                require(bidAmount>0 && bestBid.bidAmount*(100+dao.params("minAuctionPriceMove"))/100<=bidAmount, "your bid is not high enough");
        }
        require(bidAmount>0, "your bid is not high enough");
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.auctionType == 2){
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
    }

    /// @notice Use this method to improve your own bid.
    /// @param bidID The ID of your bid.
    /// @param newBidAmount The new bid amount.
    function improveBid(uint32 bidID, uint256 newBidAmount) nonReentrant external{
        Bid storage b = bids[bidID];
        require(b.owner == msg.sender, "You may improve only your personal bids");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized&&!a.finalized, "auctionID is wrong or it is already finished");
        Bid storage bestBid = bids[a.bestBidID];

        if (a.auctionType == 2)
            require(newBidAmount>0 && bestBid.bidAmount*(100-dao.params("minAuctionPriceMove"))/100>=newBidAmount, "your bid is not high enough");
        else
            require(newBidAmount>0 && bestBid.bidAmount*(100+dao.params("minAuctionPriceMove"))/100<=newBidAmount, "your bid is not high enough");

        IERC20 paymentToken = IERC20(address(a.paymentToken));

        if (a.auctionType == 1 || a.auctionType == 3){
            uint256 difference = newBidAmount-b.bidAmount;
            require(paymentToken.transferFrom(msg.sender, address(this), difference), "You should first approve payment to auction contract address");
        }

        b.bidAmount = newBidAmount;
        a.lastTimeUpdated = block.timestamp;
        a.bestBidID = bidID;
        emit newBid(b.auctionID, bidID, newBidAmount, b.owner);
    }

    /// @notice Use this method to cancel your own bid. Note that you cannot cancel your bid if it is currently the best one.
    /// @param bidID The ID of your bid.
    function cancelBid(uint32 bidID) nonReentrant external{
        Bid storage b = bids[bidID];
        require (b.owner==msg.sender && !b.canceled, "Only bid owner may cancel it, if it wasn't canceled earlier");
        auctionEntity storage a = auctions[b.auctionID];
        require(a.initialized, "the bid is made on non-existent auction");
        require(a.bestBidID != bidID, "You can not cancel a bid if it is a best one");
        IERC20 paymentToken = IERC20(address(a.paymentToken));
        if (a.auctionType == 2)
            require(paymentToken.transfer(b.owner, a.paymentAmount), "we were not able to transfer your bid back");
        else
            require(paymentToken.transfer(b.owner, b.bidAmount), "we were not able to transfer your bid back");
        emit bidCanceled(bidID);
        b.canceled = true;
    }

    /// @notice If there are no more bids and the timeout has expired, you can claim to finalize the auction. For auctions involving collateral, use the finishMarginCall method from the CDP contract.
    /// @param auctionID The ID of the auction to finalize.
    function claimToFinalizeAuction(uint32 auctionID) nonReentrant external returns (bool success){
        auctionEntity storage a = auctions[auctionID];
        if (a.auctionType == 3)
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

        if (a.auctionType == 1){
            require(IERC20(address(a.lotToken)).transfer(bestBid.owner, a.lotAmount), "lotToken transfer failed for some reason");
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.bidAmount), "paymentToken transfer failed for some reason");
            ruleBuyOut = false;
        }
        if (a.auctionType == 2){
            require(cdp.mintRule(bestBid.owner, bestBid.bidAmount), "could not mint rule");
            require(coin.transfer(dao.addresses("cdp"), a.paymentAmount), "could not transfer coins");
            isCoinsBuyOutForStabilization = false;
        }
        if (a.auctionType == 3){
            require(payable(bestBid.owner).send(a.lotAmount), "could not transfer collateral");
            require(IERC20(address(a.paymentToken)).transfer(dao.addresses("cdp"), bestBid.bidAmount), "could not transfer coins");
        }
        a.finalized = true;
        emit auctionFinished(auctionID, a.lotAmount, a.bestBidID);
    }

    /// @notice Shows whether a certain auction is finished or not.
    /// @param auctionID The ID of the auction.
    function isFinalized(uint32 auctionID) external view returns (bool finalized){
        return auctions[auctionID].finalized;
    }

    /// @notice Shows the payment amount required for an auction. This is mainly used when collateral is sold.
    /// @param auctionID The ID of the auction.
    function getPaymentAmount(uint32 auctionID) external view returns (uint256){
        return auctions[auctionID].paymentAmount;
    }

    /// @notice Shows the current best bid amount for an auction.
    /// @param auctionID The ID of the auction.
    function getBestBidAmount(uint32 auctionID) external view returns (uint256){
        return bids[auctions[auctionID].bestBidID].bidAmount;
    }
}
