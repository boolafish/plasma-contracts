const PaymentInFlightExitRouter = artifacts.require('PaymentInFlightExitRouterMock');
const PaymentStartInFlightExit = artifacts.require('PaymentStartInFlightExit');
const PaymentChallengeIFENotCanonical = artifacts.require('PaymentChallengeIFENotCanonical');
const PaymentSpendingConditionRegistry = artifacts.require('PaymentSpendingConditionRegistry');
const PaymentSpendingConditionFalse = artifacts.require('PaymentSpendingConditionFalse');
const PaymentSpendingConditionTrue = artifacts.require('PaymentSpendingConditionTrue');
const SpyPlasmaFramework = artifacts.require('SpyPlasmaFrameworkForExitGame');
const ExitId = artifacts.require('ExitIdWrapper');
const IsDeposit = artifacts.require('IsDepositWrapper');
const ExitableTimestamp = artifacts.require('ExitableTimestampWrapper');

const {
    BN, constants, expectEvent, expectRevert, time,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const { MerkleTree } = require('../../../helpers/merkle.js');
const { buildUtxoPos, UtxoPos } = require('../../../helpers/positions.js');
const {
    addressToOutputGuard, computeNormalOutputId, spentOnGas,
} = require('../../../helpers/utils.js');
const { PaymentTransactionOutput, PaymentTransaction, PlasmaDepositTransaction } = require('../../../helpers/transaction.js');

contract('PaymentInFlightExitRouter', ([_, alice, bob, carol]) => {
    const IN_FLIGHT_EXIT_BOND = 31415926535; // wei
    const ETH = constants.ZERO_ADDRESS;
    const OTHER_TOKEN = '0x0000000000000000000000000000000000000001';
    const CHILD_BLOCK_INTERVAL = 1000;
    const MIN_EXIT_PERIOD = 60 * 60 * 24 * 7; // 1 week
    const DUMMY_INITIAL_IMMUNE_VAULTS_NUM = 0;
    const INITIAL_IMMUNE_EXIT_GAME_NUM = 1;
    const OUTPUT_TYPE_ZERO = 0;
    const IFE_TX_TYPE = 1;
    const WITNESS_LENGTH_IN_BYTES = 65;
    const INCLUSION_PROOF_LENGTH_IN_BYTES = 512;
    const IN_FLIGHT_TX_WITNESS_BYTES = web3.utils.bytesToHex('a'.repeat(WITNESS_LENGTH_IN_BYTES));
    const BLOCK_NUMBER = 1000;
    const DEPOSIT_BLOCK_NUMBER = BLOCK_NUMBER + 1;
    const DUMMY_INPUT_1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const DUMMY_INPUT_2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const MERKLE_TREE_HEIGHT = 3;
    const AMOUNT = 10;
    const TOLERANCE_SECONDS = new BN(1);

    before('deploy and link with controller lib', async () => {
        const startInFlightExit = await PaymentStartInFlightExit.new();
        const challengeInFlightExitNotCanonical = await PaymentChallengeIFENotCanonical.new();

        await PaymentInFlightExitRouter.link('PaymentStartInFlightExit', startInFlightExit.address);
        await PaymentInFlightExitRouter.link('PaymentChallengeIFENotCanonical', challengeInFlightExitNotCanonical.address);
    });

    describe('startInFlightExit', () => {
        function isDeposit(blockNum) {
            return blockNum % CHILD_BLOCK_INTERVAL !== 0;
        }

        function buildValidIfeStartArgs(amount, [ifeOwner, inputOwner1, inputOwner2], blockNum1, blockNum2) {
            const inputTx1 = isDeposit(blockNum1)
                ? createDepositTransaction(inputOwner1, amount)
                : createInputTransaction(DUMMY_INPUT_1, inputOwner1, amount);

            const inputTx2 = isDeposit(blockNum2)
                ? createDepositTransaction(inputOwner2, amount)
                : createInputTransaction(DUMMY_INPUT_2, inputOwner2, amount);

            const inputTxs = [inputTx1, inputTx2];

            const inputUtxosPos = [buildUtxoPos(blockNum1, 0, 0), buildUtxoPos(blockNum2, 0, 0)];

            const inFlightTx = createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount);
            const {
                args,
                inputTxsBlockRoot1,
                inputTxsBlockRoot2,
            } = buildIfeStartArgs(inputTxs, inputUtxosPos, inFlightTx);

            const argsDecoded = { inputTxs, inputUtxosPos, inFlightTx };

            return {
                args,
                argsDecoded,
                inputTxsBlockRoot1,
                inputTxsBlockRoot2,
            };
        }

        function buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx) {
            const rlpInputTx1 = inputTx1.rlpEncoded();
            const encodedInputTx1 = web3.utils.bytesToHex(rlpInputTx1);

            const rlpInputTx2 = inputTx2.rlpEncoded();
            const encodedInputTx2 = web3.utils.bytesToHex(rlpInputTx2);

            const inputTxs = [encodedInputTx1, encodedInputTx2];

            const merkleTree1 = new MerkleTree([encodedInputTx1], MERKLE_TREE_HEIGHT);
            const merkleTree2 = new MerkleTree([encodedInputTx2], MERKLE_TREE_HEIGHT);
            const inclusionProof1 = merkleTree1.getInclusionProof(encodedInputTx1);
            const inclusionProof2 = merkleTree2.getInclusionProof(encodedInputTx2);

            const inputTxsInclusionProofs = [inclusionProof1, inclusionProof2];

            const inputUtxosTypes = [OUTPUT_TYPE_ZERO, OUTPUT_TYPE_ZERO];

            const inFlightTxRaw = web3.utils.bytesToHex(inFlightTx.rlpEncoded());

            const inFlightTxWitnesses = [IN_FLIGHT_TX_WITNESS_BYTES, IN_FLIGHT_TX_WITNESS_BYTES];

            const args = {
                inFlightTx: inFlightTxRaw,
                inputTxs,
                inputUtxosPos,
                inputUtxosTypes,
                inputTxsInclusionProofs,
                inFlightTxWitnesses,
            };

            const inputTxsBlockRoot1 = merkleTree1.root;
            const inputTxsBlockRoot2 = merkleTree2.root;

            return { args, inputTxsBlockRoot1, inputTxsBlockRoot2 };
        }

        function createInputTransaction(inputs, owner, amount, token = ETH) {
            const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), token);
            return new PaymentTransaction(IFE_TX_TYPE, inputs, [output]);
        }

        function createDepositTransaction(owner, amount, token = ETH) {
            const output = new PaymentTransactionOutput(amount, addressToOutputGuard(owner), token);
            return new PlasmaDepositTransaction(output);
        }

        function createInFlightTx(inputTxs, inputUtxosPos, ifeOwner, amount, token = ETH) {
            const inputs = createInputsForInFlightTx(inputTxs, inputUtxosPos);

            const output = new PaymentTransactionOutput(
                amount * inputTxs.length,
                addressToOutputGuard(ifeOwner),
                token,
            );

            return new PaymentTransaction(1, inputs, [output]);
        }

        function createInputsForInFlightTx(inputTxs, inputUtxosPos) {
            const inputs = [];
            for (let i = 0; i < inputTxs.length; i++) {
                const inputUtxoPos = new UtxoPos(inputUtxosPos[i]);
                const inputTx = web3.utils.bytesToHex(inputTxs[i].rlpEncoded());
                const outputId = computeNormalOutputId(inputTx, inputUtxoPos.outputIndex);
                inputs.push(outputId);
            }
            return inputs;
        }

        function expectInput(input, inputTx) {
            expect(new BN(input.amount)).to.be.bignumber.equal(new BN(inputTx.outputs[0].amount));
            expect(input.outputGuard.toUpperCase()).to.equal(inputTx.outputs[0].outputGuard.toUpperCase());
            expect(input.token).to.equal(inputTx.outputs[0].token);
        }

        function expectOutputNotSet(output) {
            // output is not set when amount equals 0
            expect(new BN(output.amount)).to.be.bignumber.equal(new BN(0));
        }

        before(async () => {
            this.exitIdHelper = await ExitId.new();
            this.isDeposit = await IsDeposit.new(CHILD_BLOCK_INTERVAL);
            this.exitableHelper = await ExitableTimestamp.new(MIN_EXIT_PERIOD);
        });

        describe('when calling in-flight exit start with valid arguments', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();

                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address, this.spendingConditionRegistry.address,
                );

                const {
                    args,
                    argsDecoded,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                this.args = args;
                this.argsDecoded = argsDecoded;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );
            });

            it('should store in-flight exit data', async () => {
                const ethBlockTime = await time.latest();
                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );
                const exitId = await this.exitIdHelper.getInFlightExitId(this.args.inFlightTx);

                const exit = await this.exitGame.inFlightExits(exitId);

                expect(exit.bondOwner).to.equal(alice);
                expect(new BN(exit.oldestCompetitorPosition)).to.be.bignumber.equal(new BN(0));
                expect(new BN(exit.exitStartTimestamp)).to.be.bignumber.closeTo(ethBlockTime, TOLERANCE_SECONDS);
                expect(new BN(exit.exitMap)).to.be.bignumber.equal(new BN(0));

                const youngestInput = this.argsDecoded.inputUtxosPos[1];
                expect(new BN(exit.position)).to.be.bignumber.equal(new BN(youngestInput));

                const input1 = await this.exitGame.getInFlightExitInput(exitId, 0);
                expectInput(input1, this.argsDecoded.inputTxs[0]);

                const input2 = await this.exitGame.getInFlightExitInput(exitId, 1);
                expectInput(input2, this.argsDecoded.inputTxs[1]);

                // outputs should be empty, they will be initialized on piggybacks
                const output = await this.exitGame.getInFlightExitOutput(exitId, 0);
                expectOutputNotSet(output);
            });

            it('should emit InFlightExitStarted event', async () => {
                const { receipt } = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );

                const expectedIfeHash = web3.utils.sha3(this.args.inFlightTx);

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentStartInFlightExit,
                    'InFlightExitStarted',
                    {
                        initiator: alice,
                        txHash: expectedIfeHash,
                    },
                );
            });

            it('should charge user with a bond', async () => {
                const preBalance = new BN(await web3.eth.getBalance(alice));
                const tx = await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );
                const actualPostBalance = new BN(await web3.eth.getBalance(alice));
                const expectedPostBalance = preBalance
                    .sub(new BN(IN_FLIGHT_EXIT_BOND))
                    .sub(await spentOnGas(tx.receipt));

                expect(actualPostBalance).to.be.bignumber.equal(expectedPostBalance);
            });
        });

        describe('when in-flight exit start is called', () => {
            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address, this.spendingConditionRegistry.address,
                );
            });

            it('should fail when spending condition not registered', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition contract not found',
                );
            });

            it('should fail when spending condition not satisfied', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionFalse.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Spending condition failed',
                );
            });

            it('should fail when not called with a valid exit bond', async () => {
                const invalidExitBond = IN_FLIGHT_EXIT_BOND - 1;
                await expectRevert(
                    this.exitGame.startInFlightExit(this.args, { from: alice, value: invalidExitBond }),
                    'Input value mismatches with msg.value',
                );
            });

            it('should fail when the same in-flight exit is already started', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when the same in-flight exit is already finalized', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND });

                const exitId = await this.exitIdHelper.getInFlightExitId(args.inFlightTx);
                await this.exitGame.finalizeExit(exitId);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'There is an active in-flight exit from this transaction',
                );
            });

            it('should fail when any of input transactions is not included in a plasma block', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );
                const invalidInclusionProof = web3.utils.bytesToHex('a'.repeat(INCLUSION_PROOF_LENGTH_IN_BYTES));
                args.inputTxsInclusionProofs = [invalidInclusionProof, invalidInclusionProof];
                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Input transaction is not included in plasma',
                );
            });

            it('should fail when there are no input transactions provided', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxs = [];
                args.inputUtxosPos = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input transactions does not match number of input utxos positions', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createDepositTransaction(bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of provided input utxos positions.',
                );
            });

            it('should fail when number of input transactions does not match in-flight transactions number of inputs', async () => {
                const inputTx1 = createInputTransaction(DUMMY_INPUT_1, alice, AMOUNT);
                const inputTx2 = createDepositTransaction(bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 1, 0)];
                const inFlightTx = createInFlightTx([inputTx1], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of witnesses does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inFlightTxWitnesses = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input transactions witnesses does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of merkle inclusion proofs does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputTxsInclusionProofs = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Number of input transactions inclusion proofs does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when number of input utxos types does not match in-flight transactions number of inputs', async () => {
                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildValidIfeStartArgs(AMOUNT, [alice, bob, carol], BLOCK_NUMBER, DEPOSIT_BLOCK_NUMBER);
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(DEPOSIT_BLOCK_NUMBER, inputTxsBlockRoot2, 0);
                args.inputUtxosTypes = [];

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    ' Number of input utxo types does not match number of in-flight transaction inputs.',
                );
            });

            it('should fail when in-flight transaction with single token inputs/outputs overspends', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createInputTransaction([DUMMY_INPUT_2], bob, AMOUNT);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER * 2, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx1, inputTx2], inputUtxosPos, carol, AMOUNT * 3);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight transaction with multiple tokens inputs/outputs overspends', async () => {
                const inputTx1 = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputTx2 = createInputTransaction([DUMMY_INPUT_2], bob, AMOUNT, OTHER_TOKEN);

                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER * 2, 0, 0)];
                const inputs = createInputsForInFlightTx([inputTx1, inputTx2], inputUtxosPos);

                const output1 = new PaymentTransactionOutput(AMOUNT, addressToOutputGuard(carol), ETH);
                const invalidAmount = AMOUNT + 1;
                const output2 = new PaymentTransactionOutput(invalidAmount, addressToOutputGuard(carol), OTHER_TOKEN);

                const inFlightTx = new PaymentTransaction(IFE_TX_TYPE, inputs, [output1, output2]);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx1, inputTx2], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'Invalid transaction, spends more than provided in inputs',
                );
            });

            it('should fail when in-flight tx input transactions are not unique', async () => {
                const inputTx = createInputTransaction([DUMMY_INPUT_1], alice, AMOUNT);
                const inputUtxosPos = [buildUtxoPos(BLOCK_NUMBER, 0, 0), buildUtxoPos(BLOCK_NUMBER, 0, 0)];
                const inFlightTx = createInFlightTx([inputTx, inputTx], inputUtxosPos, carol, AMOUNT);

                const {
                    args,
                    inputTxsBlockRoot1,
                    inputTxsBlockRoot2,
                } = buildIfeStartArgs([inputTx, inputTx], inputUtxosPos, inFlightTx);

                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot1, 0);
                await this.framework.setBlock(BLOCK_NUMBER * 2, inputTxsBlockRoot2, 0);

                await expectRevert(
                    this.exitGame.startInFlightExit(args, { from: alice, value: IN_FLIGHT_EXIT_BOND }),
                    'In-flight transaction must have unique inputs',
                );
            });
        });

        describe('canonicity challenge', () => {
            function createCompetitorTransaction(ifeZeroInput, otherInput) {
                const competingTx = createInputTransaction([otherInput.utxoPos, ifeZeroInput], bob, AMOUNT);
                const competingTxPos = new UtxoPos(buildUtxoPos(otherInput.blockNum + CHILD_BLOCK_INTERVAL, 0, 0));

                return {
                    competingTx: web3.utils.bytesToHex(competingTx.rlpEncoded()),
                    decodedCompetingTx: competingTx,
                    competingTxPos,
                };
            }

            function createInclusionProof(encodedTx, txUtxoPos) {
                const merkleTree = new MerkleTree([encodedTx], MERKLE_TREE_HEIGHT);
                const competingTxInclusionProof = merkleTree.getInclusionProof(encodedTx);

                return {
                    competingTxInclusionProof,
                    blockHash: merkleTree.root,
                    blockNum: txUtxoPos.blockNum,
                    blockTimestamp: 1000,
                };
            }

            function createValidNoncanonicalChallengeArgs(decodedIfeTx) {
                const utxoPos = new UtxoPos(buildUtxoPos(BLOCK_NUMBER, 2, 2));
                const { competingTx, decodedCompetingTx, competingTxPos } = createCompetitorTransaction(
                    decodedIfeTx.inputs[0], utxoPos,
                );

                const {
                    competingTxInclusionProof, blockHash, blockNum, blockTimestamp,
                } = createInclusionProof(
                    competingTx, competingTxPos,
                );

                const competingTxWitness = addressToOutputGuard(bob);

                return {
                    args: {
                        inFlightTx: web3.utils.bytesToHex(decodedIfeTx.rlpEncoded()),
                        inFlightTxInputIndex: 0,
                        competingTx,
                        competingTxInputIndex: 1,
                        competingTxInputOutputType: OUTPUT_TYPE_ZERO,
                        competingTxPos: competingTxPos.utxoPos,
                        competingTxInclusionProof,
                        competingTxWitness,
                    },
                    block: {
                        blockHash, blockNum, blockTimestamp,
                    },
                    decodedCompetingTx,
                };
            }

            beforeEach(async () => {
                this.framework = await SpyPlasmaFramework.new(
                    MIN_EXIT_PERIOD, DUMMY_INITIAL_IMMUNE_VAULTS_NUM, INITIAL_IMMUNE_EXIT_GAME_NUM,
                );
                this.spendingConditionRegistry = await PaymentSpendingConditionRegistry.new();
                this.exitGame = await PaymentInFlightExitRouter.new(
                    this.framework.address, this.spendingConditionRegistry.address,
                );

                const { args, argsDecoded, inputTxsBlockRoot } = buildValidIfeStartArgs(
                    AMOUNT, [alice, bob, carol], BLOCK_NUMBER,
                );
                this.args = args;
                this.argsDecoded = argsDecoded;
                await this.framework.setBlock(BLOCK_NUMBER, inputTxsBlockRoot, 0);

                const conditionTrue = await PaymentSpendingConditionTrue.new();

                await this.spendingConditionRegistry.registerSpendingCondition(
                    OUTPUT_TYPE_ZERO, IFE_TX_TYPE, conditionTrue.address,
                );

                await this.exitGame.startInFlightExit(
                    this.args,
                    { from: alice, value: IN_FLIGHT_EXIT_BOND },
                );

                const {
                    args: cArgs, block, decodedCompetingTx,
                } = createValidNoncanonicalChallengeArgs(this.argsDecoded.inFlightTx);

                this.challengeArgs = cArgs;
                this.competingTx = decodedCompetingTx;
                this.competingTxBlock = block;
            });

            it('should successfully challenge ife', async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                const { receipt } = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: alice },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger: alice,
                        txHash: web3.utils.sha3(this.args.inFlightTx),
                        challengeTxPosition: new BN(this.challengeArgs.competingTxPos),
                    },
                );
            });

            it('fails when competing tx is the same as in-flight one', async () => {
                this.challengeArgs.competingTx = this.challengeArgs.inFlightTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'The competitor transaction is the same as transaction in-flight',
                );
            });

            it('fails when first phase is over', async () => {
                await time.increase((MIN_EXIT_PERIOD / 2) + 1);

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Canonicity challege phase for this exit has ended',
                );
            });

            it('fails when competing tx is not included in the given position', async () => {
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Transaction is not included in block of plasma chain.',
                );
            });

            it('fails when ife not started', async () => {
                this.challengeArgs.inFlightTx = this.challengeArgs.competingTx;

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    "In-fligh exit doesn't exists",
                );
            });

            it('fails when spending condition is not met', async () => {
                const newOutputType = OUTPUT_TYPE_ZERO + 1;

                const conditionFalse = await PaymentSpendingConditionFalse.new();
                await this.spendingConditionRegistry.registerSpendingCondition(
                    newOutputType, IFE_TX_TYPE, conditionFalse.address,
                );

                this.challengeArgs.competingTxInputOutputType = newOutputType;
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing input spending condition is not met',
                );
            });

            it('fails when competing tx is younger than already known competitor', async () => {
                // challenge ife as previously
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice });

                // then mine the next block - with the same root hash
                const nextBlockNum = this.competingTxBlock.blockNum + CHILD_BLOCK_INTERVAL;
                const nextBlockTimestamp = this.competingTxBlock.blockTimestamp + 1000;
                const nextCompetitorPos = buildUtxoPos(nextBlockNum, 0, 0);

                await this.framework.setBlock(
                    nextBlockNum, this.competingTxBlock.blockHash, nextBlockTimestamp,
                );

                // try to challenge again with competitor from the lastly mined block
                this.challengeArgs.competingTxPos = nextCompetitorPos;
                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it('fails when challenge with the same competing tx twice', async () => {
                await this.framework.setBlock(
                    this.competingTxBlock.blockNum,
                    this.competingTxBlock.blockHash,
                    this.competingTxBlock.blockTimestamp,
                );

                await this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice });

                await expectRevert(
                    this.exitGame.challengeInFlightExitNotCanonical(this.challengeArgs, { from: alice }),
                    'Competing transaction is not older than already known competitor',
                );
            });

            it.only('should set large competitor position when competitor is in-flight', async () => {
                this.challengeArgs.competingTxPos = 0;
                this.challengeArgs.competingTxInclusionProof = '0x';

                // it seems to be solidity `~uint256(0)` - what is important here: it's HUGE
                const expectedCompetitorPos = new BN(2).pow(new BN(256)).sub(new BN(1));

                const { receipt } = await this.exitGame.challengeInFlightExitNotCanonical(
                    this.challengeArgs, { from: alice },
                );

                await expectEvent.inTransaction(
                    receipt.transactionHash,
                    PaymentChallengeIFENotCanonical,
                    'InFlightExitChallenged',
                    {
                        challenger: alice,
                        txHash: web3.utils.sha3(this.args.inFlightTx),
                        challengeTxPosition: expectedCompetitorPos,
                    },
                );
            });
        });
    });
});
