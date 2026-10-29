// CHANGED: new file — one-time helper for the switch from Clerk to the own login
// (2026-10-28). Runs on YOUR computer against the database in .env.
//
//   node --env-file=.env scripts/users.mjs list
//       Every user row: email, role, which owner a staff member belongs to, whether a
//       password is set, and how many events the row owns. Read-only. Use it to check
//       that each person's data is on the row their email will log into.
//
//   node --env-file=.env scripts/users.mjs set-password <email>
//       Asks for a new password (typed twice, hidden) and saves its bcrypt hash on that
//       user's row. Nothing else on the row is touched.

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import readline from "node:readline"

const prisma = new PrismaClient()

async function list() {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, ownerId: true, organizationName: true,
      passwordHash: true, clerkId: true, _count: { select: { events: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  const emailById = new Map(users.map(u => [u.id, u.email]))
  console.table(users.map(u => ({
    email: u.email,
    name: u.name ?? "",
    role: u.role ?? "(not chosen)",
    business: u.organizationName ?? "",
    "staff of": u.ownerId ? emailById.get(u.ownerId) ?? u.ownerId : "",
    events: u._count.events,
    password: u.passwordHash ? "set" : "NOT SET",
    "from Clerk": u.clerkId ? "yes" : "no",
  })))
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = s => { if (s.includes(question)) rl.output.write(s) } // hide what is typed
    rl.question(question, answer => { rl.close(); process.stdout.write("\n"); resolve(answer) })
  })
}

async function setPassword(emailArg) {
  if (!emailArg) throw new Error("Usage: node --env-file=.env scripts/users.mjs set-password <email>")
  const email = emailArg.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  })
  if (!user) throw new Error(`No user with email ${email}. Run "list" to see the emails.`)

  const pw = await askHidden(`New password for ${user.email} (${user.role ?? "no role"}): `)
  if (pw.length < 6) throw new Error("Password must be at least 6 characters")
  const again = await askHidden("Type it again: ")
  if (pw !== again) throw new Error("The two passwords were different — nothing saved")

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } })
  console.log(`Password saved for ${user.email}. They sign in with this email + password.`)
}

const [command, arg] = process.argv.slice(2)
try {
  if (command === "list") await list()
  else if (command === "set-password") await setPassword(arg)
  else console.log("Commands: list | set-password <email>")
} catch (error) {
  console.error("Error:", error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
