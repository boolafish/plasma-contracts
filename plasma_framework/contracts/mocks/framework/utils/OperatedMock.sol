pragma solidity 0.5.12;

import "../../../src/framework/utils/Operated.sol";

contract OperatedMock is Operated {
    bool public operatorCheckPassed;

    constructor() public {
        operatorCheckPassed = false;
    }

    function checkOnlyOperator() public onlyOperator {
        operatorCheckPassed = true;
    }
}
