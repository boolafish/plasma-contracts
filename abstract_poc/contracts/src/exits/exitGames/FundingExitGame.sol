pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../models/FundingExitDataModel.sol";
import "../../framework/PlasmaFramework.sol";
import "../../framework/models/ExitModel.sol";
import "../../framework/interfaces/OutputPredicate.sol";
import "../../transactions/outputs/DexOutputModel.sol";
import "../../transactions/txs/FundingTxModel.sol";
import "../../utils/AddressPayable.sol";

/**
MVP
 */
contract FundingExitGame {
    uint256 constant TX_TYPE = 2;

    PlasmaFramework framework;
    address exitProcessor;

    using DexOutputModel for DexOutputModel.TxOutput;

    constructor(address _framework, address _exitProcessor) public {
        framework = PlasmaFramework(_framework);
        exitProcessor = _exitProcessor;
    }

    function startExit(uint192 _utxoPos, bytes calldata _outputTx, bytes calldata _outputTxInclusionProof) external {
        //TODO: check inclusion proof

        // If we are using ABIEncoderV2, I think we can even pass in the struct directly instead of bytes then there is no need to decode (?)
        FundingTxModel.Tx memory outputTx = FundingTxModel.decode(_outputTx);

        uint256 exitId = uint(_utxoPos);
        uint256 exitableAt = block.timestamp; // Need to add a period, for prototype we make it insecure
        ExitModel.Exit memory exit = ExitModel.Exit(exitProcessor, exitableAt, exitId);
        uint192 priority = _utxoPos;
        framework.enqueue(priority, exit);

        uint256 outputIndex = 0; // funding tx is 1 input and output tx
        FundingExitDataModel.Data memory exitData = FundingExitDataModel.Data({
            exitId: exitId,
            exitable: true,
            outputHash: outputTx.dexOutputs[outputIndex].hash(),
            token: outputTx.dexOutputs[outputIndex].outputData.token,
            exitTarget: AddressPayable.transfer(outputTx.dexOutputs[outputIndex].outputData.owner),
            amount: outputTx.dexOutputs[outputIndex].outputData.amount
        });

        bytes memory exitDataInBytes = abi.encode(exitData);
        framework.setBytesStorage(TX_TYPE, bytes32(exitId), exitDataInBytes);
    }

    function challengeExitOutputUsed(
        uint192 _standardExitId,
        bytes calldata _output,
        bytes calldata _challengeTx,
        uint256 _challengeTxType,
        uint8 _inputIndex
    ) external {
        uint256 exitId = uint256(_standardExitId);
        bytes memory exitDataInBytes = framework.getBytesStorage(TX_TYPE, bytes32(exitId));
        FundingExitDataModel.Data memory exitData = abi.decode(exitDataInBytes, (FundingExitDataModel.Data));

        require(exitData.outputHash == keccak256(_output), "The output does not match the exit output");

        OutputPredicate predicate = framework.getOutputPredicate(DexOutputModel.getOutputType(), _challengeTxType);
        require(address(predicate) != address(0), "Predicate for the output type and consume tx type does not exists");
        require(predicate.canUseTxOutput(_output, _challengeTx, _inputIndex), "The output is not able to be used in the challenge tx");

        exitData.exitable = false;
        framework.setBytesStorage(TX_TYPE, bytes32(exitId), abi.encode(exitData));
    }
}