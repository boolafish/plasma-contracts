pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Framework.sol";
import "./AppInterface.sol";
import "./Models.sol";

contract UserVerifyApp is AppInterface {
    struct Data {
        address payable user;
        uint256 amount;
    }

    uint256 constant APP_ID = 1;
    address private operator;
    Framework framework;

    constructor(address _frameworkAddress) public {
        framework = Framework(_frameworkAddress);
        operator = msg.sender;
    }

    function allowWithdraw(uint256 _amount, address payable _user) external {
        //require(operator == msg.sender, "can be set by operator of the app only");
        require(_amount > 0, "amount to withdraw should be positive");

        Data memory data = Data(_user, _amount);
        framework.setBytesStorage(APP_ID, keccak256(abi.encodePacked(_user)), abi.encode(data));
    }

    function verifyByUser(uint256 _amount, address _user) external {
        bytes32 key = keccak256(abi.encodePacked(_user));
        bytes memory dataBytes = framework.getBytesStorage(APP_ID, key);
        Data memory data = abi.decode(dataBytes, (Data));

        require(data.amount > 0, "withdraw of the user is not set by the app operator yet");
        require(data.amount == _amount, "the allowed amount should be same as the amount to verifiy");
        //require(data.user == msg.sender, "the user mismatch with the data");
        //require(_user == data.user, "the user mismatch with the input");

        framework.enqueueWithdraw(Models.QueueData(this, key));
    }

    function processWithdraw(bytes32 _withdrawId) external {
        require(msg.sender == address(framework), "Can be only processed by framework");

        bytes memory dataBytes = framework.getBytesStorage(APP_ID, _withdrawId);
        Data memory data = abi.decode(dataBytes, (Data));

        framework.withdrawFromApp(data.amount, data.user);
    }
}