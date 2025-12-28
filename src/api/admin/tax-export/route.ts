import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // 1. Fetch Orders (Completed/Captured only)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "display_id",
      "created_at",
      "currency_code",
      "email",
      "region.name",
      "shipping_address.country_code",
      // Totals
      "total",
      "subtotal",
      "tax_total",
      // Items & Tax Lines
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.tax_total",
      "items.tax_lines.rate",
      "items.tax_lines.code",
      // Shipping & Tax Lines
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.tax_total",
      "shipping_methods.tax_lines.rate"
    ],
    filters: {
      payment_status: "captured", 
    },
  });

  // 2. Build CSV Rows
  const csvRows: string[] = [];
  
  // -- Headers --
  csvRows.push([
    "Order ID",
    "Date",
    "Customer Email",
    "Country",
    "Currency",
    "Type", // Item or Shipping
    "Description",
    "Quantity",
    "Unit Price (Net)",
    "Tax Rate (%)",
    "Tax Amount",
    "Total (Gross)"
  ].join(","));

  for (const order of orders) {
    const date = new Date(order.created_at).toISOString().split('T')[0];
    const country = order.shipping_address?.country_code?.toUpperCase() || "N/A";
    const currency = order.currency_code.toUpperCase();

    // -- Process Product Items --
    for (const item of order.items) {
      // Calculate implied tax rate from the first tax line (if multiple, this logic needs expanding)
      const taxRate = item.tax_lines?.[0]?.rate || 0;
      const unitPrice = item.unit_price || 0;
      const taxAmount = item.tax_total || 0;
      const total = (unitPrice * item.quantity) + taxAmount;

      csvRows.push([
        order.display_id,
        date,
        order.email,
        country,
        currency,
        "Item",
        `"${item.title.replace(/"/g, '""')}"`, // Escape quotes
        item.quantity,
        (unitPrice).toFixed(2),
        taxRate, 
        (taxAmount).toFixed(2),
        (total).toFixed(2)
      ].join(","));
    }

    // -- Process Shipping --
    if (order.shipping_methods) {
      for (const method of order.shipping_methods) {
        const taxRate = method.tax_lines?.[0]?.rate || 0;
        const price = method.amount || 0;
        const tax = method.tax_total || 0;
        const total = price + tax;

        csvRows.push([
          order.display_id,
          date,
          order.email,
          country,
          currency,
          "Shipping",
          `"${method.name}"`,
          1,
          (price).toFixed(2),
          taxRate,
          (tax).toFixed(2),
          (total).toFixed(2)
        ].join(","));
      }
    }
  }

  // 3. Send Response
  const csvString = csvRows.join("\n");
  
  // Date for filename
  const filename = `tax_report_${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(csvString);
};