// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./Oracle.sol";
import "./Rule.sol";
import "./stableCoin.sol";
import "./Auction.sol";

//previous Interest price is saved during INT auction - no need or make auction longer in time
//started at 11.30 25/05/2020

contract CDP {
    uint256 public numPositions;

    address INTDAOaddress = address(0);
    INTDAO dao;
    Oracle oracle;
    stableCoin coin;
    Auction auction;

    mapping(uint => Position) public positions;
    event PositionOpened (address owner, uint256 posId);
    event PositionUpdated (uint256 posID, uint256 newStableCoinsAmount);

    struct Position {
        bool onLiquidation;
        bool liquidated;
        address owner;
        uint stableCoins_minted;
        uint ethAmountLocked;
        uint feeGenerated;
        uint timeOpened;
        uint lastTimeUpdated;
        uint feeRate;
    }

    constructor(address _INTDAOaddress) {
        INTDAOaddress = _INTDAOaddress;
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('cdp',address(this));
        oracle = Oracle(dao.addresses('oracle'));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        auction = Auction(dao.addresses('auction'));
    }

    function openCDP (uint StableCoinsToMint) external payable returns (uint256 posId){
        posId = numPositions++;
        Position storage p = positions[posId];

        uint coinsToMint = getMaxStableCoinsToMint(StableCoinsToMint, msg.value);
        if (StableCoinsToMint <= coinsToMint)
            coinsToMint = StableCoinsToMint;

        p.stableCoins_minted = coinsToMint;
        p.ethAmountLocked = msg.value;
        p.owner = msg.sender;
        p.timeOpened = block.timestamp;
        p.lastTimeUpdated = block.timestamp;
        p.feeGenerated = 0;
        p.feeRate = dao.params('interestRate');

        coin.mint(msg.sender, coinsToMint);

        emit PositionOpened(p.owner, posId);

        return posId;
    }

    function generatedFee(uint posId) public view returns (uint256 fee) {
        Position storage p = positions[posId];
        fee = p.stableCoins_minted * (block.timestamp - p.lastTimeUpdated) * p.feeRate / 31536000 / 100;
        return fee;
    }

    function getMaxStableCoinsToMint(uint256 StableCoinsToMint, uint256 ethValue) public view returns (uint256 amount) {
        uint256 etherPrice = oracle.getEtherPriceUSD();
        uint256 maxCoinsToMint = ethValue * etherPrice * (100 - dao.params('collateralDiscount'))/(100);

        if (StableCoinsToMint < maxCoinsToMint)
            return StableCoinsToMint;
        else
            return maxCoinsToMint;
    }

    function closeCDP(uint posID) public returns (bool success){ //shows minimum amount of INT you have to own
        // Rule allowed to which address? )
        //burnFromCollateral from wich addressAllowed?
        //sendEtherToOwner
        //checkAllowance of RuleTokens
        //if allowed, transfer on balance, then burn
    }

    function transferFee(uint posID) public returns (bool success){
        Position storage p = positions[posID];
        p.feeGenerated = generatedFee(posID);
        require(p.feeGenerated > 10**18, 'No or little fee generated');
        require(coin.burn(p.owner, p.feeGenerated)&&coin.mint(address(this), p.feeGenerated), 'Was not able to transfer fee');
        if (coin.balanceOf(address(this))>dao.params('stabilizationFundPercent')*coin.totalSupply()) {
            uint256 difference = coin.balanceOf(address(this))-dao.params('stabilizationFundPercent')*coin.totalSupply();
            coin.transfer(dao.addresses('auction'), difference);
            require(auction.initRuleBuyOut(), 'Rule token buyout must be initialized');
        }
    }

    function claim_margin_call(uint posID) public returns (bool success) {

    }

    function updateCDP(uint posID, uint newStableCoinsAmount) public payable returns (bool success){
        Position storage p = positions[posID];
        require(p.owner == msg.sender, 'Only owner may update the position');
        uint256 maxCoinsToMint;

        p.feeGenerated = generatedFee(posID);
        p.lastTimeUpdated = block.timestamp;

        if (msg.value>0)
            p.ethAmountLocked += msg.value;

        maxCoinsToMint = getMaxStableCoinsToMint(newStableCoinsAmount, p.ethAmountLocked) - p.feeGenerated;
        require(maxCoinsToMint>0 && maxCoinsToMint <= newStableCoinsAmount, 'not enough collateral to mint amount');

        if (newStableCoinsAmount > p.stableCoins_minted) {
            uint256 difference = newStableCoinsAmount - p.stableCoins_minted;
            coin.mint(p.owner, difference);
            emit PositionUpdated(posID, newStableCoinsAmount);
            return true;
        }

        if (newStableCoinsAmount < p.stableCoins_minted) {
            uint256 difference = p.stableCoins_minted - newStableCoinsAmount;
            require(coin.balanceOf(p.owner)>=difference);
            coin.burn(p.owner, difference);
            emit PositionUpdated(posID, newStableCoinsAmount);
            return true;
        }
    }

    function withdrawEther (uint posID, uint etherToWithdraw) public{
        //open Auction in the same contract
    }


    function recieveInterestAfterAuction() public {
        //INT.mintForCDP();
    }

}
