'use client';

import Link from 'next/link';

export default function TestPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-8">Test Page</h1>
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-lg">
          <p className="mb-4">This page is to test navigation. Try these links:</p>
          <div className="space-y-2">
            <Link 
              href="/login" 
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            >
              Go to Login
            </Link>
            <Link 
              href="/register" 
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
            >
              Go to Register
            </Link>
            <Link 
              href="/" 
              className="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 