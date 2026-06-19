import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP not configured — emails will be logged to console',
      );
      return;
    }

    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    const mailpitUrl = this.config.get('MAILPIT_WEB_URL');

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get('SMTP_SECURE') === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    if (mailpitUrl) {
      this.logger.log(`Dev mailbox active — intercepted emails: ${mailpitUrl}`);
    } else {
      this.logger.log(`SMTP configured (${host})`);
    }
  }

  private devMailboxUrl() {
    return this.config.get<string>('MAILPIT_WEB_URL') || null;
  }

  async send(to: string, subject: string, html: string) {
    const from = this.config.get(
      'SMTP_FROM',
      'White Glove Source <noreply@whiteglovedeliverync.com>',
    );

    if (!this.transporter) {
      this.logger.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.debug(html);
      return { logged: true };
    }

    const info = await this.transporter.sendMail({ from, to, subject, html });
    const mailbox = this.devMailboxUrl();
    if (mailbox) {
      this.logger.log(
        `[EMAIL] To: ${to} | Subject: ${subject} | Dev mailbox: ${mailbox}`,
      );
    }
    return info;
  }

  async notifyOwnerContact(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) {
    const ownerEmail = this.config.get(
      'OWNER_EMAIL',
      'hello@whiteglovedeliverync.com',
    );
    const html = `
      <h2>New Contact Message</h2>
      <p><strong>From:</strong> ${data.name} (${data.email})</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      <p><strong>Subject:</strong> ${data.subject}</p>
      <p>${data.message}</p>
    `;
    return this.send(ownerEmail, `[WGS] Contact: ${data.subject}`, html);
  }

  async notifyOwnerQuote(data: {
    contactName: string;
    email: string;
    phone?: string;
    company?: string;
    serviceType: string;
    projectDescription: string;
    propertyAddress?: string;
    pickupAddress?: string;
    estimatedPieces?: number;
    preferredDate?: string;
    estimatedTotal?: number;
    milesToStorage?: number;
    milesToInstall?: number;
    storageMonths?: number;
    storageLocationName?: string;
  }) {
    const ownerEmail = this.config.get(
      'OWNER_EMAIL',
      'hello@whiteglovedeliverync.com',
    );
    const html = `
      <h2>New Quote Request</h2>
      <p><strong>Contact:</strong> ${data.contactName} (${data.email})</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      ${data.company ? `<p><strong>Company:</strong> ${data.company}</p>` : ''}
      <p><strong>Service:</strong> ${data.serviceType}</p>
      ${data.propertyAddress ? `<p><strong>Install Address:</strong> ${data.propertyAddress}</p>` : ''}
      ${data.pickupAddress ? `<p><strong>Pickup Area:</strong> ${data.pickupAddress}</p>` : ''}
      ${data.storageLocationName ? `<p><strong>Warehouse:</strong> ${data.storageLocationName}</p>` : ''}
      ${data.estimatedPieces ? `<p><strong>Pieces:</strong> ${data.estimatedPieces}</p>` : ''}
      ${data.milesToStorage != null ? `<p><strong>Pickup → Warehouse:</strong> ${data.milesToStorage} mi</p>` : ''}
      ${data.milesToInstall != null ? `<p><strong>Warehouse → Install:</strong> ${data.milesToInstall} mi</p>` : ''}
      ${data.storageMonths != null ? `<p><strong>Storage:</strong> ${data.storageMonths} months</p>` : ''}
      ${data.estimatedTotal != null ? `<p><strong>Estimated Total:</strong> $${Number(data.estimatedTotal).toLocaleString()}</p>` : ''}
      ${data.preferredDate ? `<p><strong>Preferred Date:</strong> ${data.preferredDate}</p>` : ''}
      <p><strong>Description:</strong></p>
      <p>${data.projectDescription}</p>
    `;
    return this.send(
      ownerEmail,
      `[WGS] Quote Request from ${data.contactName}`,
      html,
    );
  }

  async notifyOwnerQuoteLead(data: {
    contactName: string;
    email: string;
    phone?: string;
    company?: string;
    serviceType: string;
  }) {
    const ownerEmail = this.config.get(
      'OWNER_EMAIL',
      'hello@whiteglovedeliverync.com',
    );
    const html = `
      <h2>New Quote Lead — Builder Started</h2>
      <p>Someone began the quote builder and submitted contact info. Follow up even if they don't finish.</p>
      <p><strong>Contact:</strong> ${data.contactName} (${data.email})</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      ${data.company ? `<p><strong>Company:</strong> ${data.company}</p>` : ''}
      <p><strong>Service:</strong> ${data.serviceType}</p>
    `;
    return this.send(
      ownerEmail,
      `[WGS] Quote Lead — ${data.contactName}`,
      html,
    );
  }

  async sendQuoteToClient(data: {
    email: string;
    contactName: string;
    quotedAmount: number;
    serviceType: string;
    projectDescription: string;
    propertyAddress?: string;
    pickupAddress?: string;
    preferredDate?: string;
    milesToStorage?: number;
    milesToInstall?: number;
    storageMonths?: number;
    storageLocationName?: string;
    estimatedTotal?: number;
    lineItems?: { description: string; amount: number }[];
  }) {
    const settings = await this.settingsService.getSettings();
    const lineItemsHtml =
      data.lineItems && data.lineItems.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <thead><tr>
              <th style="text-align:left;border-bottom:1px solid #ccc;padding:8px 4px">Item</th>
              <th style="text-align:right;border-bottom:1px solid #ccc;padding:8px 4px">Amount</th>
            </tr></thead>
            <tbody>${data.lineItems
              .map(
                (li) =>
                  `<tr><td style="padding:6px 4px;border-bottom:1px solid #eee">${li.description}</td>` +
                  `<td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">$${li.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`,
              )
              .join('')}</tbody>
          </table>`
        : '';

    const logisticsParts = [
      data.pickupAddress
        ? `<strong>Pickup:</strong> ${data.pickupAddress}`
        : null,
      data.propertyAddress
        ? `<strong>Install site:</strong> ${data.propertyAddress}`
        : null,
      data.preferredDate
        ? `<strong>Preferred date:</strong> ${data.preferredDate}`
        : null,
      data.milesToStorage != null
        ? `<strong>Mileage:</strong> ${data.milesToStorage} mi to ${data.storageLocationName || 'warehouse'} · ${data.milesToInstall ?? 0} mi to install`
        : null,
      data.storageMonths
        ? `<strong>Storage:</strong> ${data.storageMonths} month(s)`
        : null,
    ].filter(Boolean);

    const logisticsHtml =
      logisticsParts.length > 0
        ? `<div style="margin:16px 0;font-size:14px">${logisticsParts.map((p) => `<p style="margin:4px 0">${p}</p>`).join('')}</div>`
        : '';

    const estimateNote =
      data.estimatedTotal != null && data.estimatedTotal !== data.quotedAmount
        ? `<p style="font-size:13px;color:#666">Original estimate: $${data.estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`
        : '';

    const html = `
      <h2>Your Quote from White Glove Source</h2>
      <p>Dear ${data.contactName},</p>
      <p>Please review the quote below. Reply to this email or call us at ${settings.businessPhone} to <strong>approve</strong>, request changes, or discuss next steps.</p>
      <p><strong>Service:</strong> ${data.serviceType}</p>
      <p><strong>Project:</strong> ${data.projectDescription}</p>
      ${logisticsHtml}
      ${lineItemsHtml}
      <p style="font-size:24px;margin-top:20px"><strong>Quoted Amount: $${data.quotedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
      ${estimateNote}
      <p style="margin-top:24px;padding:12px;background:#f8f5f0;border-left:4px solid #c9a227">
        <strong>Approval:</strong> Reply with "Approved" or let us know if you need adjustments before we proceed.
      </p>
      <p>— ${settings.businessName}</p>
    `;
    return this.send(
      data.email,
      'Your White Glove Source Quote — Approval Requested',
      html,
    );
  }
}
