import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("resendApiKey") ?? "";
    this.from = "SaaS Platform <onboarding@example.com>";
  }

  async send(params: SendMailParams): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `Resend API key not configured. Email not sent to ${params.to} (subject: ${params.subject})`
      );
      this.logger.log(`Email to ${params.to}: ${params.text}`);
      return;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error: ${response.status} ${body}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${params.to}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async sendInvitation(params: { to: string; orgName: string; inviteUrl: string; role: string }) {
    await this.send({
      to: params.to,
      subject: `You've been invited to join ${params.orgName}`,
      text: `You've been invited to join ${params.orgName} as a ${params.role}.\n\nAccept your invitation here: ${params.inviteUrl}\n\nIf you didn't expect this invitation, you can ignore this email.`,
      html: `<p>You've been invited to join <strong>${params.orgName}</strong> as a <strong>${params.role}</strong>.</p><p><a href="${params.inviteUrl}">Accept your invitation</a></p><p>If you didn't expect this invitation, you can ignore this email.</p>`,
    });
  }

  async sendPasswordReset(params: { to: string; resetUrl: string }) {
    await this.send({
      to: params.to,
      subject: "Reset your password",
      text: `We received a request to reset your password.\n\nReset your password here: ${params.resetUrl}\n\nIf you didn't request this, you can ignore this email. The link expires in one hour.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${params.resetUrl}">Reset your password</a></p><p>If you didn't request this, you can ignore this email. The link expires in one hour.</p>`,
    });
  }
}