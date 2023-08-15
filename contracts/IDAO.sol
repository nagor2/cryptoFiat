// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IDAO{
    function addresses(string memory) external view returns (address);
    function params(string memory) external view returns (uint256);
    function setAddressOnce(string memory, address) external;
    function isAuthorized(address candidate) external view returns (bool);
}
