import { Keypair } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Mock TransactionBuilder so no real XDR is built (avoids account-object
// constraints from the Horizon SDK while keeping Keypair / Asset / Operation
// intact for real key-generation and operation validation).
// ---------------------------------------------------------------------------
jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock StellarService — keeps the Horizon server calls fully in-process.
// ---------------------------------------------------------------------------
jest.mock('../stellarService', () => ({
  StellarService: {
    getServer: jest.fn(),
    getNetworkPassphrase: jest.fn().mockReturnValue('Test SDF Network ; September 2015'),
  },
}));

// ---------------------------------------------------------------------------
// Mock the database pool.
// ---------------------------------------------------------------------------
jest.mock('../../config/database', () => ({
  pool: { query: jest.fn() },
}));

import { FreezeService } from '../freezeService.js';
import { StellarService } from '../stellarService.js';
import { pool } from '../../config/database.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockServer(
  overrides: Partial<{
    loadAccount: jest.Mock;
    submitTransaction: jest.Mock;
    records: { account_id: string }[];
  }> = {}
) {
  const records = overrides.records ?? [];
  return {
    loadAccount:
      overrides.loadAccount ??
      jest.fn().mockResolvedValue({
        accountId: () => 'G_ISSUER',
        sequenceNumber: () => '1000',
        incrementSequenceNumber: jest.fn(),
      }),
    submitTransaction:
      overrides.submitTransaction ?? jest.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
    accounts: jest.fn().mockReturnValue({
      forAsset: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          call: jest.fn().mockResolvedValue({ records }),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FreezeService', () => {
  let issuerKeypair: Keypair;
  let targetKeypair: Keypair;
  let mockServer: ReturnType<typeof makeMockServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    issuerKeypair = Keypair.random();
    targetKeypair = Keypair.random();
    mockServer = makeMockServer();
    (StellarService.getServer as jest.Mock).mockReturnValue(mockServer);
    (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // -------------------------------------------------------------------------
  // toggleAccountFreeze
  // -------------------------------------------------------------------------

  describe('toggleAccountFreeze', () => {
    it('loads the issuer account, submits transaction and writes a single audit log on freeze', async () => {
      const result = await FreezeService.toggleAccountFreeze(
        issuerKeypair,
        targetKeypair.publicKey(),
        'ORGUSD',
        'freeze',
        'Compliance violation'
      );

      expect(mockServer.loadAccount).toHaveBeenCalledWith(issuerKeypair.publicKey());
      expect(mockServer.submitTransaction).toHaveBeenCalledTimes(1);

      // Exactly one DB round-trip (the single INSERT)
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account_freeze_logs'),
        expect.arrayContaining([
          targetKeypair.publicKey(),
          'ORGUSD',
          issuerKeypair.publicKey(),
          'freeze',
          'account',
          'mock-tx-hash',
          issuerKeypair.publicKey(),
          'Compliance violation',
        ])
      );

      expect(result).toEqual({
        txHash: 'mock-tx-hash',
        action: 'freeze',
        scope: 'account',
        targetAccount: targetKeypair.publicKey(),
        assetCode: 'ORGUSD',
        assetIssuer: issuerKeypair.publicKey(),
      });
    });

    it('returns unfreeze in the result and passes reason=undefined when omitted', async () => {
      const result = await FreezeService.toggleAccountFreeze(
        issuerKeypair,
        targetKeypair.publicKey(),
        'ORGUSD',
        'unfreeze'
      );

      expect(result.action).toBe('unfreeze');
      // reason is optional — DB receives null
      expect((pool.query as jest.Mock).mock.calls[0][1]).toContain(null);
    });

    it('does NOT write the audit log when Horizon submission fails', async () => {
      mockServer.submitTransaction.mockRejectedValue(new Error('tx_failed'));

      await expect(
        FreezeService.toggleAccountFreeze(
          issuerKeypair,
          targetKeypair.publicKey(),
          'ORGUSD',
          'freeze'
        )
      ).rejects.toThrow('tx_failed');

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // toggleGlobalFreeze
  // -------------------------------------------------------------------------

  describe('toggleGlobalFreeze', () => {
    it('returns an empty array and skips DB write when no holders exist', async () => {
      const results = await FreezeService.toggleGlobalFreeze(issuerKeypair, 'ORGUSD', 'freeze');

      expect(results).toHaveLength(0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('skips the issuer account and uses ONE bulk INSERT per batch (not N inserts)', async () => {
      const holder1 = Keypair.random().publicKey();
      const holder2 = Keypair.random().publicKey();
      const assetIssuer = issuerKeypair.publicKey();

      // Page with 2 real holders + the issuer (should be skipped)
      mockServer = makeMockServer({
        records: [{ account_id: holder1 }, { account_id: holder2 }, { account_id: assetIssuer }],
      });
      (StellarService.getServer as jest.Mock).mockReturnValue(mockServer);

      const results = await FreezeService.toggleGlobalFreeze(
        issuerKeypair,
        'ORGUSD',
        'freeze',
        'Emergency'
      );

      // Only non-issuer holders are returned
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.targetAccount)).not.toContain(assetIssuer);
      expect(results.every((r) => r.scope === 'global')).toBe(true);

      // Exactly ONE DB call for both holders (bulk INSERT, not 2 individual INSERTs)
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account_freeze_logs'),
        expect.arrayContaining([holder1, holder2, 'ORGUSD', 'freeze', 'global'])
      );
    });

    it('populates txHash and assetIssuer correctly in each result', async () => {
      const holder = Keypair.random().publicKey();
      mockServer = makeMockServer({ records: [{ account_id: holder }] });
      (StellarService.getServer as jest.Mock).mockReturnValue(mockServer);

      const results = await FreezeService.toggleGlobalFreeze(issuerKeypair, 'ORGUSD', 'unfreeze');

      expect(results[0]).toMatchObject({
        txHash: 'mock-tx-hash',
        action: 'unfreeze',
        scope: 'global',
        assetCode: 'ORGUSD',
        assetIssuer: issuerKeypair.publicKey(),
      });
    });
  });

  // -------------------------------------------------------------------------
  // isFrozen
  // -------------------------------------------------------------------------

  describe('isFrozen', () => {
    const assetIssuerKey = Keypair.random().publicKey();

    it('returns true when the trustline is_authorized flag is false', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'ORGUSD',
            asset_issuer: assetIssuerKey,
            is_authorized: false,
          },
        ],
      });

      const frozen = await FreezeService.isFrozen(
        targetKeypair.publicKey(),
        'ORGUSD',
        assetIssuerKey
      );
      expect(frozen).toBe(true);
    });

    it('returns false when the trustline is_authorized flag is true', async () => {
      mockServer.loadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'ORGUSD',
            asset_issuer: assetIssuerKey,
            is_authorized: true,
          },
        ],
      });

      const frozen = await FreezeService.isFrozen(
        targetKeypair.publicKey(),
        'ORGUSD',
        assetIssuerKey
      );
      expect(frozen).toBe(false);
    });

    it('returns false when no matching trustline exists', async () => {
      mockServer.loadAccount.mockResolvedValue({ balances: [] });

      const frozen = await FreezeService.isFrozen(
        targetKeypair.publicKey(),
        'ORGUSD',
        assetIssuerKey
      );
      expect(frozen).toBe(false);
    });

    it('returns false on 404 (account not found on network)', async () => {
      mockServer.loadAccount.mockRejectedValue({ response: { status: 404 } });

      const frozen = await FreezeService.isFrozen(
        targetKeypair.publicKey(),
        'ORGUSD',
        assetIssuerKey
      );
      expect(frozen).toBe(false);
    });

    it('re-throws non-404 Horizon errors', async () => {
      mockServer.loadAccount.mockRejectedValue(new Error('Network timeout'));

      await expect(
        FreezeService.isFrozen(targetKeypair.publicKey(), 'ORGUSD', assetIssuerKey)
      ).rejects.toThrow('Network timeout');
    });
  });

  // -------------------------------------------------------------------------
  // listLogs
  // -------------------------------------------------------------------------

  describe('listLogs', () => {
    beforeEach(() => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // COUNT query
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }); // data query
    });

    it('returns total, page, limit, and data correctly', async () => {
      const page = await FreezeService.listLogs({ page: 1, limit: 10 });

      expect(page.total).toBe(5);
      expect(page.page).toBe(1);
      expect(page.limit).toBe(10);
      expect(page.data).toHaveLength(2);
    });

    it('caps limit at 100', async () => {
      (pool.query as jest.Mock)
        .mockReset()
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await FreezeService.listLogs({ limit: 9999 });

      // The data query's parameterized values include the effective limit
      const dataQueryValues = (pool.query as jest.Mock).mock.calls[1][1] as unknown[];
      expect(dataQueryValues).toContain(100);
    });

    it('includes optional filters in the WHERE clause', async () => {
      (pool.query as jest.Mock)
        .mockReset()
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const testTarget = targetKeypair.publicKey();
      await FreezeService.listLogs({
        targetAccount: testTarget,
        action: 'freeze',
        assetCode: 'ORGUSD',
      });

      const countQuery = (pool.query as jest.Mock).mock.calls[0];
      expect(countQuery[0]).toContain('WHERE');
      expect(countQuery[1]).toContain(testTarget);
      expect(countQuery[1]).toContain('freeze');
      expect(countQuery[1]).toContain('ORGUSD');
    });

    it('returns page 1 with defaults when no options are passed', async () => {
      const page = await FreezeService.listLogs({});

      expect(page.page).toBe(1);
      expect(page.limit).toBe(20); // default
    });
  });

  // -------------------------------------------------------------------------
  // getLatestLog
  // -------------------------------------------------------------------------

  describe('getLatestLog', () => {
    it('returns the row when a log record exists', async () => {
      const mockRow = { id: 5, action: 'freeze', created_at: '2024-01-01T00:00:00Z' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await FreezeService.getLatestLog(
        targetKeypair.publicKey(),
        'ORGUSD',
        issuerKeypair.publicKey()
      );
      expect(result).toEqual(mockRow);
    });

    it('returns null when no log record exists', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await FreezeService.getLatestLog(
        targetKeypair.publicKey(),
        'ORGUSD',
        issuerKeypair.publicKey()
      );
      expect(result).toBeNull();
    });

    it('queries with all three filter params', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const target = targetKeypair.publicKey();
      const issuer = issuerKeypair.publicKey();

      await FreezeService.getLatestLog(target, 'ORGUSD', issuer);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'), [
        target,
        'ORGUSD',
        issuer,
      ]);
    });
  });
});
