import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Ping database to keep it warm
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({ 
      status: "ok", 
      timestamp: new Date().toISOString() 
    })
  } catch (error) {
    return NextResponse.json({ 
      status: "error", 
      message: "Database unreachable" 
    }, { status: 500 })
  }
}