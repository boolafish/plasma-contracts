pragma solidity 0.5.12;

library BlockModel {
    struct Block {
        bytes32 root;
        uint256 timestamp;
    }
}
