export class SpotError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SpotError';
  }
}

export class NetworkDisabledError extends SpotError {
  constructor(message = 'Live Coinbase HTTP is not implemented in this build.') {
    super('NETWORK_DISABLED', message);
    this.name = 'NetworkDisabledError';
  }
}

export class LiveSubmissionDisabledError extends SpotError {
  constructor() {
    super(
      'LIVE_SUBMISSION_DISABLED',
      'This build cannot submit, sign over the network, or spend holdings. Order placement stays unavailable until a later explicit arming change.',
    );
    this.name = 'LiveSubmissionDisabledError';
  }
}
