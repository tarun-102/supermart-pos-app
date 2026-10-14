/**
 * Print Helper Utility for ShiftFlow SuperStore POS
 * Uses dedicated isolated iframes to guarantee 100% reliable printing on:
 * - 58mm / 80mm ESC/POS thermal receipt printers
 * - Desktop Chrome / Edge / Firefox / Safari
 * - Mobile web browsers & Bluetooth thermal printers
 * - Standard A4 laser/inkjet printers for GST reports
 * 
 * Eliminates blank-page bugs caused by SPA modal overflows, visibility rules, and fixed positions.
 */

// Internal helper to print HTML content in an isolated invisible iframe
export function printHtmlViaIframe(htmlContent, title = 'POS Print') {
    return new Promise((resolve) => {
        let iframe = document.getElementById('shiftflow-print-iframe');
        if (iframe) {
            iframe.remove();
        }

        iframe = document.createElement('iframe');
        iframe.id = 'shiftflow-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-9999';

        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // Allow fonts, barcode images, and styles to compute
        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Iframe print error:', err);
                // Fallback to direct window print if iframe restricted
                window.print();
            }
            resolve();
        }, 300);
    });
}

/**
 * Print Thermal Slip / Tax Invoice (80mm / 58mm standard receipt)
 */
export function printThermalReceipt(bill, storeConfig = {}) {
    if (!bill) return;

    const storeName = storeConfig?.storeName || bill.storeName || 'SUPERSTORE POS';
    const storeType = storeConfig?.storeType || bill.storeType || 'Supermarket & Retail';
    const storeAddress = storeConfig?.address || bill.storeAddress || '';
    const storeContact = storeConfig?.contact || bill.storeContact || '';
    const storeGstin = storeConfig?.gstin || bill.storeGstin || '';
    const tagline = storeConfig?.receiptTagline || bill.storeTagline || 'Thank You For Shopping! Visit Again.';

    const dateFormatted = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const items = bill.items || [];
    const grossMrp = Number(bill.grossMrpTotal || (bill.netPayable + (bill.totalSavings || 0))).toFixed(2);
    const savings = Number(bill.totalSavings || 0).toFixed(2);
    const netPayable = Number(bill.netPayable || 0);

    // Calculate GST breakdown if not present
    let totalTax = Number(bill.taxAmount || 0);
    let taxableTotal = Number(bill.taxableAmount || (netPayable - totalTax));
    if (taxableTotal <= 0 || isNaN(taxableTotal)) taxableTotal = netPayable - totalTax;

    const cgstTotal = (totalTax / 2).toFixed(2);
    const sgstTotal = (totalTax / 2).toFixed(2);

    const itemsHtml = items.map((it, idx) => {
        const qty = it.quantity || 1;
        const mrp = Number(it.mrp || it.sellingPrice || 0).toFixed(2);
        const rate = Number(it.sellingPrice || 0).toFixed(2);
        const total = Number(it.total || 0).toFixed(2);
        const taxPct = it.taxPercent ? `${it.taxPercent}%` : '5%';

        return `
            <tr>
                <td style="padding: 3px 0; text-align: left; vertical-align: top;">
                    <div style="font-weight: bold; font-size: 11px;">${idx + 1}. ${it.name}</div>
                    <div style="font-size: 9px; color: #444;">${it.barcode || ''} (${it.unit || 'pc'}) | GST:${taxPct}</div>
                </td>
                <td style="padding: 3px 2px; text-align: center; vertical-align: top; font-size: 10px;">${qty}</td>
                <td style="padding: 3px 2px; text-align: right; vertical-align: top; font-size: 10px;">${rate}</td>
                <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: bold; font-size: 11px;">${total}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Receipt - ${bill.billNumber}</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    font-family: 'Courier New', Courier, monospace;
                    color: #000;
                    background: transparent;
                }
                body {
                    width: 76mm;
                    margin: 0 auto;
                    padding: 5mm 3mm;
                    font-size: 11px;
                    line-height: 1.35;
                }
                .text-center { text-align: center; }
                .text-start { text-align: left; }
                .text-end { text-align: right; }
                .fw-bold { font-weight: bold; }
                .divider {
                    border-bottom: 1px dashed #000;
                    margin: 6px 0;
                }
                .double-divider {
                    border-bottom: 2px solid #000;
                    margin: 6px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .flex-between {
                    display: flex;
                    justify-content: space-between;
                }
                .savings-box {
                    border: 1px solid #000;
                    padding: 4px;
                    text-align: center;
                    margin: 6px 0;
                    font-weight: bold;
                    font-size: 10.5px;
                }
                .barcode-box {
                    letter-spacing: 4px;
                    font-weight: bold;
                    font-size: 13px;
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="text-center">
                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">${storeName.toUpperCase()}</div>
                ${storeType ? `<div style="font-size: 10px; font-weight: bold;">${storeType}</div>` : ''}
                ${storeAddress ? `<div style="font-size: 9px;">${storeAddress}</div>` : ''}
                ${storeGstin ? `<div style="font-size: 9.5px; font-weight: bold;">GSTIN: ${storeGstin}</div>` : ''}
                ${storeContact ? `<div style="font-size: 9px;">Tel: ${storeContact}</div>` : ''}
                <div style="font-size: 10.5px; font-weight: bold; margin-top: 2px;">*** TAX INVOICE / CASH MEMO ***</div>
            </div>

            <div class="divider"></div>

            <div class="text-start" style="font-size: 10px;">
                <div class="flex-between">
                    <span><strong>Bill No:</strong> ${bill.billNumber}</span>
                    <span>${dateFormatted}</span>
                </div>
                <div class="flex-between">
                    <span><strong>Cashier:</strong> ${bill.cashierName || 'Cashier'}</span>
                    <span><strong>Counter:</strong> ${bill.counterNo || 'Counter-01'}</span>
                </div>
                ${bill.customerPhone ? `
                <div class="flex-between">
                    <span><strong>Customer:</strong> ${bill.customerName || 'Walk-in'}</span>
                    <span><strong>Mob:</strong> ${bill.customerPhone}</span>
                </div>` : ''}
            </div>

            <div class="divider"></div>

            <table>
                <thead>
                    <tr style="border-bottom: 1px solid #000; font-size: 10px;">
                        <th style="text-align: left; padding: 2px 0;">Item Description</th>
                        <th style="text-align: center; width: 35px;">Qty</th>
                        <th style="text-align: right; width: 45px;">Rate</th>
                        <th style="text-align: right; width: 55px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="divider"></div>

            <div style="font-size: 10.5px;">
                <div class="flex-between">
                    <span>Total Items / Qty:</span>
                    <span><strong>${items.length} items (${items.reduce((s, i) => s + (Number(i.quantity) || 1), 0).toFixed(1)})</strong></span>
                </div>
                <div class="flex-between">
                    <span>Total MRP:</span>
                    <span>₹${grossMrp}</span>
                </div>
                <div class="flex-between">
                    <span>Special Savings / Discount:</span>
                    <span><strong>-₹${savings}</strong></span>
                </div>
                <div class="divider"></div>
                <div class="flex-between" style="font-size: 13.5px; font-weight: 900;">
                    <span>NET PAYABLE:</span>
                    <span>₹${netPayable.toLocaleString('en-IN')}</span>
                </div>
            </div>

            <div class="divider"></div>

            <!-- GST Tax Breakdown -->
            <div style="font-size: 9.5px;">
                <div style="font-weight: bold; margin-bottom: 2px; text-decoration: underline;">GST TAX SUMMARY:</div>
                <div class="flex-between">
                    <span>Taxable Net Value:</span>
                    <span>₹${Number(taxableTotal).toFixed(2)}</span>
                </div>
                <div class="flex-between">
                    <span>CGST (Central Tax):</span>
                    <span>₹${cgstTotal}</span>
                </div>
                <div class="flex-between">
                    <span>SGST (State Tax):</span>
                    <span>₹${sgstTotal}</span>
                </div>
                <div class="flex-between" style="font-weight: bold;">
                    <span>Total GST Amount (CGST+SGST):</span>
                    <span>₹${totalTax.toFixed(2)}</span>
                </div>
            </div>

            <div class="divider"></div>

            <!-- Payment Mode -->
            <div style="font-size: 10px;">
                <div class="flex-between">
                    <span>Payment Method:</span>
                    <span><strong>${bill.paymentMethod}</strong></span>
                </div>
                ${bill.paymentMethod === 'SPLIT' && bill.splitBreakdown ? `
                    <div style="padding-left: 8px; font-size: 9.5px;">
                        ${bill.splitBreakdown.cashAmount > 0 ? `<div class="flex-between"><span>• Cash:</span><span>₹${bill.splitBreakdown.cashAmount}</span></div>` : ''}
                        ${bill.splitBreakdown.upiAmount > 0 ? `<div class="flex-between"><span>• UPI:</span><span>₹${bill.splitBreakdown.upiAmount}</span></div>` : ''}
                        ${bill.splitBreakdown.cardAmount > 0 ? `<div class="flex-between"><span>• Card:</span><span>₹${bill.splitBreakdown.cardAmount}</span></div>` : ''}
                    </div>
                ` : ''}
                ${bill.cashTendered > 0 ? `
                    <div class="flex-between">
                        <span>Cash Tendered:</span>
                        <span>₹${bill.cashTendered}</span>
                    </div>
                    <div class="flex-between">
                        <span>Change Returned:</span>
                        <span>₹${bill.changeReturned || 0}</span>
                    </div>
                ` : ''}
            </div>

            ${Number(savings) > 0 ? `
            <div class="savings-box">
                YOU SAVED ₹${savings} ON THIS BILL!
            </div>` : ''}

            <div class="double-divider"></div>

            <div class="text-center" style="font-size: 9px;">
                <div class="barcode-box">|||| | ||||| || ||||||</div>
                <div>${bill.billNumber}</div>
                <div style="margin-top: 4px; font-weight: bold;">${tagline}</div>
                <div style="color: #444; margin-top: 2px;">Goods once sold can be exchanged within 7 days with original invoice.</div>
            </div>
        </body>
        </html>
    `;

    return printHtmlViaIframe(html, `Receipt_${bill.billNumber}`);
}

/**
 * Print GST Sales Report & Invoice Statement (A4 Standard Format)
 */
export function printSalesReport(bills = [], storeConfig = {}, filterInfo = {}) {
    const storeName = storeConfig?.storeName || 'SUPERSTORE POS';
    const storeAddress = storeConfig?.address || '';
    const storeGstin = storeConfig?.gstin || '';
    const dateFormatted = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const totalBills = bills.length;
    const totalSales = bills.reduce((s, b) => s + (Number(b.netPayable) || 0), 0);
    const totalSavings = bills.reduce((s, b) => s + (Number(b.totalSavings) || 0), 0);
    const totalTax = bills.reduce((s, b) => s + (Number(b.taxAmount) || 0), 0);
    const totalTaxable = totalSales - totalTax;

    const rowsHtml = bills.map((b, idx) => {
        const dateStr = new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const tax = Number(b.taxAmount || 0);
        const net = Number(b.netPayable || 0);
        const taxable = (net - tax).toFixed(2);
        return `
            <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${b.billNumber}<br><small style="font-weight: normal; color: #64748b;">${dateStr}</small></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.cashierName || 'Cashier'}<br><small style="color: #64748b;">${b.counterNo || 'C-01'}</small></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.customerPhone ? `${b.customerName || 'Customer'} (${b.customerPhone})` : 'Walk-in'}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${b.items?.length || 0}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${taxable}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${tax.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">₹${net.toLocaleString('en-IN')}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 10px;">${b.paymentMethod}</td>
            </tr>
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>GST Sales Report - ${storeName}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #0f172a;
                }
                body {
                    padding: 10px;
                    font-size: 11px;
                    line-height: 1.4;
                }
                .header {
                    border-bottom: 2px solid #1e293b;
                    padding-bottom: 12px;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .kpi-card {
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 8px 12px;
                    background: #f8fafc;
                }
                .kpi-title {
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #475569;
                    font-weight: bold;
                }
                .kpi-val {
                    font-size: 16px;
                    font-weight: bold;
                    color: #0f172a;
                    margin-top: 2px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th {
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    padding: 6px;
                    font-size: 10.5px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .footer {
                    margin-top: 30px;
                    display: flex;
                    justify-content: space-between;
                    padding-top: 15px;
                    border-top: 1px solid #cbd5e1;
                    font-size: 10px;
                }
                .sig-box {
                    border-top: 1px solid #000;
                    width: 160px;
                    text-align: center;
                    margin-top: 35px;
                    padding-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h2 style="font-size: 20px; font-weight: 800; color: #1e3a8a;">${storeName.toUpperCase()}</h2>
                    ${storeAddress ? `<div>${storeAddress}</div>` : ''}
                    ${storeGstin ? `<div><strong>GSTIN:</strong> ${storeGstin}</div>` : ''}
                    <div style="font-size: 12px; font-weight: bold; margin-top: 4px; color: #1e293b;">
                        DAILY GST SALES &amp; INVOICE REGISTER
                    </div>
                </div>
                <div style="text-align: right; font-size: 10.5px;">
                    <div><strong>Report Generated:</strong> ${dateFormatted}</div>
                    <div><strong>Scope:</strong> ${filterInfo.scope || 'All Transactions'}</div>
                    <div><strong>Payment Filter:</strong> ${filterInfo.payment || 'All'}</div>
                </div>
            </div>

            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-title">Gross Sales Value</div>
                    <div class="kpi-val" style="color: #1e3a8a;">₹${totalSales.toLocaleString('en-IN')}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Taxable Turnover</div>
                    <div class="kpi-val">₹${totalTaxable.toFixed(2)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total GST Collected</div>
                    <div class="kpi-val" style="color: #047857;">₹${totalTax.toFixed(2)}</div>
                    <small style="font-size: 8.5px; color: #475569;">CGST: ₹${(totalTax/2).toFixed(2)} | SGST: ₹${(totalTax/2).toFixed(2)}</small>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total Invoices</div>
                    <div class="kpi-val">${totalBills} Bills</div>
                    <small style="font-size: 8.5px; color: #475569;">Savings: ₹${totalSavings.toFixed(2)}</small>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th>Invoice No &amp; Time</th>
                        <th>Cashier / Counter</th>
                        <th>Customer</th>
                        <th style="width: 45px;">Items</th>
                        <th style="text-align: right;">Taxable (₹)</th>
                        <th style="text-align: right;">GST (₹)</th>
                        <th style="text-align: right;">Total Net (₹)</th>
                        <th style="text-align: center;">Mode</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: bold;">
                        <td colspan="5" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">GRAND TOTALS:</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₹${totalTaxable.toFixed(2)}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">₹${totalTax.toFixed(2)}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #1e3a8a; font-size: 13px;">₹${totalSales.toLocaleString('en-IN')}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${totalBills} Bills</td>
                    </tr>
                </tfoot>
            </table>

            <div class="footer">
                <div>
                    <div>ShiftFlow Cloud POS &bull; Official Tax Statement</div>
                    <div style="color: #64748b;">Computer generated document. Valid without manual seal.</div>
                </div>
                <div class="sig-box">
                    Authorized Cashier / Officer Sign
                </div>
            </div>
        </body>
        </html>
    `;

    return printHtmlViaIframe(html, `GST_Sales_Report_${new Date().toISOString().slice(0, 10)}`);
}

/**
 * Share Bill directly to Customer's WhatsApp
 */
export function shareBillOnWhatsApp(bill, storeConfig = {}) {
    if (!bill) return;
    const phone = (bill.customerPhone || '').replace(/[^0-9]/g, '');
    const storeName = storeConfig?.storeName || bill.storeName || 'SuperStore';

    const itemsSummary = (bill.items || [])
        .slice(0, 5)
        .map((it, idx) => `${idx + 1}. ${it.name} x ${it.quantity} = ₹${it.total}`)
        .join('%0A');

    const moreText = (bill.items || []).length > 5 ? `%0A...+${bill.items.length - 5} more items` : '';

    const text = `🧾 *Tax Invoice - ${storeName}*%0A%0A` +
        `*Invoice No:* ${bill.billNumber}%0A` +
        `*Date:* ${new Date(bill.createdAt).toLocaleDateString('en-IN')}%0A` +
        `*Customer:* ${bill.customerName || 'Valued Customer'}%0A` +
        `---------------------------%0A` +
        `*Items Purchased:*%0A${itemsSummary}${moreText}%0A` +
        `---------------------------%0A` +
        `*Net Paid:* ₹${bill.netPayable} via ${bill.paymentMethod}%0A` +
        (bill.totalSavings > 0 ? `🎉 *You Saved:* ₹${bill.totalSavings}%0A` : '') +
        (storeConfig?.gstin ? `*GSTIN:* ${storeConfig.gstin}%0A` : '') +
        `%0AThank you for shopping with us! Visit again.`;

    const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
}

