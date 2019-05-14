pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./BaseExitGame.sol";
import "../models/SimplePaymentExitDataModel.sol";
import "../../framework/models/ExitModel.sol";
import "../../framework/interfaces/OutputPredicate.sol";
import "../../transactions/outputs/PaymentOutputModel.sol";
import "../../transactions/txs/SimplePaymentTxModel.sol";

/**
 Using MoreVp, POC skiping IFE
 */
contract SimplePaymentExitGame is BaseExitGame {
    uint8 STANDARD_EXIT_TYPE = 1;
    uint8 INFLIGHT_EXIT_TYPE = 2;

    using TxOutputModel for TxOutputModel.TxOutput;

    constructor(address _framework, address _exitProcessor, uint256 _txType)
        BaseExitGame(_framework, _exitProcessor, _txType) public {}

    function startStandardExit(uint192 _utxoPos, bytes calldata _outputTx, bytes calldata _outputTxInclusionProof)
        external onlyFromFramework {
        //TODO: check inclusion proof

        TxModel.Tx memory outputTx = TxModel.decode(_outputTx);

        uint256 exitId = uint(_utxoPos); // This does not work with IFE, temp for prototype
        uint256 exitableAt = block.timestamp; // Need to add a period, for prototype we make it insecure
        ExitModel.Exit memory exit = ExitModel.Exit(exitProcessor, exitableAt, exitId);
        uint192 priority = _utxoPos;
        framework.enqueue(priority, exit);

        uint256 outputIndex = 0; // simple payment tx only have 1 input and output. Otherwise should parse this from _utxoPos
        SimplePaymentExitDataModel.Data memory exitData = SimplePaymentExitDataModel.Data({
            exitId: exitId,
            exitType: STANDARD_EXIT_TYPE,
            exitable: true,
            outputHash: outputTx.outputs[outputIndex].hash(),
            token: outputTx.outputs[outputIndex].outputData.token,
            exitTarget: outputTx.outputs[outputIndex].outputData.owner,
            amount: outputTx.outputs[outputIndex].outputData.amount
        });

        bytes memory exitDataInBytes = abi.encode(exitData);
        framework.setBytesStorage(txType, bytes32(exitId), exitDataInBytes);
    }

    function challengeStandardExitOutputUsed(
        uint192 _standardExitId,
        bytes calldata _output,
        bytes calldata _challengeTx,
        uint256 _challengeTxType,
        uint8 _inputIndex
    ) external onlyFromFramework {
        uint256 exitId = uint256(_standardExitId);
        bytes memory exitDataInBytes = framework.getBytesStorage(txType, bytes32(exitId));
        SimplePaymentExitDataModel.Data memory exitData = abi.decode(exitDataInBytes, (SimplePaymentExitDataModel.Data));

        require(exitData.exitType == STANDARD_EXIT_TYPE, "The exit is not standard exit.");
        require(exitData.outputHash == keccak256(_output), "The output does not match the exit output");

        OutputPredicate predicate = framework.getOutputPredicate(TxOutputModel.getOutputType(), _challengeTxType);
        require(predicate.canUseTxOutput(_output, _challengeTx, _inputIndex), "The output is not able to be used in the challenge tx");

        exitData.exitable = false;
        framework.setBytesStorage(txType, bytes32(exitId), abi.encode(exitData));
    }
}