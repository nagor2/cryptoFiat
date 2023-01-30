// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";

interface ERC20 {
    function totalSupply() external view returns (uint supply);
    function balanceOf(address who) external view returns (uint value);
    function allowance(address owner, address spender) external view returns (uint remaining);

    function transfer(address to, uint value) external returns (bool ok);
    function transferFrom(address from, address to, uint value) external returns (bool ok);
    function approve(address spender, uint value) external returns (bool ok);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract stableCoin is ERC20{
    uint8 public constant decimals = 18;
    uint256 initialSupply = 0;

    string public constant name = "stableCoin";
    string public constant symbol = "S";

    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;

    event Burned(address from, uint256 value);
    event Mint(address to, uint256 value);
    INTDAO dao;

    constructor(address _INTDAOaddress){
        dao = INTDAO(_INTDAOaddress);
        dao.setAddressOnce("stableCoin", payable(this));
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

    receive() external payable {
        //TODO: trade to weth. -> .transfer(msg.value);
    }

    function mint(address to, uint256 amount) public returns (bool) {
        require (msg.sender == dao.addresses('cdp'), 'only collateral contract is authorized to mint');
        balances[to] += amount;
        initialSupply += amount;
        emit Mint(to, amount);
        return true;
    }

    function burn(address from, uint256 amount) public returns (bool success) {
        require (msg.sender == dao.addresses('cdp'), 'only collateral contract is authorized to burn');
        initialSupply -= amount;
        balances[from] -= amount;
        emit Burned(address(from), amount);
        return true;
    }
}