import { Injectable } from '@nestjs/common';
import { Invoice } from '../../database/entities/invoice.entity';

/**
 * Minimal PDF writer. Produces a single-page, text-only invoice PDF with
 * no external dependencies. Phase 2 will swap this for a templated
 * generator (pdfkit/puppeteer) with Nepali font support and IRD branding.
 */
@Injectable()
export class InvoicePdfService {
  render(invoice: Invoice, opts: { planName: string; customerName: string; phone: string }): Buffer {
    const lines = [
      'PowerLink Internet Services',
      'Kathmandu, Nepal',
      '',
      `Invoice: ${invoice.invoiceNumber}`,
      `Issued: ${this.dateStr(invoice.issuedAt)}`,
      `Due: ${this.dateStr(invoice.dueDate)}`,
      '',
      `Customer: ${opts.customerName || opts.phone}`,
      `Phone: ${opts.phone}`,
      `Plan: ${opts.planName}`,
      '',
      'Description                    Amount (NPR)',
      '-----------------------------------------',
      `Base price                     ${this.n(invoice.amount).padStart(10)}`,
      `VAT (13%)                      ${this.n(invoice.vatAmount).padStart(10)}`,
      `TSC (1%)                       ${this.n(invoice.tscAmount).padStart(10)}`,
      '-----------------------------------------',
      `Total                          ${this.n(invoice.totalAmount).padStart(10)}`,
      '',
      `Status: ${invoice.status.toUpperCase()}`,
      invoice.paidAt ? `Paid: ${this.dateStr(invoice.paidAt)}` : '',
      '',
      'Thank you for choosing PowerLink.',
    ].filter(Boolean);

    return this.buildPdf(lines);
  }

  private buildPdf(lines: string[]): Buffer {
    const contentLines: string[] = ['BT', '/F1 12 Tf', '72 720 Td', '14 TL'];
    for (const line of lines) {
      contentLines.push(`(${this.escape(line)}) Tj T*`);
    }
    contentLines.push('ET');
    const content = contentLines.join('\n');

    const objects: string[] = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push(`<< /Length ${Buffer.byteLength(content, 'utf-8')} >>\nstream\n${content}\nendstream`);

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(Buffer.byteLength(pdf, 'utf-8'));
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefPos = Buffer.byteLength(pdf, 'utf-8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

    return Buffer.from(pdf, 'utf-8');
  }

  private escape(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private dateStr(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  private n(v: number | string): string {
    return Number(v).toFixed(2);
  }
}
