pragma solidity ^0.5.0;

import "./Models.sol";

interface AppInterface {
    function processWithdraw(bytes32 _withdrawId) external;
}