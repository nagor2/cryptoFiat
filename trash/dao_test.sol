// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
/*
import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/CDP.sol";

contract TestDAO {


    INTDAO dao = INTDAO(); //DeployedAddresses.INTDAO()

    function testgetMinCollateralValue() public{
        uint expected = 10^16;

        Assert.equal(dao.getMinCollateralValue(), expected, "getMinCollateralValue should return 10^16");

    }

}
