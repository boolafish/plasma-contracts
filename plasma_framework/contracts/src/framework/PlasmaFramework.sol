pragma solidity ^0.5.0;

// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397
pragma experimental ABIEncoderV2;

import "./PlasmaBlockController.sol";

contract PlasmaFramework is PlasmaBlockController {
    constructor() public {
        nextChildBlock = CHILD_BLOCK_INTERVAL;
        nextDepositBlock = 1;
    }
}
