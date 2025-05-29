import jwt from 'jsonwebtoken';

// JWT secret from environment variables or a default for development
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-development-only';

// Sign JWT token
export const signToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d' // Token valid for 30 days
  });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Auth middleware for API routes
export const isAuthenticated = async (req) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers && req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Get token from cookies
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return null;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    return decoded.id;
  } catch (error) {
    return null;
  }
}; 