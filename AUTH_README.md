# Authentication System Setup

This document explains how to set up the authentication system for the Video Call App.

## Environment Variables

Create a file named `.env.local` in the root directory with the following content:

```
MONGODB_URI=mongodb://localhost:27017/video_call_app
JWT_SECRET=your-secret-key-for-development-change-in-production
```

Make sure to change the JWT_SECRET to a strong random string in production.

## MongoDB Setup

1. Install MongoDB on your machine or use a cloud provider like MongoDB Atlas.
2. Start the MongoDB service.
3. The application will automatically create the required database and collections.

## Running the Application

1. Install the dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Access the application at [http://localhost:3000](http://localhost:3000)

## Authentication Flow

- Users can register with username, email, and password
- Users can log in with email and password
- Authenticated users will receive a JWT token stored in an HTTP-only cookie
- Protected routes will check for the token and redirect to login if missing

## API Routes

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in an existing user
- `POST /api/auth/logout` - Log out the current user
- `GET /api/auth/me` - Get the current user's information 