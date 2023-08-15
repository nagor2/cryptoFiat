// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface ICDP{
    function mintRule(address to, uint256 amount) external returns (bool success);
    function claimInterest(uint256 amount, address beneficiary) external;
    function claimEmission(uint256 amount, address beneficiary) external;

}
