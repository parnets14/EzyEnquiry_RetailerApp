/**
 * src/utils/invoicePdf.js  (Retailer app)
 *
 * Builds the same EazyEnquiry-branded HTML invoice as
 * wholesalerapp/src/utils/invoicePdf.js and hands it to the native PDF +
 * share sheet. Ported for parity: same markup, same CSS, same layout.
 *
 * ── Field mapping (differs from the wholesaler, deliberately) ────────────────
 * The wholesaler's backend returns `invoice.items[]` and `invoice.company`.
 * The retailer's `retailerInvoiceResponse` returns NEITHER — it flattens the
 * invoice to a single product and exposes `retailer` / `created_by` / `customer`
 * blocks. So the same template is fed from the retailer's real fields, with the
 * wholesaler's names still accepted as fallbacks.
 *
 * ── Brand colours ───────────────────────────────────────────────────────────
 * The wholesaler's PDF uses its own theme accent (#FD5C02) and navy (#01152D).
 * This one uses the retailer app's equivalents — #F4500A and #1A2340 — so the
 * PDF matches the app it was exported from.
 *
 * ── NOTE: this also fixes a crash the wholesaler's version still has ─────────
 * `react-native-html-to-pdf@1.3.0` exports a NAMED `generatePDF()` only — there
 * is no default export and no `.convert` on the module (see
 * node_modules/react-native-html-to-pdf/lib/module/index.js). The wholesaler's
 * `import RNHTMLtoPDF from 'react-native-html-to-pdf'` +
 * `RNHTMLtoPDF.convert(...)` therefore throws
 * "Cannot read property 'convert' of undefined" the moment Download is tapped.
 * This file uses the correct named import.
 */
import { Platform } from 'react-native';
import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';

const BRAND = '#F4500A';
const NAVY = '#1A2340';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
));

// Lightweight inline SVG logo mark (orange rounded tile + "E") + wordmark.
// Keeps the PDF small (no heavy base64 PNG) while staying on-brand.
const LOGO_SVG = `
<svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="44" height="44" rx="11" fill="${BRAND}"/>
  <text x="23" y="31" font-family="Arial, sans-serif" font-size="24" font-weight="800"
        fill="#ffffff" text-anchor="middle">E</text>
</svg>`;

// The DTO flattens to one product; stay tolerant of an `items[]` array too.
function normaliseItems(invoice) {
  if (Array.isArray(invoice.items) && invoice.items.length) return invoice.items;
  const one = {
    product_name: invoice.product_name || invoice.product?.name,
    product_code: invoice.product?.code,
    qty: invoice.qty,
    unit: invoice.unit,
    rate: invoice.unit_price,
    total: invoice.amount,
    gst_percent: invoice.gst_percent,
  };
  return (one.product_name || one.qty) ? [one] : [];
}

function buildHtml(invoice) {
  // Who the invoice is addressed to: the retailer's own company.
  const b = invoice.retailer || invoice.company || {};
  const items = normaliseItems(invoice);

  const subtotal = Number(invoice.subtotal ?? invoice.amount ?? 0);
  const gst      = Number(invoice.gst_amount || 0);
  const other    = Number(invoice.charges?.other || 0);
  const discount = Number(invoice.discount_amount || 0);
  const grand    = Number(invoice.grand_total ?? invoice.total_amount ?? 0);
  const paid     = Number(invoice.paid_amount || 0);
  const balance  = Number(invoice.balance_due ?? Math.max(grand - paid, 0));
  const invoiceNo = invoice.invoice_no || invoice.invoice_number || '';

  const rows = items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>
        <div style="font-weight:600">${esc(it.product_name || 'Item')}</div>
        ${it.product_code ? `<div style="color:#64748B;font-size:10px">${esc(it.product_code)}</div>` : ''}
        ${(it.size || it.finish || it.color) ? `<div style="color:#64748B;font-size:10px">${esc([it.size, it.finish, it.color].filter(Boolean).join(' · '))}</div>` : ''}
      </td>
      <td style="text-align:center">${esc(it.qty)} ${esc(it.unit || '')}</td>
      <td style="text-align:right">${money(it.rate)}</td>
      <td style="text-align:right">${it.gst_percent ?? invoice.gst_percent ?? 18}%</td>
      <td style="text-align:right">${money(it.total)}</td>
    </tr>`).join('');

  return `
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: ${NAVY}; margin: 0; padding: 28px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${BRAND}; padding-bottom: 16px; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
      .brand-name span { color: ${BRAND}; }
      .brand-tag { font-size: 10px; color: #64748B; margin-top: 2px; }
      .inv-title { text-align: right; }
      .inv-title h1 { margin: 0; font-size: 26px; letter-spacing: 2px; color: ${NAVY}; }
      .inv-title .no { font-size: 13px; color: #64748B; margin-top: 4px; }
      .meta { display: flex; justify-content: space-between; margin-top: 22px; gap: 20px; }
      .box { flex: 1; background: #F8FAFC; border-radius: 10px; padding: 14px 16px; }
      .box h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: 1px; color: #64748B; text-transform: uppercase; }
      .box .line { font-size: 12.5px; margin: 2px 0; }
      .box .strong { font-weight: 700; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
      thead th { background: ${NAVY}; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; letter-spacing: 0.4px; }
      thead th:first-child { border-radius: 8px 0 0 0; }
      thead th:last-child { border-radius: 0 8px 0 0; }
      tbody td { padding: 10px 8px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
      .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
      .totals table { width: 300px; margin-top: 0; }
      .totals td { padding: 6px 8px; font-size: 12.5px; border: none; }
      .totals .grand td { border-top: 2px solid ${NAVY}; font-weight: 800; font-size: 15px; padding-top: 10px; }
      .totals .grand .amt { color: ${BRAND}; }
      .foot { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 14px; text-align: center; color: #94A3B8; font-size: 10.5px; }
    </style>
  </head>
  <body>
    <div class="top">
      <div class="brand">
        ${LOGO_SVG}
        <div>
          <div class="brand-name">Eazy<span>Enquiry</span></div>
          <div class="brand-tag">Wholesale &amp; Trade Platform</div>
        </div>
      </div>
      <div class="inv-title">
        <h1>INVOICE</h1>
        <div class="no">${esc(invoiceNo)}</div>
        <div class="no">${fmtDate(invoice.invoice_date || invoice.created_at)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="box">
        <h3>Billed To</h3>
        <div class="line strong">${esc(b.company || b.name || invoice.customer_name || '—')}</div>
        ${b.owner_name ? `<div class="line">${esc(b.owner_name)}</div>` : ''}
        ${b.address ? `<div class="line">${esc(b.address)}</div>` : ''}
        ${b.mobile ? `<div class="line">${esc(b.mobile)}</div>` : ''}
        ${b.email ? `<div class="line">${esc(b.email)}</div>` : ''}
        ${b.gst_number ? `<div class="line">GSTIN: ${esc(b.gst_number)}</div>` : ''}
        ${invoice.customer?.name ? `<div class="line" style="margin-top:6px">For: <b>${esc(invoice.customer.name)}</b></div>` : ''}
      </div>
      <div class="box">
        <h3>Invoice Details</h3>
        <div class="line">Invoice No: <b>${esc(invoiceNo || '—')}</b></div>
        ${invoice.order_code ? `<div class="line">Order No: <b>${esc(invoice.order_code)}</b></div>` : ''}
        <div class="line">Date: <b>${fmtDate(invoice.invoice_date || invoice.created_at)}</b></div>
        <div class="line">Payment Status: <b>${esc(invoice.payment_status || '—')}</b></div>
        ${invoice.created_by?.company ? `<div class="line">Issued by: <b>${esc(invoice.created_by.company)}</b></div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center">#</th>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">GST</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8">No items</td></tr>'}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">${money(subtotal)}</td></tr>
        <tr><td>GST</td><td style="text-align:right">${money(gst)}</td></tr>
        ${other > 0 ? `<tr><td>Other charges</td><td style="text-align:right">${money(other)}</td></tr>` : ''}
        ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${money(discount)}</td></tr>` : ''}
        <tr class="grand"><td>Grand Total</td><td style="text-align:right" class="amt">${money(grand)}</td></tr>
        <tr><td>Paid</td><td style="text-align:right">${money(paid)}</td></tr>
        <tr><td>Balance Due</td><td style="text-align:right"><b>${money(balance)}</b></td></tr>
      </table>
    </div>

    <div class="foot">
      This is a computer-generated invoice from EazyEnquiry. Thank you for your business.
    </div>
  </body>
  </html>`;
}

/**
 * Generate the invoice PDF and open the native share/save sheet.
 * Returns the file path on success.
 */
export async function generateAndShareInvoice(invoice) {
  const no = invoice.invoice_no || invoice.invoice_number || 'EZY';
  const fileName = `Invoice_${String(no).replace(/[^\w-]/g, '')}`;
  const { filePath } = await generatePDF({
    html: buildHtml(invoice),
    fileName,
    base64: false,
  });

  const url = Platform.OS === 'android' ? `file://${filePath}` : filePath;
  await Share.open({
    url,
    type: 'application/pdf',
    filename: fileName,
    title: `Invoice ${no}`,
    failOnCancel: false,
  });

  return filePath;
}

export default { generateAndShareInvoice };
