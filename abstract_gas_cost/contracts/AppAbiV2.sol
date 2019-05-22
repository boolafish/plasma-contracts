pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Framework.sol";

contract APPAbiV2 {
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
    
    function saveStructToFramework(bytes32 key) public {
        f.setBytesStorage(txType, key, abi.encode(d_exitable));
    }
    
    function getStructFromFramework(bytes32 key) public returns (Data memory){
        return abi.decode(f.getBytesStorage(txType, key), (Data));
    }

    function saveStructToFrameworkWithDifferentFlagValue(bytes32 key) public {
        f.setBytesStorage(txType, key, abi.encode(d_nonexitable));
    }

    function dummyFunctionForProxy() public {
        // do nothing, only to estimate cost of proxy from framework
    }
}