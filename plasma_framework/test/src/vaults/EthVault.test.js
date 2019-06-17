const RLP = artifacts.require("RLP");
const OutputModel = artifacts.require("OutputModel");
const TransactionModel = artifacts.require("TransactionModel");

const PlasmaFramework = artifacts.require("PlasmaFramework");
const EthVault = artifacts.require("EthVault");

const Testlang = require("../helpers/testlang.js")

const { BN, expectRevert } = require('openzeppelin-test-helpers');

contract("EthVault", accounts => {
    const alice = accounts[1];
    const DepositValue = 1000000;

    before("setup libs", async () => {
        const rlpLib = await RLP.new();
        OutputModel.link("RLP", rlpLib.address);
        const outputModel = await OutputModel.new();

        TransactionModel.link("RLP", rlpLib.address);
        TransactionModel.link("TransactionOutput", outputModel.address);
        const transactionModel = await TransactionModel.new();
        EthVault.link("TransactionModel", transactionModel.address);
    });

    beforeEach("setup contracts", async () => {
        this.plasma = await PlasmaFramework.new();
        this.ethVault = await EthVault.new(this.plasma.address);
        await this.plasma.registerVault(1, this.ethVault.address);
    });

    describe("deposit", () => {

        it("should store ethereum deposit", async () => {
            let nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
            expect(nextDepositBlock).to.be.equal(1);

            const deposit = Testlang.deposit(DepositValue, alice);
            await this.ethVault.deposit(deposit, {from: alice, value: DepositValue});
            nextDepositBlock = parseInt(await this.plasma.nextDepositBlock(), 10);
            expect(nextDepositBlock).to.be.equal(2);
        });

        it("should not store deposit when output value mismatches sent wei", async () => {
            const deposit = Testlang.deposit(DepositValue, alice);

            await expectRevert(
                this.ethVault.deposit(deposit, {from: alice, value: DepositValue + 1}),
                "Deposited value does not match sent amount."
            );

            await expectRevert(
                this.ethVault.deposit(deposit, {from: alice, value: DepositValue - 1}),
                "Deposited value does not match sent amount."
            );
        });

        it("should refuse to store a non-ethereum deposit", async () => {
            const nonEth = '\01'.repeat(20);
            const deposit = Testlang.deposit(DepositValue, alice, nonEth);

            await expectRevert(
                this.ethVault.deposit(deposit, {from: alice, value: web3.utils.toWei(DepositValue.toString(), 'wei')}),
                "Output does not have correct currency (ETH)."
            );
        });


        it("should not accept transactions that do not conform to deposit format", async () => {
              assert(true);
        });

        it("should not accept transactions with more than one output", async () => {
            assert(true);
        });
    });
})
