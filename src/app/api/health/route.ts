import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(
      JSON.stringify({ 
        status: "ok", 
        timestamp: new Date().toISOString() 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ status: "error" }),
      { status: 500 }
    )
  }
}

// Add HEAD method for UptimeRobot
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}