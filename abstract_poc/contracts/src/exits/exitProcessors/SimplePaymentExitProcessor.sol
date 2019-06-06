pragma solidity ^0.5.0;
// Should be safe to use. It is marked as experimental as it costs higher gas usage.
// see: https://github.com/ethereum/solidity/issues/5397
pragma experimental ABIEncoderV2;

import "./OnlyFramework.sol";
import "../models/SimplePaymentExitDataModel.sol";
import "../../vaults/EthVault.sol";
import "../../WithFramework.sol";
import "../../framework/interfaces/ExitProcessor.sol";

contract SimplePaymentExitProcessor is OnlyFramework, ExitProcessor {
    uint256 constant TX_TYPE = 1;

    PlasmaFramework framework;
    EthVault ethVault;

    constructor(address _framework, address _ethVault) public {
        framework = PlasmaFramework(_framework);
        ethVault = EthVault(_ethVault);
    }

    function processExit(uint256 _exitId) external onlyFramework {
        bytes memory exitDataInBytes = framework.getBytesStorage(TX_TYPE, bytes32(_exitId));
        SimplePaymentExitDataModel.Data memory exitData = abi.decode(exitDataInBytes, (SimplePaymentExitDataModel.Data));

        if (exitData.exitable && exitData.token == address(0)) {
            ethVault.withdraw(exitData.exitTarget, exitData.amount);
        }
    }

}