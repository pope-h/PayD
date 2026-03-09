export interface SendMailInput {
  to: string[];
  subject: string;
  text: string;
}

export class MailerService {
  static isConfigured(): boolean {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  }

  static async sendMail(input: SendMailInput): Promise<void> {
    if (!this.isConfigured()) return;

    let nodemailer: any;
    try {
      nodemailer = (await import('nodemailer')).default;
    } catch {
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: input.to.join(','),
      subject: input.subject,
      text: input.text,
    });
  }
}
