// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

contract Oracle {

    constructor(){

    }

    function getPrice(string memory symbol) external virtual view returns (uint256) {
        return 75;
    }

}
