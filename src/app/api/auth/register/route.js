import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Parse request body
    const { username, email, password } = await req.json();
    
    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Please provide username, email and password' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User with that email or username already exists' },
        { status: 400 }
      );
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password
    });
    
    // Generate JWT token
    const token = signToken(user._id);
    
    // Create response with cookie
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      },
      { status: 201 }
    );
    
    // Set cookie with token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong' },
      { status: 500 }
    );
  }
} 