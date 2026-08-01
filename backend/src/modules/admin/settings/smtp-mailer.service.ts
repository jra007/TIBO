import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { SmtpSettingsService } from './smtp-settings.service';

export interface SmtpTestResult {
  success: boolean;
  message: string;
}

@Injectable()
export class SmtpMailerService {
  constructor(private readonly smtpSettings: SmtpSettingsService) {}

  /** Never throws — the caller (an admin diagnostic action) always gets a readable result instead of a 500. */
  async sendTestEmail(to: string): Promise<SmtpTestResult> {
    const settings = await this.smtpSettings.getWithSecret();
    if (!settings.host || !settings.fromAddress) {
      return { success: false, message: "Configuration incomplète : l'hôte et l'adresse d'expédition sont obligatoires." };
    }

    try {
      const transport = nodemailer.createTransport({
        host: settings.host,
        port: settings.port ?? 587,
        secure: settings.secure,
        requireTLS: settings.requireTLS,
        tls: { rejectUnauthorized: settings.tlsRejectUnauthorized },
        connectionTimeout: settings.connectTimeoutMs ?? undefined,
        greetingTimeout: settings.greetingTimeoutMs ?? undefined,
        socketTimeout: settings.socketTimeoutMs ?? undefined,
        auth: settings.username ? { user: settings.username, pass: settings.password ?? undefined } : undefined,
      });

      await transport.sendMail({
        from: settings.fromAddress,
        to,
        subject: 'TIBO — Email de test',
        text: "Ceci est un email de test envoyé depuis la configuration SMTP de TIBO. Si vous le recevez, la configuration fonctionne.",
      });
      return { success: true, message: `Email de test envoyé à ${to}.` };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Échec de l'envoi : ${detail}` };
    }
  }
}
