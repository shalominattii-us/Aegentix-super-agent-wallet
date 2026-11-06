import { readRelayConfig } from './alphaOneContract.ts';

const report = {
  ...readRelayConfig(process.env),
  networkCalled: false,
  command: 'coinbase-spot:alpha-one-status',
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(0);
