const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order pricing applies the HSN slab and caps SAVE10 against subtotal', function () {
  // These are the fields the order route persists on its item rows.
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 100,
      taxable: 900,
      tax: 45,
      net: 945
    }]
  });
});

test('invoice totals and HSN GST match the amounts billed by order pricing', function () {
  // Stored line items from routes/orders.js carry HSN but not gstRate.
  const order = {
    id: 1001,
    items: [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'SAVE10',
    total: 945
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 1000,
    discount: 100,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    rows: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 1,
      price: 1000,
      gstPercent: 5,
      line: 1000,
      lineTax: 45
    }]
  });

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice interprets a decimal gstRate as a decimal GST rate', function () {
  const order = {
    items: [{ name: 'Rice', price: 1000, qty: 1, gstRate: 0.05 }]
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 50);
  assert.equal(figures.total, 1050);
});
