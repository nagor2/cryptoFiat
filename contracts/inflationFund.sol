// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDAO.sol";
import "./ICDP.sol";

/// @title Inflation fund contract
contract InflationFund {

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Stablecoin interface.
    IERC20 coin;

    /// @notice CDP interface.
    ICDP cdp;

    /// @notice Last time the emission was made.
    uint256 public lastEmission;

    /// @notice Event emitted when inflation emission is made.
    /// @param amount Amount of stablecoins minted.
    /// @param spender Who's receiving additionally minted funds.
    event inflationEmission(uint256 amount, address spender);

    /// @notice Constructor for Inflation fund contract.
    /// @param _INTDAOaddress - the address of main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
        lastEmission = block.timestamp;
    }

    /// @notice This method is used to reinit needed interfaces when the addresses of contracts to use are changed by voting or to init interfaces just after deploy.
    function renewContracts() external{
        coin = IERC20(dao.addresses("stableCoin"));
        cdp = ICDP(dao.addresses("cdp"));
    }

    /// @notice Method to claim additional emission for inflation. Once a year since last emission a contract may emit additional funds as a certain percent of total stablecoins supply.
    /// annualInflationPercent is regulated in DAO contract.
    function claimEmission() external{
        uint256 period = block.timestamp - lastEmission;
        require (period>=365 days, "too early to claim");
        uint256 amount = period/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        lastEmission = block.timestamp;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount, dao.addresses("inflationSpender"));
        emit inflationEmission(amount, dao.addresses("inflationSpender"));
    }
}
