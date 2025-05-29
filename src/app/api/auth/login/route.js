import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Parse request body
    const { email, password } = await req.json();
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Please provide email and password' },
        { status: 400 }
      );
    }
    
    // Find user and select password field explicitly
    const user = await User.findOne({ email }).select('+password');
    
    // Check if user exists
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = signToken(user._id);
    
    // Create response with cookie
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      },
      { status: 200 }
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
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong' },
      { status: 500 }
    );
  }
} 