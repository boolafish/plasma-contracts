pragma solidity ^0.5.0;

contract Framework {
    mapping(bytes32 => bytes) private bytesStorage;
    
    function getBytesStorage(uint256 _txType, bytes32 _key) external view returns (bytes memory) {
        bytes32 key = keccak256(abi.encodePacked(_txType, _key));
        return bytesStorage[key];
    }

    function setBytesStorage(uint256 _txType, bytes32 _key, bytes calldata _value) external {
        bytes32 key = keccak256(abi.encodePacked(_txType, _key));
        bytesStorage[key] = _value;
    }
    
    function proxy(bytes memory _encodedFunctionData, address proxyTo) public {
        (bool success, bytes memory data) = proxyTo.call(_encodedFunctionData);
        require(success, string(abi.encodePacked("proxy contract failed with data: [ ", string(data), " ]")));
    }

    function dummy() public {
        // dummy to see the base cost
    }
}
