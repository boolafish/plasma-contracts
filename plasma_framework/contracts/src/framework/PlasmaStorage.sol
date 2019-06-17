pragma solidity ^0.5.0;

import "../models/BlockModel.sol";

/**
Centralized place to hold all Plasma storage.
If we want to use proxy contract upgrade on the plasma layer,
we need to make the the order of storage declaration can be only appended.
When upgrade, should just extends this storage to v2 and add new storage
definitions to maker sure the storage layout does not break.
Put everything in a centralized place to avoid possible future crash.
 */
contract PlasmaStorage {
    /**
    Basic Plasma
    */
    uint256 constant public CHILD_BLOCK_INTERVAL = 1000;

    mapping (uint256 => BlockModel.Block) public blocks;
    uint256 public nextChildBlock;
    uint256 public nextDepositBlock;
}
