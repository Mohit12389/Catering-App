import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { prisma } from "@/lib/prisma"

// =============================================
// CLERK WEBHOOK — SIGNATURE VERIFIED
// =============================================
// CHANGED: this route trusted whatever was posted to it. It is PUBLIC by necessity
// (middleware allows /api/webhooks(.*), because Clerk calls it with no user session),
// and it handles user.deleted with prisma.user.delete. Every User relation in
// schema.prisma is onDelete: Cascade, so one unauthenticated request —
//
//   { "type": "user.deleted", "data": { "id": "<clerkId>" } }
//
// — destroyed a business's entire history: events, bills, menu items, ingredients,
// categories. The only obstacle was guessing a clerkId, which is luck, not a control.
//
// Clerk signs every webhook with Svix. Verifying that signature is the fix, and it is
// what Clerk's own documentation requires. The secret comes from the Clerk dashboard
// (Webhooks -> your endpoint -> Signing Secret) as CLERK_WEBHOOK_SECRET.
//
// It FAILS CLOSED: no secret, missing headers or a bad signature all reject before any
// database call. That is safe to do because user rows no longer depend on this route —
// ensureDbUser creates them on the account's first page load. So the worst case while
// the secret is unset is that name/email changes stop syncing from Clerk, and account
// deletions stop being mirrored. Both are recoverable; a wiped database is not.

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    // Loud on purpose. Silently accepting unverified events is the bug being fixed.
    console.error("[webhooks/clerk] CLERK_WEBHOOK_SECRET is not set — rejecting the request")
    return NextResponse.json({ success: false, error: "Webhook not configured" }, { status: 500 })
  }

  // The signature is computed over the RAW body. Parsing it and re-serialising would
  // change the bytes (key order, whitespace) and every signature would fail, so read
  // text here and parse only what the verifier returns.
  const payload = await req.text()

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ success: false, error: "Missing signature headers" }, { status: 400 })
  }

  let event: { type?: string; data?: any }
  try {
    // verify() in svix 2.x VALIDATES and returns nothing — it signals failure by
    // throwing, so its result must not be used as the event. Parse the payload
    // ourselves once it has been proven authentic. (Assigning the return value here
    // is how this first went wrong: `undefined` destructured into a 500.)
    //
    // It throws on a bad signature and on a timestamp outside Svix's tolerance, which
    // is what stops a captured request being replayed later.
    new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    })
    event = JSON.parse(payload)
  } catch {
    // No detail in the response: a verifier that explains why it failed helps an
    // attacker tune the next attempt.
    console.error("[webhooks/clerk] signature verification failed")
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 })
  }

  try {
    const { type, data } = event

    if (type === "user.created" || type === "user.updated") {
      const { id, email_addresses, first_name, last_name } = data
      const email = email_addresses?.[0]?.email_address

      if (email) {
        await prisma.user.upsert({
          where: { clerkId: id },
          update: {
            email,
            name: [first_name, last_name].filter(Boolean).join(" ") || null
          },
          create: {
            clerkId: id,
            email,
            name: [first_name, last_name].filter(Boolean).join(" ") || null
          }
        })
      }
    }

    if (type === "user.deleted") {
      const { id } = data
      await prisma.user.delete({ where: { clerkId: id } }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
