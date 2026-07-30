export interface NotificationMessage {
  recipientUserId: string;
  subject: string;
  body: string;
}

export interface NotificationProvider {
  readonly kind: 'noop' | 'smtp';
  send(message: NotificationMessage): Promise<void>;
}
