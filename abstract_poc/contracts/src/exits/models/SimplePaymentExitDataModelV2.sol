pragma solidity ^0.5.0;

library SimplePaymentExitDataModelV2 {
    struct Data {
        uint256 exitId;
        bool exitable;
        uint256 outputId;
        address token;
        address payable exitTarget;
        uint256 amount;
    }
}