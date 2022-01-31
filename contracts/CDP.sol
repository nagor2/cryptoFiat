// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./Oracle.sol";
import "./Rule.sol";


//previous Interest price is saved during INT auction - no need or make auction longer in time
//started at 11.30 25/05/2020

contract CDP {
    uint256 public numPositions;

    address INTDAOaddress = address(0);
    INTDAO dao;
    Oracle oracle;

    address auctionAddress;

    mapping(uint => Position) public positions;
    mapping (address => uint) allowedToMint; //???

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
        oracle = Oracle(dao.addresses('oracleAddress'));
    }

    function openCDP (uint StableCoinsToMint) external payable returns (uint256 posId){
        posId = numPositions++;
        Position storage p = positions[posId];

        p.stableCoins_minted = getMaxStableCoinsToMint(StableCoinsToMint, msg.value);
        p.ethAmountLocked = msg.value;
        p.owner = msg.sender;
        p.timeOpened = block.timestamp;
        p.lastTimeUpdated = block.timestamp;
        p.feeGenerated = 0;
        p.feeRate = dao.params('interestRate');

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

    function closeCDP (uint posID) public{ //shows minimum amount of INT you have to own
        // Rule allowed to which address? )
        //burnFromCollateral from wich addressAllowed?
        //sendEtherToOwner
        //checkAllowance of RuleTokens
        //if allowed, transfer on balance, then burn
    }


    function updateCDP(uint posID, uint newStableCoinsAmount) payable returns (bool success){
        ethAmountLocked += msg.value;
    }


    function withdrawEther (uint posID, uint etherToWithdraw) public{
        //open Auction in the same contract
    }


    function recieveInterestAfterAuction() public {
        //INT.mintForCDP();
    }

}
