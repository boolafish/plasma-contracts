const Framework = artifacts.require("Framework");
const AppAbiV2 = artifacts.require("AppAbiV2");
const App = artifacts.require("App");

contract("AppAbiV2", accounts => {
    let framework;
    let app;
    let baseCost;

    const key = web3.utils.soliditySha3("key");
    
    beforeEach(async () => {
        framework = await Framework.new();
        app = await AppAbiV2.new(framework.address);
        const tx = await framework.dummy();
        baseCost = tx.receipt.gasUsed;
    });

    describe("Using struct data and ABIEncoderV2", () => {
        it("save struct data to framework storage for the first time", async () => {
            const tx = await app.saveStructToFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("save same struct data to the same slot the second time", async () => {
            await app.saveStructToFramework(key);
            const tx = await app.saveStructToFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("save struct data with different flag to the same slot", async () => {
            await app.saveStructToFramework(key);
            const tx = await app.saveStructToFrameworkWithDifferentFlagValue(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("get struct data from framework storage", async () => {
            await app.saveStructToFramework(key);
            const tx = await app.getStructFromFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });

        it("proxies from framework to app", async () => {
            const proxyData = web3.eth.abi.encodeFunctionCall({
                name: 'dummyFunctionForProxy',
                type: 'function',
                inputs: []
            }, []);
            const tx = await framework.proxy(proxyData, app.address);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    });
});

contract("APP", async () => {
    let framework;
    let app;
    let baseCost;

    const key = web3.utils.soliditySha3("key");
    
    beforeEach(async () => {
        framework = await Framework.new();
        app = await App.new(framework.address);
        const tx = await framework.dummy();
        baseCost = tx.receipt.gasUsed;
    });

    describe("Using native data without ABIEncoderV2", () => {
        it("save data to framework storage for the first time", async () => {
            const tx = await app.saveDataToFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("save same data to the same slot the second time", async () => {
            await app.saveDataToFramework(key);
            const tx = await app.saveDataToFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("save data with different flag to the same slot", async () => {
            await app.saveDataToFramework(key);
            const tx = await app.saveDataToFrameworkWithDifferentFlagValue(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    
        it("get data from framework storage", async () => {
            await app.saveDataToFramework(key);
            const tx = await app.getDataFromFramework(key);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`);
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });

        it("proxies from framework to app", async () => {
            const proxyData = web3.eth.abi.encodeFunctionCall({
                name: 'dummyFunctionForProxy',
                type: 'function',
                inputs: []
            }, []);
            const tx = await framework.proxy(proxyData, app.address);
            console.log(`Total gas used: ${tx.receipt.gasUsed}`); 
            console.log(`Execution gas: ${tx.receipt.gasUsed - baseCost}`);
        });
    });
});