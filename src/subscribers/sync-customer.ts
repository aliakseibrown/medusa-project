import { 
  SubscriberArgs, 
  SubscriberConfig 
} from "@medusajs/medusa"
import { Modules } from "@medusajs/utils"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function emailHandler({
  event: { data, name }, 
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const query = container.resolve("query")
  const fromEmail = process.env.MY_STORE_FROM_EMAIL || 'orders@example.com'

  // ====================================================
  // 1. ORDER PLACED (Confirmation + Data Sync)
  // ====================================================
  if (name === "order.placed") {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["*", "email", "display_id", "total", "currency_code", "shipping_address.*", "customer.*", "metadata"],
      filters: { id: data.id },
    })
    
    if (!order) return

    // A. Sync Customer Data (Name/Phone)
    const updateData: any = {}
    if (order.shipping_address?.first_name && (!order.customer.first_name || order.customer.first_name === "Guest")) {
       updateData.first_name = order.shipping_address.first_name
       updateData.last_name = order.shipping_address.last_name
    }
    if (order.metadata) {
       updateData.metadata = { ...order.customer.metadata, ...order.metadata }
    }
    
    // Update Customer if needed
    if (Object.keys(updateData).length > 0) {
       const customerService = container.resolve(Modules.CUSTOMER)
       await customerService.updateCustomers(order.customer.id, updateData)
    }

    // B. Add to Newsletter (Resend Audience)
    if (order.metadata?.newsletter_subscribed && process.env.RESEND_AUDIENCE_ID) {
       await resend.contacts.create({
         email: order.email,
         firstName: order.shipping_address?.first_name || "Guest",
         unsubscribed: false,
         audienceId: process.env.RESEND_AUDIENCE_ID
       }).catch(err => console.error("Resend Contact Error:", err))
    }

    // C. Send Confirmation Email
    await resend.emails.send({
      from: fromEmail,
      to: order.email,
      subject: `Order Confirmed #${order.display_id}`,
      html: `<h1>Thanks for your order!</h1><p>Order #${order.display_id} is confirmed.</p>`
    })
  }

  // ====================================================
  // 2. SHIPMENT CREATED (Tracking Info)
  // ====================================================
  if (name === "shipment.created") {
    const { data: [fulfillment] } = await query.graph({
      entity: "fulfillment",
      fields: ["*", "tracking_links.*", "order.email", "order.display_id"],
      filters: { id: data.id },
    })

    if (!fulfillment?.order) return

    const tracking = fulfillment.tracking_links?.[0]
    
    await resend.emails.send({
      from: fromEmail,
      to: fulfillment.order.email,
      subject: `Order #${fulfillment.order.display_id} Shipped`,
      html: `
        <h1>Your order is on the way!</h1>
        <p>Tracking Number: ${tracking?.tracking_number || "N/A"}</p>
        <p><a href="${tracking?.url || '#'}">Track Package</a></p>
      `
    })
  }

  // ====================================================
  // 3. ORDER CANCELED (Cancellation Notice)
  // ====================================================
  if (name === "order.canceled") {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["email", "display_id", "shipping_address.first_name"],
      filters: { id: data.id },
    })

    if (!order) return

    await resend.emails.send({
      from: fromEmail,
      to: order.email,
      subject: `Order #${order.display_id} Canceled`,
      html: `
        <p>Hi ${order.shipping_address?.first_name || "there"},</p>
        <p>Your order <strong>#${order.display_id}</strong> has been canceled.</p>
        <p>If you have questions, please reply to this email.</p>
      `
    })
    console.log(`[Resend] Sent cancellation email to ${order.email}`)
  }

  // ====================================================
  // 4. CUSTOMER CREATED (Welcome Email)
  // ====================================================
  if (name === "customer.created") {
    const { data: [customer] } = await query.graph({
      entity: "customer",
      fields: ["email", "first_name"],
      filters: { id: data.id },
    })

    if (!customer) return

    await resend.emails.send({
      from: fromEmail,
      to: customer.email,
      subject: `Welcome to Our Store!`,
      html: `
        <h1>Welcome ${customer.first_name || "Customer"}!</h1>
        <p>Thank you for creating an account with us.</p>
      `
    })
    console.log(`[Resend] Sent welcome email to ${customer.email}`)
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