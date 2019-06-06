pragma solidity ^0.5.0;

library SimplePaymentExitDataModel {
    struct Data {
        uint256 exitId;
        uint8 exitType;
        bool exitable;
        bytes32 outputHash;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}