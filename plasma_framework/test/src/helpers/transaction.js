const rlp = require('rlp');

const NullData = '\00'.repeat(32);
const TransactionTypes = {
  PlasmaDeposit: 1
}


class TransactionOutput {
  constructor(amount, owner, token) {
    this.amount = amount;
    this.outputGuard = owner;
    this.token = token;
  }

  formatForRlpEncoding() {
    return [this.amount, this.outputGuard, this.token]
  }
}

class Transaction {
  constructor(transactionType, inputs, outputs, metaData = NullData) {
    this.transactionType = transactionType;
    this.inputs = inputs;
    this.outputs = outputs;
    this.metaData = metaData;
  }

  rlpEncoded() {
    const tx = [this.transactionType];

    tx.push(this.inputs);
    tx.push(Transaction.formatForRlpEncoding(this.outputs));
    tx.push(this.metaData);

    return rlp.encode(tx);
  }

  static formatForRlpEncoding(items) {
    return items.map(item => item.formatForRlpEncoding());
  }
}

class PlasmaDepositTransaction extends Transaction {
  constructor(outputs, metaData = NullData) {
    super(TransactionTypes.PlasmaDeposit, [0], outputs, metaData);
  }
}

module.exports.PlasmaDepositTransaction = PlasmaDepositTransaction
module.exports.TransactionOutput = TransactionOutput
