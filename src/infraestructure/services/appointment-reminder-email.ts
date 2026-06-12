import { Appointment } from "../../domain/entities/appointment";

const LOGO_URL = "https://labirintodosaber.vercel.app/logo.png";
const AGENDA_URL = "https://labirintodosaber.vercel.app/agenda";

export function buildReminderEmailHtml(
  appointment: Appointment,
  studentName?: string,
): string {
  const dateLabel = appointment.scheduledAt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timeLabel = appointment.scheduledAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lembrete de Sessão</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet" />
</head>
<body style="margin:0; padding:0; background-color:#eef0f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f5; padding:32px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px; width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="${LOGO_URL}" alt="Labirinto do Saber" width="170" style="display:block; border:0;" />
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Faixa teal -->
                <tr>
                  <td style="background-color:#63e9e2; padding:28px 36px;">
                    <p style="margin:0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:22px; font-weight:800; color:#ffffff;">
                      Lembrete de Sess&atilde;o &#128197;
                    </p>
                    <p style="margin:6px 0 0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:14px; color:#ffffff;">
                      Voc&ecirc; tem um atendimento agendado${studentName ? ` com <strong>${studentName}</strong>` : ""}.
                    </p>
                  </td>
                </tr>

                <!-- Conteúdo -->
                <tr>
                  <td style="padding:32px 36px;">

                    <!-- Bloco de data/hora -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#d8f5f3; border-radius:14px;">
                      <tr>
                        <td align="center" style="padding:20px 16px;">
                          <p style="margin:0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#00847d; text-transform:capitalize;">
                            ${dateLabel}
                          </p>
                          <p style="margin:6px 0 0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:32px; font-weight:800; color:#00847d; line-height:1;">
                            ${timeLabel}
                          </p>
                        </td>
                      </tr>
                    </table>

                    ${
                      appointment.observation
                        ? `
                    <!-- Observação -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; background-color:#fbfbfd; border-left:4px solid #63e9e2; border-radius:12px;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0 0 4px; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; color:#8a9a98;">
                            Observa&ccedil;&atilde;o
                          </p>
                          <p style="margin:0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:14px; color:#444444; line-height:1.5;">
                            ${appointment.observation}
                          </p>
                        </td>
                      </tr>
                    </table>`
                        : ""
                    }

                    <!-- Botão -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                      <tr>
                        <td align="center">
                          <a href="${AGENDA_URL}"
                             style="display:inline-block; background-color:#63e9e2; color:#ffffff; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:15px; font-weight:800; text-decoration:none; padding:13px 36px; border-radius:26px;">
                            Ver Agenda Completa
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td align="center" style="padding:24px 16px 0;">
              <p style="margin:0; font-family:'Nunito', Arial, Helvetica, sans-serif; font-size:12px; color:#999999; line-height:1.6;">
                Voc&ecirc; est&aacute; recebendo este lembrete porque possui uma sess&atilde;o agendada no Labirinto do Saber.<br />
                Para remarcar ou cancelar, acesse a sua agenda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
