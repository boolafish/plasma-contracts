pragma solidity ^0.5.0;

import "./AppInterface.sol";

library Models {
    struct QueueData {
        AppInterface app;
        bytes32 withdrawId;
    }
}