import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  console.log("Starting Tax Export...");

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    // 1. Fetch Orders WITHOUT the crashing filter
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "display_id",
        "created_at",
        "currency_code",
        "email",
        "shipping_address.country_code",
        "total",
        "subtotal",
        "tax_total",
        // Fetch Payment status details
        "payment_collections.status",
        "payment_collections.amount",
        // Items
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.tax_total",
        "items.tax_lines.*",
        // Shipping
        "shipping_methods.name",
        "shipping_methods.amount",
        "shipping_methods.tax_total",
        "shipping_methods.tax_lines.*"
      ],
      // REMOVED "filters: { payment_status: ... }" to prevent crash
    });

    console.log(`Found ${orders.length} total orders. Filtering for paid ones...`);

    // 2. Build CSV Rows
    const csvRows: string[] = [];
    
    csvRows.push([
      "Order ID", "Date", "Customer Email", "Country", "Currency", 
      "Type", "Description", "Quantity", "Unit Price", "Tax Rate", "Tax Amount", "Total"
    ].join(","));

    for (const order of orders) {
      // --- FILTERING LOGIC ---
      // In Medusa v2, we check the payment_collections to see if it's paid.
      // We look for any collection that is 'completed' or 'captured'.
      const isPaid = order.payment_collections?.some((pc: any) => 
        pc.status === 'captured' || pc.status === 'completed'
      );

      // Skip this order if it isn't paid
      if (!isPaid) continue; 
      // -----------------------

      const date = new Date(order.created_at).toISOString().split('T')[0];
      const country = order.shipping_address?.country_code?.toUpperCase() || "N/A";
      const currency = order.currency_code.toUpperCase();

      // Process Items
      if (order.items) {
        for (const item of order.items) {
          const taxLine = item.tax_lines && item.tax_lines.length > 0 ? item.tax_lines[0] : null;
          const taxRate = taxLine ? taxLine.rate : 0;
          const unitPrice = item.unit_price || 0;
          const taxAmount = item.tax_total || 0; 
          const total = (unitPrice * item.quantity) + taxAmount;

          csvRows.push([
            order.display_id,
            date,
            order.email || "Guest",
            country,
            currency,
            "Item",
            `"${(item.title || "").replace(/"/g, '""')}"`,
            item.quantity,
            unitPrice.toFixed(2),
            taxRate, 
            taxAmount.toFixed(2),
            total.toFixed(2)
          ].join(","));
        }
      }

      // Process Shipping
      if (order.shipping_methods) {
        for (const method of order.shipping_methods) {
          const taxLine = method.tax_lines && method.tax_lines.length > 0 ? method.tax_lines[0] : null;
          const taxRate = taxLine ? taxLine.rate : 0;
          const price = method.amount || 0;
          const tax = method.tax_total || 0;
          const total = price + tax;

          csvRows.push([
            order.display_id,
            date,
            order.email || "Guest",
            country,
            currency,
            "Shipping",
            `"${(method.name || "Shipping").replace(/"/g, '""')}"`,
            1,
            price.toFixed(2),
            taxRate,
            tax.toFixed(2),
            total.toFixed(2)
          ].join(","));
        }
      }
    }

    // 3. Send Response
    const csvString = csvRows.join("\n");
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=tax_report.csv`);
    res.send(csvString);

  } catch (error) {
    console.error("CRITICAL ERROR IN EXPORT:", error);
    res.status(500).json({ error: error.message });
  }
};