pragma solidity ^0.5.0;

import "./PlasmaStorage.sol";
import "./modifiers/Operated.sol";
import "./registries/VaultRegistry.sol";

contract PlasmaBlockController is PlasmaStorage, VaultRegistry {

    function submitDepositBlock(bytes32 _blockRoot) public onlyFromVault {
        require(nextDepositBlock < CHILD_BLOCK_INTERVAL, "Exceed limit of deposits per child block interval");

        uint256 blknum = getDepositBlockNumber();
        blocks[blknum] = BlockModel.Block({
            root : _blockRoot,
            timestamp : block.timestamp
        });

        nextDepositBlock++;
    }

    /**
     * @dev Calculates the next deposit block.
     * @return Next deposit block number.
     */
    function getDepositBlockNumber() private view returns (uint256) {
        return nextChildBlock - CHILD_BLOCK_INTERVAL + nextDepositBlock;
    }
}
