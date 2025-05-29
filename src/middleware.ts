import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // TEMPORARILY DISABLED FOR TESTING - just pass all requests through
  console.log('Middleware disabled for testing');
  return NextResponse.next();

  // Original middleware logic below
  /*
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Define paths that are considered public (no auth required)
  const publicPaths = ['/login', '/register'];
  const isPublicPath = publicPaths.some(publicPath => path === publicPath);
  
  // Get token from cookies
  const token = request.cookies.get('token')?.value || '';
  
  // If the path is public and user is already logged in, redirect to home
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // If the path is private and user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Continue with the request
  return NextResponse.next();
  */
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    // Exclude static files, api routes, and _next paths
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)'
  ]
}; 