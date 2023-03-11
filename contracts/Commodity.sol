// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./INTDAO.sol";
import "./exchangeRateContract.sol";
import "./stableCoin.sol";
import "./Auction.sol";

contract Commodity is ERC20{
    uint256 public constant decimals = 18;
    uint256 initialSupply = 0;

    string public name;
    string public symbol;

    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;

    event Burned(address from, uint256 value);
    event Mint(address to, uint256 value);
    INTDAO dao;
    stableCoin coin;
    exchangeRateContract oracle;
    Auction auction;

    constructor(address payable INTDAOaddress, string memory _symbol){
        dao = INTDAO(INTDAOaddress);
        symbol = _symbol;
        dao.setAddressOnce(symbol,payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        oracle = exchangeRateContract(dao.addresses('oracle'));
        auction = Auction(dao.addresses('auction'));
        (,name,) = oracle.dictionary(_symbol);
    }

    function totalSupply() public view returns (uint256) {
        return initialSupply;
    }

    function balanceOf(address owner) public view returns (uint256 balance) {
        return balances[owner];
    }

    function allowance(address owner, address spender) public view returns (uint remaining) {
        return allowed[owner][spender];
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        if (balances[msg.sender] >= value && value > 0) {
            balances[msg.sender] -= value;
            balances[to] += value;
            emit Transfer(msg.sender, to, value);
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        if (balances[from] >= value && allowed[from][msg.sender] >= value && value > 0) {
            balances[to] += value;
            balances[from] -= value;
            allowed[from][msg.sender] -= value;
            emit Transfer(from, to, value);
            return true;
        } else {
            return false;
        }
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
}
