import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body

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
