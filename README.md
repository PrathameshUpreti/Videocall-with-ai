# Deep Research Backend for Video Call App

This Python backend provides intelligent research capabilities for the video call application, using SearXNG for web searches and OpenAI for synthesizing comprehensive responses. It also includes a Multi-Channel Platform (MCP) server for Gmail and WhatsApp integration, and a user authentication system with MongoDB.

## Features

- Real-time research during video calls
- Intelligent synthesis of search results using OpenAI
- Fallback to SearXNG search results when OpenAI API is not available
- Mock results for common topics for demo purposes
- Gmail integration for sending and receiving emails
- WhatsApp integration using Twilio API for sending messages
- User authentication system with secure login/signup
- MongoDB integration for storing user data

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Node.js (for the frontend)
- MongoDB (local or cloud)
- OpenAI API key (optional but recommended)
- Access to a SearXNG instance (default uses public instance at searx.be)
- Gmail API credentials (for Gmail integration)
- Twilio account with WhatsApp capabilities (for WhatsApp integration)

### Installation

1. Clone the repository (if not already done)

2. Install Python dependencies
   ```
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies
   ```
   npm install
   ```

4. Configure environment variables
   ```
   cp server_env_example .env
   ```
   Edit `.env` file and add your API keys and credentials

5. Set up the authentication system
   ```
   npm run setup:auth
   ```
   This will create a `.env.local` file with MongoDB and JWT configurations

### Configuring Gmail Integration

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gmail API
3. Configure OAuth consent screen
4. Create OAuth client ID credentials
5. Add the client ID and secret to your `.env` file:
   ```
   GMAIL_CLIENT_ID=your_client_id_here
   GMAIL_CLIENT_SECRET=your_client_secret_here
   GMAIL_REDIRECT_URI=http://localhost:5000/mcp/gmail/callback
   ```

### Configuring WhatsApp Integration

1. Sign up for a [Twilio account](https://www.twilio.com/try-twilio)
2. Set up WhatsApp sandbox in your Twilio account
3. Add your Twilio credentials to your `.env` file:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=your_phone_number_here
   ```

### Running the Backend

1. Start the Python Flask server
   ```
   python server.py
   ```
   The server will run on http://localhost:5000 by default

2. In a separate terminal, start the Node.js frontend
   ```
   npm run dev
   ```

## API Endpoints

### Research Endpoint

**URL**: `/api/research`
**Method**: `POST`
**Request Body**:
```json
{
  "query": "Your research query here"
}
```

**Response**:
```json
{
  "results": "Comprehensive research results formatted as text..."
}
```

### Gmail Endpoints

**Authentication**: `/mcp/gmail/auth`
**Status Check**: `/mcp/gmail/status`
**List Messages**: `/mcp/gmail/messages`
**Send Email**: `/mcp/gmail/send`

### WhatsApp Endpoints

**Status Check**: `/mcp/whatsapp/status`
**Send Message**: `/mcp/whatsapp/send`

## Using SearXNG

This application is configured to use the public SearXNG instance at searx.be by default. For better privacy and reliability, consider:

1. Using another public instance from the [SearXNG instances list](https://searx.space/)
2. Self-hosting your own SearXNG instance

## Using with OpenAI

For best results, provide a valid OpenAI API key in your `.env` file. The application will:
- Use OpenAI to generate comprehensive, well-structured research summaries
- Fall back to direct search results if OpenAI integration fails or is not configured

## MCP Integration

The Multi-Channel Platform (MCP) integration allows users to:

1. Connect their Gmail account and:
   - View recent emails
   - Send emails directly from the application
   - Use email templates
   - Search through emails
   - Star important messages
   
2. Send WhatsApp messages using Twilio's API:
   - Manage contacts and conversations
   - Use message templates
   - Track message status and notifications
   - Recipients must opt in to receive messages from your Twilio WhatsApp number
   - For production use, apply for a WhatsApp Business Account through Twilio

### Enhanced MCP Features (New)

We've dramatically improved the MCP integration with:

1. **New UI Components**:
   - Tabbed interfaces for better organization
   - Improved message threading and conversation views
   - Real-time status indicators and notifications
   - Advanced search and filtering capabilities

2. **Templates System**:
   - Pre-defined templates for common message types
   - Custom template creation and management
   - Quick application of templates to messages

3. **Better User Experience**:
   - Streamlined authentication flows
   - Improved error handling and feedback
   - Modern, responsive design for all device sizes
   - Animations and transitions for a polished feel

For detailed information about the MCP integration, please refer to the [MCP-README.md](MCP-README.md) file.

## Customization

- Modify the `synthesize_with_openai` function to adjust the prompt or output formatting
- Update the `search_with_searxng` function to change search parameters or result formatting
- Add additional data sources by creating new search functions and integrating them into the workflow
- Expand the MCP integration to include other communication channels

## Authentication System

The application includes a complete user authentication system:

### Features

- User registration with email, username, and password
- Secure login with JWT token-based authentication
- Password hashing with bcrypt
- Protected routes for authenticated users
- User session management

### Authentication Setup

1. Make sure MongoDB is installed and running
   ```
   # For local MongoDB
   mongod --dbpath /path/to/data/db
   ```

2. Run the authentication setup script
   ```
   npm run setup:auth
   ```

3. Start the application
   ```
   npm run dev
   ```

4. Access the registration page
   ```
   http://localhost:3000/register
   ```

For more details about the authentication system, see [AUTH_README.md](AUTH_README.md).
