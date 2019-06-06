pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./utils/PaymentOutputToFundingTxCondition.sol";
import "./utils/PaymentOutputToPaymentTxCondition.sol";
import "../models/SimplePaymentExitDataModelV2.sol";
import "../../vaults/EthVault.sol";
import "../../framework/PlasmaFramework.sol";
import "../../framework/models/ExitModel.sol";
import "../../framework/interfaces/OutputPredicate.sol";
import "../../framework/interfaces/ExitProcessor.sol";
import "../../transactions/outputs/DexOutputModel.sol";
import "../../transactions/txs/FundingTxModel.sol";
import "../../transactions/txs/SimplePaymentTxModel.sol";
import "../../utils/AddressPayable.sol";

/**
MVP
 */
contract SimplePaymentExitGameV2 is ExitProcessor {
    uint256 constant TX_TYPE = 2;

    PlasmaFramework framework;
    EthVault ethVault;

    mapping(uint256 => SimplePaymentExitDataModelV2.Data) exits;

    using DexOutputModel for DexOutputModel.TxOutput;

    constructor(address _framework, address _ethVault) public {
        framework = PlasmaFramework(_framework);
        ethVault = EthVault(_ethVault);
    }

    function startExit(uint192 _utxoPos, bytes calldata _outputTx, bytes calldata _outputTxInclusionProof, bytes calldata confirmSig) external {
        //TODO: check inclusion proof
        //require(InclusionProofVerifier.verify(_utxoPos, _outputTx, _outputTxInclusionProof))

        // If we are using ABIEncoderV2, I think we can even pass in the struct directly instead of bytes then there is no need to decode (?)
        FundingTxModel.Tx memory outputTx = FundingTxModel.decode(_outputTx);

        uint256 exitId = uint(_utxoPos);
        uint256 outputIndex = 0; // funding tx is 1 input and output tx
        SimplePaymentExitDataModelV2.Data memory exitData = SimplePaymentExitDataModelV2.Data({
            exitId: exitId,
            exitable: true,
            outputId: _utxoPos,
            token: outputTx.dexOutputs[outputIndex].outputData.token,
            exitTarget: AddressPayable.transfer(outputTx.dexOutputs[outputIndex].outputData.owner),
            amount: outputTx.dexOutputs[outputIndex].outputData.amount
        });
        exits[exitId] = exitData;

        uint256 exitableAt = block.timestamp; // Need to add a period, for prototype we make it insecure
        ExitModel.Exit memory exit = ExitModel.Exit(address(this), exitableAt, exitId);
        uint192 priority = _utxoPos;
        framework.enqueue(priority, exit);
    }

    function challengeExitOutputUsed(
        uint256 _exitId,
        bytes calldata _challengeTx,
        uint256 _challengeTxType,
        uint8 _inputIndex
    ) external {
        SimplePaymentExitDataModelV2.Data memory exitData = exits[_exitId];
        require(exitData.exitable == true, "Exit is not exitable");

        if(_challengeTxType == SimplePaymentTxModel.getTxType()) {
            PaymentOutputToPaymentTxCondition.check(exitData, _challengeTx, _inputIndex);
        } else if(_challengeTxType == FundingTxModel.getTxType()) {
            PaymentOutputToFundingTxCondition.check(exitData, _challengeTx, _inputIndex);
        }

        exitData.exitable = false;
        exits[_exitId] = exitData;
    }

    function processExit(uint256 _exitId) external {
        SimplePaymentExitDataModelV2.Data memory exitData = exits[_exitId];
        require(exitData.exitable == true, "Exit is not exitable");

        if (exitData.exitable && exitData.token == address(0)) {
            ethVault.withdraw(exitData.exitTarget, exitData.amount);
        }
    }
}