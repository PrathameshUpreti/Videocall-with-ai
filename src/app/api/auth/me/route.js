import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { isAuthenticated } from '@/lib/auth';

export async function GET(req) {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Check if user is authenticated
    const userId = await isAuthenticated(req);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Find user by ID
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Return user data
    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong' },
      { status: 500 }
    );
  }
} 