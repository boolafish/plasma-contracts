pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Models.sol";

contract Framework {
    address private operator;

    mapping(uint256 => address) private idToApp;
    mapping(address => uint256) private appToId;
    mapping(bytes32 => bytes) private bytesStorage;

    Models.QueueData[] private queue;
    uint256 queueIndex = 0;

    constructor() public {
        operator = msg.sender;
    }

    function register(uint256 _appId, address _appContract) public {
        require(msg.sender == operator, "App can be registered only by operator.");
        idToApp[_appId] = _appContract;
        appToId[_appContract] = _appId;
    }

    function getBytesStorage(uint256 _appId, bytes32 _key) external view returns (bytes memory) {
        bytes32 key = keccak256(abi.encodePacked(_appId, _key));
        return bytesStorage[key];
    }

    function setBytesStorage(uint256 _appId, bytes32 _key, bytes calldata _value) external {
        require(appToId[msg.sender] == _appId, "App contract mismatch with the id that it is accessing.");
        bytes32 key = keccak256(abi.encodePacked(_appId, _key));
        bytesStorage[key] = _value;
    }

    function deposit(uint256 _amount) public payable {
        require(_amount == msg.value, "Deposit amount mismatch with msg.value");
    }

    function withdrawFromApp(uint256 _amount, address payable _withdrawTo) public {
        require(appToId[msg.sender] != 0, "Can be only accessed by apps");
        _withdrawTo.transfer(_amount);
    }

    function enqueueWithdraw(Models.QueueData memory _queueData) public {
        require(appToId[msg.sender] != 0, "Can be only accessed by apps");
        queue.push(_queueData);
    }

    function processQueue() public {
        while(queueIndex < queue.length) {
            Models.QueueData memory data = queue[queueIndex];
            data.app.processWithdraw(data.withdrawId);
            queueIndex ++;
        }
    }

    function proxy(uint256 _appId, bytes memory _encodedFunctionData) public {
        address proxyTo = idToApp[_appId];
        (bool success, bytes memory data) = proxyTo.call(_encodedFunctionData);
        require(success, string(abi.encodePacked("proxy contract failed with data: [ ", string(data), " ]")));
    }
}
