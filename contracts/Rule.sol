// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;

contract Rule {

    string public constant name = "Rule token";
    string public constant symbol = "RULE";
    uint256 initialSupply;
    mapping (address => uint256) balances; //amount of tokens each address holds
    mapping (address => mapping (address => uint256)) allowed;


    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    event Burned(address from, uint256 value);

    constructor(){
        initialSupply += 10**9*10**18;
        balances[msg.sender] = initialSupply;

    }

    function totalSupply() external virtual view returns (uint supply) {
        return initialSupply;
    }

    function balanceOf(address tokenHolder) public view returns (uint256 balance) {
        return balances[tokenHolder];
    }

    function allowance(address owner, address spender) public constant returns (uint256) {
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

    function mintForCollateral(address to, uint256 amount) external virtual returns (bool success){
        //get needed from auction (to, amount)
        {
            balances[to] += amount;
            //call auction to
            initialSupply += amount;
            //
        }
        return true;
    }


    function burnFromCollateral(address to) external virtual returns (bool success){
        if (allowed[msg.sender][to]>0) {
            balances[msg.sender] -= allowed[msg.sender][to];
            initialSupply -= allowed[msg.sender][to];
            allowed[msg.sender][to] = 0;
            return true;
        }
    }
}
