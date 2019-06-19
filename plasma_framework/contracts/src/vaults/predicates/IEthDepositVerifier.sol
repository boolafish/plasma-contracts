pragma solidity ^0.5.0;

interface IEthDepositVerifier {
    function verify(bytes calldata _depositTx, uint256 amount, address payable owner) external view returns (bool);
}