// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

contract Oracle {

    constructor(){

    }

    function getPrice(string memory) external pure returns (uint256) {
        return 75;
    }

    function getEtherPriceUSD() external pure returns (uint256){
        return 3100;
    }

}
