import { Request, Response } from 'express';
import { PDFCertificateService } from '../services/pdfCertificateService.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

const generateCertificateSchema = z.object({
  employeeId: z.number().int().positive(),
  transactionHash: z.string().length(64, 'Transaction hash must be 64 characters'),
  organizationId: z.number().int().positive(),
});

const verifyCertificateSchema = z.object({
  transactionHash: z.string().length(64, 'Transaction hash must be 64 characters'),
  employeeId: z.number().int().positive(),
  organizationId: z.number().int().positive(),
});

export class PDFCertificateController {
  /**
   * Generate a PDF certificate for a payment transaction
   * GET /api/certificates/generate?employeeId=1&transactionHash=xxx&organizationId=1
   * OR
   * GET /api/certificates/generate?transactionHash=xxx (auto-detects employeeId and organizationId)
   */
  static async generateCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId, transactionHash, organizationId } = req.query;

      if (!transactionHash || typeof transactionHash !== 'string') {
        res.status(400).json({
          error: 'Transaction hash is required',
        });
        return;
      }

      let finalEmployeeId: number | undefined = employeeId ? Number(employeeId) : undefined;
      let finalOrganizationId: number | undefined = organizationId
        ? Number(organizationId)
        : undefined;

      // If employeeId or organizationId not provided, try to fetch from transaction
      if (!finalEmployeeId || !finalOrganizationId) {
        const txInfo = await PDFCertificateService.getTransactionEmployeeInfo(
          transactionHash as string
        );
        if (txInfo) {
          finalEmployeeId = finalEmployeeId || txInfo.employeeId;
          finalOrganizationId = finalOrganizationId || txInfo.organizationId;
        }
      }

      // Validate query parameters
      const validation = generateCertificateSchema.safeParse({
        employeeId: finalEmployeeId,
        transactionHash,
        organizationId: finalOrganizationId,
      });

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: validation.error.issues,
          message:
            'Employee ID and Organization ID are required. They can be provided as query parameters or will be auto-detected from the transaction.',
        });
        return;
      }

      const data = validation.data;

      // Generate PDF
      const pdfBuffer = await PDFCertificateService.generateCertificate(data);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payment-certificate-${transactionHash.substring(0, 16)}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Failed to generate PDF certificate', error);
      res.status(500).json({
        error: 'Failed to generate certificate',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Verify a certificate by transaction hash
   * GET /api/certificates/verify?transactionHash=xxx&employeeId=1&organizationId=1
   */
  static async verifyCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { transactionHash, employeeId, organizationId } = req.query;

      // Validate query parameters
      const validation = verifyCertificateSchema.safeParse({
        transactionHash,
        employeeId: employeeId ? Number(employeeId) : undefined,
        organizationId: organizationId ? Number(organizationId) : undefined,
      });

      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: validation.error.issues,
        });
        return;
      }

      const { transactionHash: hash, employeeId: empId, organizationId: orgId } = validation.data;

      // Verify certificate
      const result = await PDFCertificateService.verifyCertificate(hash, empId, orgId);

      if (!result.verified) {
        res.status(404).json({
          verified: false,
          message: 'Certificate could not be verified',
        });
        return;
      }

      res.json({
        verified: true,
        transactionHash: hash,
        details: result.details,
      });
    } catch (error) {
      logger.error('Failed to verify certificate', error);
      res.status(500).json({
        error: 'Failed to verify certificate',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get employee and organization info from transaction hash
   * GET /api/certificates/transaction-info?transactionHash=xxx
   */
  static async getTransactionInfo(req: Request, res: Response): Promise<void> {
    try {
      const { transactionHash } = req.query;

      if (!transactionHash || typeof transactionHash !== 'string') {
        res.status(400).json({
          error: 'Transaction hash is required',
        });
        return;
      }

      const txInfo = await PDFCertificateService.getTransactionEmployeeInfo(transactionHash);

      if (!txInfo) {
        res.status(404).json({
          error: 'Transaction not found or not associated with an employee',
        });
        return;
      }

      res.json({
        success: true,
        data: txInfo,
      });
    } catch (error) {
      logger.error('Failed to get transaction info', error);
      res.status(500).json({
        error: 'Failed to get transaction info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
