import nodemailer from "nodemailer";
import { MailService } from "../../application/services/mail-service";
import { Appointment } from "../../domain/entities/appointment";

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

  async sendAppointmentReminder(appointment: Appointment): Promise<void> {
    const body = `
      <h2>Lembrete de Consulta</h2>
      <p>Sua consulta está agendada para: ${appointment.scheduledAt.toLocaleString("pt-BR")}</p>
      ${appointment.observation ? `<p>Observação: ${appointment.observation}</p>` : ""}
    `;
    await this.sendMail(
      process.env.MAIL_USER ?? "",
      "Lembrete de Consulta",
      body
    );
  }
}
