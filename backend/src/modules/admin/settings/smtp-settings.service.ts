import { Injectable } from '@nestjs/common';

export interface SmtpSettings {
  serverUrl: string;
  port: number;
  credentialsSecretRef: string;
  senderAddress: string;
}

/**
 * Config screen exists from the MVP, non-functional until phase 2 wires SmtpNotificationProvider
 * into NotificationsModule. Credentials are a reference into the secrets vault, never stored in clear.
 */
@Injectable()
export class SmtpSettingsService {
  async get(): Promise<SmtpSettings> {
    throw new Error('Not implemented');
  }

  async update(settings: SmtpSettings, actorUserId: string): Promise<SmtpSettings> {
    void settings;
    void actorUserId;
    throw new Error('Not implemented');
  }
}
