import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  
  // We redirect all auth callbacks to a client-side verification page.
  // This completely prevents email security scanners from consuming the one-time tokens
  // because scanners do not execute client-side JavaScript.
  return NextResponse.redirect(`${origin}/auth/verify?${searchParams.toString()}`)
}
