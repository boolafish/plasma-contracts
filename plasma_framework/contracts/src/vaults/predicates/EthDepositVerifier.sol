pragma solidity ^0.5.0;

import "./IEthDepositVerifier.sol";
import {TransactionModel as DepositTx} from "../../transactions/TransactionModel.sol";

contract EthDepositVerifier is IEthDepositVerifier {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    function verify(bytes calldata _depositTx, uint256 amount, address payable owner) external view returns (bool) {
        DepositTx.Transaction memory deposit = DepositTx.decode(_depositTx);

        require(deposit.txType == DEPOSIT_TX_TYPE, "Invalid transaction type");

        //Deposit has one input and it's id is 0
        require(deposit.inputs.length == 1, "Invalid number of inputs");
        require(deposit.inputs[0] == bytes32(0), ".....");

        require(deposit.outputs.length == 1, "Invalid number of outputs");
        require(deposit.outputs[0].amount == amount, "Deposited value does not match sent amount");
        require(deposit.outputs[0].token == address(0), "Output does not have correct currency (ETH)");

        address depositorsAddress = address(uint160(uint256(deposit.outputs[0].outputGuard)));
        require(depositorsAddress == owner, "Depositors address does not match senders address");
    }
}