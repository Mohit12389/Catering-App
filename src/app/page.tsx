import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChefHat, ArrowRight } from "lucide-react"

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="text-center space-y-6 p-8">
        <div className="w-24 h-24 rounded-full bg-primary mx-auto flex items-center justify-center">
          <ChefHat className="w-14 h-14 text-primary-foreground" />
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-primary">Catering Manager</h1>
          <p className="text-muted-foreground mt-2">Event Management System</p>
        </div>

        <p className="max-w-md text-muted-foreground">
          Manage your catering events, create menus, track ingredients, and streamline your business operations.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/sign-in" className="btn-primary btn-lg">
            Sign In
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link href="/sign-up" className="btn-outline btn-lg">
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}
