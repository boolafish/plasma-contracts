pragma solidity ^0.5.0;

import "../../src/utils/RLP.sol";

contract RLPMock {

    using RLP for bytes;
    using RLP for RLP.RLPItem;

    function decodeBytes(bytes memory _data) public view returns (bytes memory) {
        return _data.toRLPItem().toBytes();
    }

    function decodeBytes32(bytes memory _data) public view returns (bytes32) {
        return _data.toRLPItem().toBytes32();
    }

    function decodeBool(bytes memory _data) public view returns (bool) {
        return _data.toRLPItem().toBool();
    }

    function decodeInt(bytes memory _data) public view returns (int) {
        return _data.toRLPItem().toInt();
    }

    function decodeUint(bytes memory _data) public view returns (uint) {
        return _data.toRLPItem().toUint();
    }

    function decodeArray(bytes memory _data) public view returns (uint) {
        RLP.RLPItem[] memory items = (_data.toRLPItem().toList()[0]).toList();
        return items.length;
    }

    function decodeDeposit(bytes memory _data) public view returns (bytes32) {
        bytes32 input = (_data.toRLPItem().toList()[1]).toList()[0].toBytes32();
        return input;
    }
}
