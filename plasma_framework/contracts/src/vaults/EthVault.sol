pragma solidity ^0.5.0;

import "./ZeroHashesProvider.sol";
import "../framework/PlasmaFramework.sol";
import "./predicates/IEthDepositVerifier.sol";
import {TransactionModel as DepositTx} from "../transactions/TransactionModel.sol";

contract EthVault {
    uint8 constant DEPOSIT_TX_TYPE = 1;

    PlasmaFramework framework;
    bytes32[16] zeroHashes;
    IEthDepositVerifier depositVerifier;

    constructor(address _framework) public {
        framework = PlasmaFramework(_framework);
        zeroHashes = ZeroHashesProvider.getZeroHashes();
    }

    // TODO: only from operator
    function setDepositable(address _contract) public {
        depositVerifier = IEthDepositVerifier(_contract);
    }

    /**
     * @dev Allows a user to submit a deposit.
     * @param _depositTx RLP encoded transaction to act as the deposit.
     */
    function deposit(bytes calldata _depositTx) external payable {
        depositVerifier.verify(_depositTx, msg.value, msg.sender);

        bytes32 root = keccak256(_depositTx);
        for (uint i = 0; i < 16; i++) {
            root = keccak256(abi.encodePacked(root, zeroHashes[i]));
        }

        framework.submitDepositBlock(root);
    }

    //TODO: must be called only from exit processors, should be guarded by modifier
    /**
    * @dev Withdraw plasma chain eth via transferring ETH.
    * @param _target Place to transfer eth.
    * @param _amount Amount of eth to transfer.
    */
    function withdraw(address payable _target, uint256 _amount) external {
        _target.transfer(_amount);
    }
}
