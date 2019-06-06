pragma solidity ^0.5.0;

library AddressPayable {
    function transfer(address _address) internal pure returns (address payable) {
        return address(uint160(_address));
    }
}