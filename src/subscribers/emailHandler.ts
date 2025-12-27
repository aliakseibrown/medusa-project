import { 
  SubscriberArgs, 
  SubscriberConfig 
} from "@medusajs/medusa"
import { Modules } from "@medusajs/utils"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// --- HELPER: Format Money ---
const formatCurrency = (amount: number, currency: string) => {
  if (!amount && amount !== 0) return "-"
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

// --- HELPER: Base Email Layout (Wrapper) ---
const wrapHtml = (content: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; -webkit-font-smoothing: antialiased; }
        .mono { font-family: 'Courier New', Courier, monospace; letter-spacing: -0.5px; }
      </style>
    </head>
    <body style="background-color: #f4f4f4; margin: 0; padding: 40px 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border: 1px solid #e5e5e5;">
        ${content}
        <div style="margin-top: 40px; border-top: 1px solid #e5e5e5; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
          <p style="margin-top: 10px;">[ RUGA STORE ]</p>
        </div>
      </div>
    </body>
  </html>
`

// --- TEMPLATE: Order Placed ---
const generateOrderHtml = (order: any) => {
  const itemsHtml = order.items.map((item: any) => {
    const image = item.thumbnail || item.variant?.product?.thumbnail || "";
    return `
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 16px 0; width: 80px;">
          ${image ? `<img src="${image}" alt="${item.title}" style="width: 60px; height: 75px; object-fit: cover; border: 1px solid #e5e5e5;">` : '<div style="width:60px; height:75px; background: #eee;"></div>'}
        </td>
        <td style="padding: 16px 0;">
          <span style="display: block; font-weight: bold; text-transform: uppercase; font-size: 14px; color: #000;">${item.product_title || item.title}</span>
          <span style="display: block; font-size: 12px; color: #666; margin-top: 4px;">${item.variant_title !== 'Default Variant' ? item.variant_title : ''}</span>
          <span style="display: block; font-size: 12px; color: #666;">Qty: ${item.quantity}</span>
        </td>
        <td style="padding: 16px 0; text-align: right; font-family: monospace; font-size: 14px;">
          ${formatCurrency(item.unit_price, order.currency_code)}
        </td>
      </tr>
    `
  }).join("")

  return wrapHtml(`
    <div style="margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Order Confirmed</h1>
      <p style="margin: 5px 0 0; color: #666; font-size: 14px;">[ ID: ${order.display_id} ]</p>
    </div>

    <p style="font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
      Hi ${order.shipping_address?.first_name || "there"},<br><br>
      Thank you for your order. We have received it and will notify you once it ships.
    </p>

    <div style="margin-bottom: 30px;">
      <div style="border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 0;">
        <span style="font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">* Item Details</span>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>
    </div>

    <div style="background-color: #f9f9f9; padding: 20px; border: 1px dashed #ccc;">
      <table style="width: 100%; font-family: monospace;">
        <tr>
          <td style="padding-bottom: 8px;">Subtotal</td>
          <td style="text-align: right;">${formatCurrency(order.subtotal, order.currency_code)}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 8px;">Shipping</td>
          <td style="text-align: right;">${formatCurrency(order.shipping_total, order.currency_code)}</td>
        </tr>
        ${order.tax_total > 0 ? `
        <tr>
          <td style="padding-bottom: 8px;">Tax</td>
          <td style="text-align: right;">${formatCurrency(order.tax_total, order.currency_code)}</td>
        </tr>` : ''}
        <tr style="font-weight: bold; font-size: 16px; border-top: 1px solid #ccc;">
          <td style="padding-top: 12px;">[ TOTAL ]</td>
          <td style="text-align: right; padding-top: 12px;">${formatCurrency(order.total, order.currency_code)}</td>
        </tr>
      </table>
    </div>
  `)
}

// --- TEMPLATE: Shipment Created ---
const generateShipmentHtml = (fulfillment: any) => {
  const tracking = fulfillment.tracking_links?.[0]
  return wrapHtml(`
    <div style="margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">[ SHIPPED ]</h1>
      <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Order #${fulfillment.order.display_id} is on the way.</p>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 20px; border: 1px dashed #ccc; text-align: center;">
      <p style="margin: 0 0 10px 0; font-family: monospace; font-size: 14px; color: #666;">TRACKING NUMBER</p>
      <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">${tracking?.tracking_number || "N/A"}</p>
      
      <a href="${tracking?.url || '#'}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 1px;">
        Track Package
      </a>
    </div>
  `)
}

// --- TEMPLATE: Order Canceled ---
const generateCanceledHtml = (order: any) => {
  return wrapHtml(`
    <div style="margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">[ CANCELED ]</h1>
      <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Order #${order.display_id}</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.5;">
      Hi ${order.shipping_address?.first_name || "there"},<br><br>
      Your order <strong>#${order.display_id}</strong> has been canceled. 
      Any payment made has been refunded.
    </p>

    <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 4px solid #000;">
      <p style="margin: 0; font-size: 14px; color: #444;">If you have any questions or believe this was a mistake, please reply to this email.</p>
    </div>
  `)
}

// --- TEMPLATE: Customer Created (Welcome) ---
const generateWelcomeHtml = (customer: any) => {
  return wrapHtml(`
    <div style="margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">[ WELCOME ]</h1>
      <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Welcome to the club.</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
      Hi ${customer.first_name || "Customer"},<br><br>
      Thank you for creating an account with us. You can now track your orders and checkout faster.
    </p>

    <a href="${process.env.STORE_URL || '#'}" style="display: inline-block; border: 1px solid #000; color: #000; padding: 12px 24px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 1px; transition: all 0.2s;">
      Visit Store
    </a>
  `)
}

// ====================================================
// MAIN HANDLER
// ====================================================
export default async function emailHandler({
  event: { data, name }, 
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const query = container.resolve("query")
  const fromEmail = process.env.MY_STORE_FROM_EMAIL || 'orders@example.com'

  // 1. ORDER PLACED
  if (name === "order.placed") {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "*", 
        "total", "subtotal", "tax_total", "shipping_total", 
        "currency_code", "display_id", "email",
        "items.*", 
        "items.variant.*",
        "items.variant.product.*", 
        "shipping_address.*", 
        "customer.*", 
        "metadata"
      ],
      filters: { id: data.id },
    })
    
    if (!order) return

    // Customer Name Update Logic
    const updateData: any = {}
    if (order.shipping_address?.first_name && (!order.customer.first_name || order.customer.first_name === "Guest")) {
       updateData.first_name = order.shipping_address.first_name
       updateData.last_name = order.shipping_address.last_name
    }
    if (Object.keys(updateData).length > 0) {
        const customerService = container.resolve(Modules.CUSTOMER)
        await customerService.updateCustomers(order.customer.id, updateData)
    }

    // Newsletter Logic
    if (order.metadata?.newsletter_subscribed && process.env.RESEND_AUDIENCE_ID) {
        try {
            await resend.contacts.create({
                email: order.email,
                firstName: order.shipping_address?.first_name || "Guest",
                unsubscribed: false,
                audienceId: process.env.RESEND_AUDIENCE_ID
            })
        } catch (err) {
            console.warn("[Resend] Contact Error:", err.message)
        }
    }

    // Send Email
    try {
        await resend.emails.send({
            from: fromEmail,
            to: order.email,
            subject: `Order Confirmed #${order.display_id}`,
            html: generateOrderHtml(order)
        })
        console.log(`[Resend] Order Confirmation sent to ${order.email}`)
    } catch (err) {
        console.error("[Resend] Email Failed:", err.message)
    }
  }

  // 2. SHIPMENT CREATED
  if (name === "shipment.created") {
    const { data: [fulfillment] } = await query.graph({
      entity: "fulfillment",
      fields: ["*", "tracking_links.*", "order.email", "order.display_id"],
      filters: { id: data.id },
    })

    if (!fulfillment?.order) return
    
    try {
      await resend.emails.send({
        from: fromEmail,
        to: fulfillment.order.email,
        subject: `Order #${fulfillment.order.display_id} Shipped`,
        html: generateShipmentHtml(fulfillment)
      })
    } catch (err) {
      console.error("[Resend] Shipment Email Failed:", err.message)
    }
  }

  // 3. ORDER CANCELED
  if (name === "order.canceled") {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["email", "display_id", "shipping_address.first_name"],
      filters: { id: data.id },
    })

    if (!order) return

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.email,
        subject: `Order #${order.display_id} Canceled`,
        html: generateCanceledHtml(order)
      })
      console.log(`[Resend] Cancellation email sent to ${order.email}`)
    } catch (err) {
      console.error("[Resend] Cancellation Email Failed:", err.message)
    }
  }

  // 4. CUSTOMER CREATED
  if (name === "customer.created") {
    const { data: [customer] } = await query.graph({
      entity: "customer",
      fields: ["email", "first_name"],
      filters: { id: data.id },
    })

    if (!customer) return

    try {
      await resend.emails.send({
        from: fromEmail,
        to: customer.email,
        subject: `Welcome to Our Store`,
        html: generateWelcomeHtml(customer)
      })
      console.log(`[Resend] Welcome email sent to ${customer.email}`)
    } catch (err) {
      console.error("[Resend] Welcome Email Failed:", err.message)
    }
  }
}

// Subscribe to ALL events
export const config: SubscriberConfig = {
  event: [
    "order.placed", 
    "shipment.created", 
    "order.canceled", 
    "customer.created"
  ],
}