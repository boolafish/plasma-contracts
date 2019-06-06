pragma solidity ^0.5.0;

library FundingExitDataModel {
    struct Data {
        uint256 exitId;
        bool exitable;
        bytes32 outputHash;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}