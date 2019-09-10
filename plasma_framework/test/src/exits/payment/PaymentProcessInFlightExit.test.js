/* eslint no-bitwise: ["error", { "allow": ["|"] }] */

const ERC20Mintable = artifacts.require('ERC20Mintable');
const OutputGuardHandlerRegistry = artifacts.require('OutputGuardHandlerRegistry');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentPiggybackInFlightExit = artifacts.require('PaymentPiggybackInFlightExit');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentProcessInFlightExit = artifacts.require('PaymentProcessInFlightExit');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const SpyEthVault = artifacts.require('SpyEthVaultForExitGame');
const SpyErc20Vault = artifacts.require('SpyErc20VaultForExitGame');
const StateTransitionVerifierAccept = artifacts.require('StateTransitionVerifierAccept');

const {
    BN, constants, expectEvent, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { TX_TYPE, PROTOCOL } = require('../../../helpers/constants.js');
const { buildUtxoPos } = require('../../../helpers/positions.js');

contract('PaymentInFlightExitRouter', ([_, ifeBondOwner, inputOwner1, inputOwner2, inputOwner3, outputOwner1, outputOwner2, outputOwner3]) => {
    const MAX_INPUT_NUM = 4;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week in seconds
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const DUMMY_IFE_BOND_SIZE = 31415926535; // wei
    const DUMMY_PIGGYBACK_BOND = 31415926534; // wei
    const TEST_INPUT_AMOUNT = 667;
    const TEST_OUTPUT_AMOUNT = 666;
    const TEST_OUTPUT_ID_FOR_INPUT_1 = web3.utils.sha3('dummy outputId of input 1');
    const TEST_OUTPUT_ID_FOR_INPUT_2 = web3.utils.sha3('dummy outputId of input 2');
    const TEST_OUTPUT_ID_FOR_INPUT_3 = web3.utils.sha3('dummy outputId of input 3');
    const TEST_OUTPUT_ID_FOR_OUTPUT_1 = web3.utils.sha3('dummy outputId of output 1');
    const TEST_OUTPUT_ID_FOR_OUTPUT_2 = web3.utils.sha3('dummy outputId of output 2');
    const TEST_OUTPUT_ID_FOR_OUTPUT_3 = web3.utils.sha3('dummy outputId of output 3');
    const YOUNGEST_POSITION_BLOCK = 1000;
    const INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION = buildUtxoPos(YOUNGEST_POSITION_BLOCK, 0, 0);
    const ETH = constants.ZERO_ADDRESS;
    let erc20;

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const piggybackInFlightExit = await PaymentPiggybackInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();
        const processInFlightExit = await PaymentProcessInFlightExit.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentPiggybackInFlightExit', piggybackInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
        await PaymentInFlightExitRouter.link('PaymentProcessInFlightExit', processInFlightExit.address);
    });

    before('deploy dummy and helper contracts', async () => {
        erc20 = (await ERC20Mintable.new()).address;
        this.stateTransitionVerifierAccept = await StateTransitionVerifierAccept.new();
    });

    /**
     * This builds in-flight exit data with three inputs and outputs.
     * First two inputs and outputs would be of ETH.
     * The third input and output would be of ERC20.
     */
    const buildInFlightExitData = async () => {
        const emptyWithdrawData = {
            outputId: web3.utils.sha3('dummy output id'),
            exitTarget: constants.ZERO_ADDRESS,
            token: constants.ZERO_ADDRESS,
            amount: 0,
            piggybackBondSize: DUMMY_PIGGYBACK_BOND,
        };

        const inFlightExitData = {
            exitStartTimestamp: (await time.latest()).toNumber(),
            exitMap: 0,
            position: INFLIGHT_EXIT_YOUNGEST_INPUT_POSITION,
            bondOwner: ifeBondOwner,
            bondSize: DUMMY_IFE_BOND_SIZE,
            oldestCompetitorPosition: 0,
            inputs: [{
                outputId: TEST_OUTPUT_ID_FOR_INPUT_1,
                exitTarget: inputOwner1,
                token: ETH,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_2,
                exitTarget: inputOwner2,
                token: ETH,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_INPUT_3,
                exitTarget: inputOwner3,
                token: erc20,
                amount: TEST_INPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, emptyWithdrawData],
            outputs: [{
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_1,
                exitTarget: outputOwner1,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_2,
                exitTarget: outputOwner2,
                token: ETH,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, {
                outputId: TEST_OUTPUT_ID_FOR_OUTPUT_3,
                exitTarget: outputOwner3,
                token: erc20,
                amount: TEST_OUTPUT_AMOUNT,
                piggybackBondSize: DUMMY_PIGGYBACK_BOND,
            }, emptyWithdrawData],
        };

        return inFlightExitData;
    };

    describe.only('processInFlightExit', () => {
        beforeEach(async () => {
            this.framework = await SpyPlasmaFramework.new(
                MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
            );

            this.ethVault = await SpyEthVault.new(this.framework.address);
            this.erc20Vault = await SpyErc20Vault.new(this.framework.address);

            this.outputGuardHandlerRegistry = await OutputGuardHandlerRegistry.new();
            const spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

            this.exitGame = await PaymentInFlightExitRouter.new(
                this.framework.address,
                this.ethVault.address,
                this.erc20Vault.address,
                this.outputGuardHandlerRegistry.address,
                spendingConditionRegistry.address,
                this.stateTransitionVerifierAccept.address,
                TX_TYPE.PAYMENT,
            );
            this.framework.registerExitGame(TX_TYPE.PAYMENT, this.exitGame.address, PROTOCOL.MORE_VP);
            const maxNeededBond = DUMMY_IFE_BOND_SIZE + DUMMY_PIGGYBACK_BOND * 4;
            await this.exitGame.depositFundForTest({ value: maxNeededBond });
        });

        it('should omit the exit if the exit does not exist', async () => {
            const nonExistingExitId = 666;

            const { receipt } = await this.exitGame.processExit(nonExistingExitId, ETH);
            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentProcessInFlightExit,
                'InFlightExitOmitted',
                { exitId: new BN(nonExistingExitId), token: ETH },
            );
        });

        it('should omit the exit if any input spent already', async () => {
            const exit = await buildInFlightExitData();
            const dummyExitId = 666;
            await this.exitGame.setInFlightExit(dummyExitId, exit);

            await this.exitGame.proxyFlagOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_1);

            const { receipt } = await this.exitGame.processExit(dummyExitId, ETH);
            await expectEvent.inTransaction(
                receipt.transactionHash,
                PaymentProcessInFlightExit,
                'InFlightExitOmitted',
                { exitId: new BN(dummyExitId), token: ETH },
            );
        });

        it('should not withdraw fund for the non-piggybacked input', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = false;

            // only piggyback on outputs
            exit.exitMap = 2 ** MAX_INPUT_NUM | 2 ** (MAX_INPUT_NUM + 1) | 2 ** (MAX_INPUT_NUM + 1);

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        it('should not withdraw fund for the non-piggybacked output', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = true;
            exit.exitMap = 2 ** 0 | 2 ** 1 | 2 ** 2; // only piggyback on inputs

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        it('should not withdraw fund if the output already spent', async () => {
            const dummyExitId = 666;
            const exit = await buildInFlightExitData();
            exit.isCanonical = true;

            // piggybacks the first output but flag it as spent
            exit.exitMap = 2 ** MAX_INPUT_NUM;
            await this.exitGame.proxyFlagOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_1);

            await this.exitGame.setInFlightExit(dummyExitId, exit);
            await this.exitGame.processExit(dummyExitId, ETH);

            const options = { fromBlock: 0, toBlock: 'latest' };
            const events = await this.ethVault.getPastEvents('EthWithdrawCalled', options);
            expect(events.length).to.equal(0);
        });

        describe('When any in-flight exit is processed successfully', () => {
            beforeEach(async () => {
                this.ifeBondOwnerPreBalance = new BN(await web3.eth.getBalance(ifeBondOwner));

                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();

                // piggybacks the first output for ETH and third for ERC20
                const firstOutputIndexInExitMap = MAX_INPUT_NUM + 0;
                const thirdOutputIndexInExitMap = MAX_INPUT_NUM + 2;
                this.exit.exitMap = (2 ** firstOutputIndexInExitMap) | (2 ** thirdOutputIndexInExitMap);

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);
                await this.exitGame.processExit(this.dummyExitId, ETH);
            });

            it('should NOT transfer exit bond to the IFE bond owner if not all piggybacked inputs/outputs are cleaned up', async () => {
                // erc20 remained un-processed, thus should not return the bond yet
                const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                expect(postBalance).to.be.bignumber.equal(this.ifeBondOwnerPreBalance);
            });

            it('should transfer exit bond to the IFE bond owner if all piggybacked inputs/outputs are cleaned up', async () => {
                await this.exitGame.processExit(this.dummyExitId, erc20);

                const postBalance = new BN(await web3.eth.getBalance(ifeBondOwner));
                const expectedBalance = this.ifeBondOwnerPreBalance.add(new BN(DUMMY_IFE_BOND_SIZE));

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should flag all inputs with the same token as spent', async () => {
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_1)).to.be.true;
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_INPUT_2)).to.be.true;
            });

            it('should flag all piggybacked outputs with the same token as spent', async () => {
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_1)).to.be.true;
            });

            it('should NOT flag non-piggybacked output with the same token as spent', async () => {
                expect(await this.framework.isOutputSpent(TEST_OUTPUT_ID_FOR_OUTPUT_2)).to.be.false;
            });

            it('should clean the piggyback flag of the inputs/outputs with same token', async () => {
                const exit = await this.exitGame.inFlightExits(this.dummyExitId);
                const thirdOutputIndexInExitMap = MAX_INPUT_NUM + 2;
                const exitMapWithErc20Outputs = 2 ** thirdOutputIndexInExitMap;
                expect(exit.exitMap).to.equal(exitMapWithErc20Outputs.toString());
            });
        });

        describe('When the exit is non canonical, and inputs are piggybacked', () => {
            beforeEach(async () => {
                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = false;

                // piggybackes all three inputs
                this.exit.exitMap = (2 ** 0) | (2 ** 1) | (2 ** 2);

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);

                this.inputOwner3PreBalance = new BN(await web3.eth.getBalance(inputOwner3));
            });

            it('should withdraw ETH from vault for the input', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, ETH);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: inputOwner1,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: inputOwner2,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );
            });

            it('should withdraw ERC20 from vault for the input', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, erc20);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyErc20Vault,
                    'Erc20WithdrawCalled',
                    {
                        target: inputOwner3,
                        token: erc20,
                        amount: new BN(TEST_INPUT_AMOUNT),
                    },
                );
            });

            it('should return piggyback bond to the input owner', async () => {
                await this.exitGame.processExit(this.dummyExitId, erc20);
                const postBalance = new BN(await web3.eth.getBalance(inputOwner3));
                const expectedBalance = this.inputOwner3PreBalance.add(new BN(DUMMY_PIGGYBACK_BOND));

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should emit InFlightExitInputWithdrawn event', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, erc20);
                const inputIndexForThirdInput = 2;
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentProcessInFlightExit,
                    'InFlightExitInputWithdrawn',
                    { exitId: new BN(this.dummyExitId), inputIndex: new BN(inputIndexForThirdInput) },
                );
            });
        });

        describe('When the exit is canonical, and outputs are piggybacked', () => {
            beforeEach(async () => {
                this.dummyExitId = 666;
                this.exit = await buildInFlightExitData();
                this.exit.isCanonical = true;

                // piggybackes all three outputs
                this.exit.exitMap = (2 ** MAX_INPUT_NUM) | (2 ** (MAX_INPUT_NUM + 1)) | (2 ** (MAX_INPUT_NUM + 2));

                await this.exitGame.setInFlightExit(this.dummyExitId, this.exit);

                this.outputOwner3PreBalance = new BN(await web3.eth.getBalance(outputOwner3));
            });

            it('should withdraw ETH from vault for the output', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, ETH);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: outputOwner1,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyEthVault,
                    'EthWithdrawCalled',
                    {
                        target: outputOwner2,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );
            });

            it('should withdraw ERC20 from vault for the output', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, erc20);
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    SpyErc20Vault,
                    'Erc20WithdrawCalled',
                    {
                        target: outputOwner3,
                        token: erc20,
                        amount: new BN(TEST_OUTPUT_AMOUNT),
                    },
                );
            });

            it('should return piggyback bond to the output owner', async () => {
                await this.exitGame.processExit(this.dummyExitId, erc20);
                const postBalance = new BN(await web3.eth.getBalance(outputOwner3));
                const expectedBalance = this.outputOwner3PreBalance.add(new BN(DUMMY_PIGGYBACK_BOND));

                expect(postBalance).to.be.bignumber.equal(expectedBalance);
            });

            it('should emit InFlightExitOutputWithdrawn event', async () => {
                const { receipt } = await this.exitGame.processExit(this.dummyExitId, erc20);
                const outputIndexForThirdOutput = 2;
                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentProcessInFlightExit,
                    'InFlightExitOutputWithdrawn',
                    { exitId: new BN(this.dummyExitId), outputIndex: new BN(outputIndexForThirdOutput) },
                );
            });
        });
    });
});
