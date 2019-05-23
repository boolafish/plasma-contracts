const Framework = artifacts.require("Framework");
const App = artifacts.require("UserVerifyApp");

contract("Framework and UserVerifyApp", accounts => {
    let framework;
    let app;
    
    beforeEach(async () => {
        framework = await Framework.new();

        appOperator = accounts[1];
        app = await App.new(framework.address, {from: appOperator});
    });

    it("Example workflow of the framework", async () => {
        console.log("Register UserVerifyApp to framework....");
        await framework.register(1, app.address);

        console.log("Desposit to framework....");
        const depositAmount = 2000;
        await framework.deposit(depositAmount, {value: depositAmount});

        console.log("App operator allows user to withdraw....");
        const withdrawAmount = 1000;
        const user = accounts[2];
        const allowWithdraw = web3.eth.abi.encodeFunctionCall({
            name: 'allowWithdraw',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: '_amount'
            },{
                type: 'address',
                name: '_user'
            }]
        }, [withdrawAmount, user]);
        await framework.proxy(1, allowWithdraw, {from: appOperator});

        console.log("User verifies the withdraw...");
        const verifyByUser = web3.eth.abi.encodeFunctionCall({
            name: 'verifyByUser',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: '_amount'
            }, {
                type: 'address',
                name: '_user'
            }]
        }, [withdrawAmount, user]);
        await framework.proxy(1, verifyByUser, {from: user});

        console.log("Somebody asks for process the withdraw queue....");
        await framework.processQueue();
    });
});