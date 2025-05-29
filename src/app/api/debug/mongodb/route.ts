import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    // Connect to MongoDB
    const mongoose = await connectToDatabase();
    
    // Get all users (just count for security)
    const userCount = await User.countDocuments();
    
    // Get MongoDB connection status
    const connectionStatus = mongoose.connection.readyState;
    
    // Return connection info
    return NextResponse.json({
      success: true,
      message: 'MongoDB connection successful',
      connection: {
        status: connectionStatus === 1 ? 'connected' : 'disconnected',
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
      users: {
        count: userCount,
      }
    });
  } catch (error) {
    console.error('MongoDB debug error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'MongoDB connection failed',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 