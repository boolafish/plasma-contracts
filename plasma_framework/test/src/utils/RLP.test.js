const rlp = require('rlp');
const { expect } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');

const RLPMock = artifacts.require('RLPMock');

contract('RLP', () => {
    before(async () => {
        this.test = await RLPMock.new();
    });

    it('should decode bytes32', async () => {
        const expected = Buffer.alloc(32, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes32(encoded)),
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it('should decode bytes20', async () => {
        const expected = Buffer.alloc(20, 1);

        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = Buffer.from(
            web3.utils.hexToBytes(await this.test.decodeBytes20(encoded)),
        );
        expect(actual.compare(expected)).to.equal(0);
    });

    it('should not decode an invalid length address', async () => {
        const expected = '0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c00';
        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        await expectRevert(this.test.decodeBytes20(encoded), 'Item length must be 21');
    });

    it('should decode uint 0', async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it('should decode uint 0', async () => {
        await testNumberDecoded(this.test.decodeUint, 0);
    });

    it('should decode positive uint', async () => {
        await testNumberDecoded(this.test.decodeUint, 100);
    });

    it('should decode 0x00', async () => {
        const encoded = '0x00';
        const callback = this.test.decodeUint;
        const actual = (await callback(encoded)).toNumber();
        expect(actual).is.equal(0);
    });

    it('should decode positive int', async () => {
        await testNumberDecoded(this.test.decodeInt, 100);
    });

    async function testNumberDecoded(callback, expected) {
        const encoded = web3.utils.bytesToHex(rlp.encode(expected));
        const actual = (await callback(encoded)).toNumber();
        expect(actual).is.equal(expected);
    }

    it('should decode array', async () => {
        const array = [[Buffer.alloc(32, 1)]];
        const encoded = web3.utils.bytesToHex(rlp.encode(array));
        const decoded = await this.test.decodeList(encoded);
        expect(decoded.length).is.equal(array.length);
    });
});
