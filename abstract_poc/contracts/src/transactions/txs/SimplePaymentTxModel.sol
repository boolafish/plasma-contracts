pragma solidity ^0.5.0;

import "../TxInputModel.sol";
import "../outputs/PaymentOutputModel.sol";

library TxModel {
    uint256 constant TX_TYPE = 1;
    uint256 constant MAX_INPUT = 1;
    uint256 constant MAX_OUPUT = 1;

    using TxOutputModel for TxOutputModel.TxOutput;

    struct ProofData {
        bytes signature;
    }

    struct MetaData {
        bytes32 data;
    }

    struct Tx {
        uint256 txType;
        TxInputModel.TxInput[MAX_INPUT] inputs;
        TxOutputModel.TxOutput[MAX_OUPUT] outputs;
        ProofData proofData;
        MetaData metaData;
    }

    function getTxType() internal pure returns (uint256) {
        return TX_TYPE;
    }

    function checkFormat(Tx memory _tx) internal pure returns (bool, string memory) {
        if (_tx.txType != TX_TYPE) {
            return (false, "Simple MoreVP tx needs to be tx type 1");
        }

        for (uint i = 0 ; i < MAX_OUPUT; i++) {
            (bool result, string memory message) = _tx.outputs[i].checkFormat();
            if (result == false) {
                return (result, message);
            }
        }

        return (true, "");
    }

    function decode(bytes memory _tx) internal pure returns (TxModel.Tx memory){
        // POC implement
        return DummyTxFactory.get();
    }
}


// temp code for POC testing
library DummyTxFactory {
    function get() internal pure returns (TxModel.Tx memory) {
        // dummy implement
        TxInputModel.TxInput[1] memory ins;
        TxOutputModel.TxOutput[1] memory outs;

        TxInputModel.TxInput memory dummyTxIn = TxInputModel.TxInput(0, 0, 0);
        TxOutputModel.TxOutput memory dummyTxOut = TxOutputModel.TxOutput(
            1, TxOutputModel.TxOutputData(10, address(0), address(0)));

        ins[0] = dummyTxIn;
        outs[0] = dummyTxOut;
        return TxModel.Tx(TxModel.getTxType(), ins, outs, TxModel.ProofData(bytes("signature")), TxModel.MetaData(""));
    }
}