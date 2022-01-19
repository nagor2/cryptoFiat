// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

contract Rule {


    constructor(){

    }

    function totalSupply() external virtual view returns (uint supply) {
        return 0;
    }

    function balanceOf(address who) external virtual view returns (uint value) {
        return 0;
    }

    function allowance(address owner, address spender) external virtual view returns (uint remaining){
        return 0;
    }

    function transfer(address to, uint value) external virtual returns (bool ok){
        return true;
    }

    function transferFrom(address from, address to, uint value) external virtual returns (bool ok){
        return true;
    }

    function approve(address spender, uint value) external virtual returns (bool ok){
        return true;
    }

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    function mintForCollateral() external virtual returns (bool success){
        return true;
    }


    function burnFromCollateral() external virtual returns (bool success){
        return true;
    }
}
