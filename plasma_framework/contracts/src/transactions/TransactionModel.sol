pragma solidity ^0.5.0;

import "./outputs/OutputModel.sol";
import "../utils/RLP.sol";

library TransactionModel {

    using OutputModel for OutputModel.TxOutput;
    using OutputModel for RLP.RLPItem;
    using RLP for bytes;
    using RLP for RLP.RLPItem;

    struct MetaData {
        bytes32 data;
    }

    struct Transaction {
        uint256 txType;
        bytes32[] inputs;
        OutputModel.TxOutput[] outputs;
        MetaData metaData;
    }

    function decode(bytes memory _tx) internal view returns (TransactionModel.Transaction memory) {
        RLP.RLPItem[] memory rlpTx = _tx.toRLPItem().toList();
        RLP.RLPItem[] memory rlpInputs = rlpTx[1].toList();
        RLP.RLPItem[] memory rlpOutputs = rlpTx[2].toList();

        require(rlpTx.length == 4 || rlpTx.length == 3, "Invalid encoding of transaction");
        require(rlpInputs.length > 0, "Transaction must have inputs");
        require(rlpOutputs.length > 0, "Transaction must have outputs");

        uint txType = rlpTx[0].toUint();

        bytes32[] memory inputs = new bytes32[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; i++) {
            inputs[i] = rlpInputs[i].toBytes32();
        }

        OutputModel.TxOutput[] memory outputs = new OutputModel.TxOutput[](rlpOutputs.length);
        for (uint i = 0; i < rlpOutputs.length; i++) {
            outputs[i] = rlpOutputs[i].decodeOutput();
        }

        MetaData memory metaData;
        if (rlpTx.length == 4) {
            metaData = MetaData(rlpTx[3].toBytes32());
        } else {
            metaData = MetaData("");
        }

        return Transaction({txType: txType, inputs: inputs, outputs: outputs, metaData: metaData});
    }
}
