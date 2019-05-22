pragma solidity ^0.5.0;

import "./Framework.sol";

contract APP {
    struct Data {
        uint256 exitId;
        uint8 exitType;
        bool exitable;
        bytes32 outputHash;
        address token;
        address exitTarget;
        uint256 amount;
    }
    
    Data d_exitable;
    Data d_nonexitable;
    Framework f;
    uint256 txType = 1;
    
    constructor(address addr) public {
        d_exitable = Data(1, 1, true, keccak256("dummyHash"), 0x6f834ffb0328Bba20D115CC7071A29Eb980D6B41, 0xBa022a7Cb268D7A7639bBfDCab25DF7037809383, 100);
        d_nonexitable = Data(1, 1, false, keccak256("dummyHash"), 0x6f834ffb0328Bba20D115CC7071A29Eb980D6B41, 0xBa022a7Cb268D7A7639bBfDCab25DF7037809383, 100);
        f = Framework(addr);
    }
    
    function saveDataToFramework(bytes32 key) public {
        bytes memory data = abi.encode(d_exitable.exitId, d_exitable.exitType, d_exitable.exitable, d_exitable.outputHash, d_exitable.token, d_exitable.exitTarget, d_exitable.amount);
        f.setBytesStorage(txType, key, data);
    }
    
    function saveDataToFrameworkWithDifferentFlagValue(bytes32 key) public {
        bytes memory data = abi.encode(d_nonexitable.exitId, d_nonexitable.exitType, d_nonexitable.exitable, d_nonexitable.outputHash, d_nonexitable.token, d_nonexitable.exitTarget, d_nonexitable.amount);
        f.setBytesStorage(txType, key, data);
    }

    function getDataFromFramework(bytes32 key) public returns (uint256, uint8, bool, bytes32, address, address, uint256) {
        bytes memory dataBytes = f.getBytesStorage(txType, key);
        return abi.decode(dataBytes, (uint256, uint8, bool, bytes32, address, address, uint256));
    }

    function dummyFunctionForProxy() public {
        // do nothing, only to estimate cost of proxy from framework
    }
}