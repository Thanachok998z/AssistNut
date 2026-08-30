const assert = require('node:assert/strict');
const { meterConfirmationFlex } = require('../src/electricity/flex');

const message = meterConfirmationFlex({
  meterReading: 1234.5,
  previousReading: 1200,
  usage: 34.5,
  createdAt: new Date('2026-08-30T11:18:00.000Z')
});

assert.equal(message.type, 'flex');
assert.equal(message.contents.type, 'bubble');
assert.equal(message.contents.footer.contents[0].action.data, 'action=cancel_meter_test');
assert.equal(message.contents.footer.contents[1].action.data, 'action=confirm_meter_test');
JSON.stringify(message);
