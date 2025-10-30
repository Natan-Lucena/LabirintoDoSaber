import nodemailer from "nodemailer";
import { MailService } from "../../application/services/mail-service";

export class NodemailerMailService implements MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Labirinto do saber" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html: body,
    });
  }
}
