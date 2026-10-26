import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth"

// CHANGED: new route — expense names this business has used before (Waiters,
// Transport…), for the name suggestions on the Event Menu page's Expenses card.
// Asked for only when a name box is first focused, so it never slows page load.
export const GET = withAuth(async (_req, { effectiveUserId }) => {
  const rows = await prisma.eventExpense.findMany({
    where: { event: { userId: effectiveUserId } },
    select: { name: true },
    distinct: ["name"],
    orderBy: { name: "asc" },
    take: 200
  })
  return NextResponse.json({ success: true, data: rows.map(r => r.name) })
})
