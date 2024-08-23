// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;

interface IDAO{
    function addresses(string memory) external view returns (address);
    function params(string memory) external view returns (uint256);
    function isAuthorized(address candidate) external view returns (bool);
}
