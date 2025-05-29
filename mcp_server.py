"""
Multi-Channel Platform (MCP) Server for integrating Gmail and GitLab
"""
from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import os
import json
import yaml
import base64
import time
from dotenv import load_dotenv
import requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import pickle

# Allow OAuth over HTTP for development
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Load environment variables
load_dotenv()

# Initialize Flask app
mcp_app = Flask(__name__)
CORS(mcp_app, resources={r"/mcp/*": {"origins": "*"}})
mcp_app.secret_key = os.getenv("MCP_SECRET_KEY", os.urandom(24))

# Environment variables
GMAIL_CLIENT_ID = os.getenv('GMAIL_CLIENT_ID', '')
GMAIL_CLIENT_SECRET = os.getenv('GMAIL_CLIENT_SECRET', '')
GMAIL_REDIRECT_URI = os.getenv('GMAIL_REDIRECT_URI', 'http://localhost:5001/mcp/gmail/callback')
GMAIL_TOKEN_FILE = 'gmail_token.pickle'
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 
               'https://www.googleapis.com/auth/gmail.send',
               'https://www.googleapis.com/auth/gmail.labels']

# GitLab configuration
GITLAB_URL = os.getenv('GITLAB_URL', 'https://gitlab.com')
GITLAB_TOKEN = os.getenv('GITLAB_TOKEN', '')  # Personal access token

# ----------------- Gmail Integration -----------------

def get_gmail_service():
    """Create and return Gmail API service"""
    creds = None
    
    # Check if token file exists
    if os.path.exists(GMAIL_TOKEN_FILE):
        with open(GMAIL_TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
            
    # Check if credentials are valid
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            return None  # User needs to authenticate
            
        # Save the credentials for the next run
        with open(GMAIL_TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
            
    # Build and return the Gmail API service
    return build('gmail', 'v1', credentials=creds)

@mcp_app.route('/mcp/gmail/auth', methods=['GET'])
def gmail_auth():
    """Initiate Gmail OAuth flow"""
    try:
        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GMAIL_CLIENT_ID,
                    "client_secret": GMAIL_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GMAIL_REDIRECT_URI]
                }
            },
            scopes=GMAIL_SCOPES
        )
        flow.redirect_uri = GMAIL_REDIRECT_URI
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Store state in session
        session['state'] = state
        
        # Redirect user to Google's OAuth page
        return redirect(authorization_url)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mcp_app.route('/mcp/gmail/callback', methods=['GET'])
def gmail_callback():
    """Handle Gmail OAuth callback"""
    try:
        # Get state from session
        state = session.get('state')
        
        # Create flow instance with state
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GMAIL_CLIENT_ID,
                    "client_secret": GMAIL_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GMAIL_REDIRECT_URI]
                }
            },
            scopes=GMAIL_SCOPES,
            state=state
        )
        flow.redirect_uri = GMAIL_REDIRECT_URI
        
        # Process callback response
        authorization_response = request.url
        flow.fetch_token(authorization_response=authorization_response)
        
        # Get credentials
        credentials = flow.credentials
        
        # Save credentials
        with open(GMAIL_TOKEN_FILE, 'wb') as token:
            pickle.dump(credentials, token)
            
        # Redirect back to the main application
        return redirect('http://localhost:3000/mcp')
    
    except Exception as e:
        # In case of error, redirect back to the main application with error parameter
        return redirect('http://localhost:3000/mcp?error=' + str(e))

@mcp_app.route('/mcp/gmail/status', methods=['GET'])
def gmail_status():
    """Check Gmail authentication status"""
    try:
        if os.path.exists(GMAIL_TOKEN_FILE):
            with open(GMAIL_TOKEN_FILE, 'rb') as token:
                creds = pickle.load(token)
                
            if creds and creds.valid:
                gmail = build('gmail', 'v1', credentials=creds)
                profile = gmail.users().getProfile(userId='me').execute()
                return jsonify({"authenticated": True, "email": profile.get('emailAddress')})
                
        return jsonify({"authenticated": False})
    
    except Exception as e:
        return jsonify({"authenticated": False, "error": str(e)})

@mcp_app.route('/mcp/gmail/messages', methods=['GET'])
def gmail_messages():
    """Get recent Gmail messages"""
    try:
        # Get Gmail service
        gmail = get_gmail_service()
        
        if not gmail:
            return jsonify({"error": "Gmail authentication required"}), 401
            
        # Get messages
        results = gmail.users().messages().list(userId='me', maxResults=10).execute()
        messages = results.get('messages', [])
        
        message_list = []
        
        for message in messages:
            msg = gmail.users().messages().get(userId='me', id=message['id']).execute()
            
            # Get message details
            headers = msg['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), 'Unknown Date')
            
            # Get message snippet
            snippet = msg.get('snippet', '')
            
            message_list.append({
                'id': message['id'],
                'subject': subject,
                'sender': sender,
                'date': date,
                'snippet': snippet
            })
            
        return jsonify({"messages": message_list})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mcp_app.route('/mcp/gmail/send', methods=['POST'])
def gmail_send():
    """Send an email through Gmail"""
    try:
        # Get Gmail service
        gmail = get_gmail_service()
        
        if not gmail:
            return jsonify({"error": "Gmail authentication required"}), 401
            
        # Get request data
        data = request.json
        to = data.get('to')
        subject = data.get('subject')
        body = data.get('body')
        
        if not all([to, subject, body]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Create email message
        message = {
            'raw': base64.urlsafe_b64encode(
                f"To: {to}\r\nSubject: {subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}".encode()
            ).decode()
        }
        
        # Send email
        sent_message = gmail.users().messages().send(userId='me', body=message).execute()
        
        return jsonify({"message": "Email sent successfully", "id": sent_message['id']})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- GitLab Integration -----------------

@mcp_app.route('/mcp/gitlab/status', methods=['GET'])
def gitlab_status():
    """Check GitLab authentication status"""
    try:
        if not GITLAB_TOKEN:
            return jsonify({"authenticated": False, "error": "GitLab token not configured"})

        # Verify token by making an API call
        headers = {'Authorization': f'Bearer {GITLAB_TOKEN}'}
        response = requests.get(f"{GITLAB_URL}/api/v4/user", headers=headers)
        
        if response.status_code == 200:
            user_data = response.json()
            return jsonify({
                "authenticated": True,
                "username": user_data.get('username'),
                "name": user_data.get('name')
            })
        return jsonify({"authenticated": False, "error": "Invalid token"})
    except Exception as e:
        return jsonify({"authenticated": False, "error": str(e)})

@mcp_app.route('/mcp/gitlab/projects', methods=['GET'])
def gitlab_projects():
    """Get user's GitLab projects"""
    try:
        if not GITLAB_TOKEN:
            return jsonify({"error": "GitLab token not configured"}), 401

        headers = {'Authorization': f'Bearer {GITLAB_TOKEN}'}
        response = requests.get(f"{GITLAB_URL}/api/v4/projects", headers=headers)
        
        if response.status_code == 200:
            return jsonify({"projects": response.json()})
        return jsonify({"error": "Failed to fetch projects"}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mcp_app.route('/mcp/gitlab/issues', methods=['GET'])
def gitlab_issues():
    """Get issues from a GitLab project"""
    try:
        if not GITLAB_TOKEN:
            return jsonify({"error": "GitLab token not configured"}), 401

        project_id = request.args.get('project_id')
        if not project_id:
            return jsonify({"error": "Project ID required"}), 400

        headers = {'Authorization': f'Bearer {GITLAB_TOKEN}'}
        response = requests.get(
            f"{GITLAB_URL}/api/v4/projects/{project_id}/issues",
            headers=headers
        )
        
        if response.status_code == 200:
            return jsonify({"issues": response.json()})
        return jsonify({"error": "Failed to fetch issues"}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mcp_app.route('/mcp/gitlab/create-issue', methods=['POST'])
def gitlab_create_issue():
    """Create a new issue in a GitLab project"""
    try:
        if not GITLAB_TOKEN:
            return jsonify({"error": "GitLab token not configured"}), 401

        data = request.json
        project_id = data.get('project_id')
        title = data.get('title')
        description = data.get('description')

        if not all([project_id, title]):
            return jsonify({"error": "Missing required fields"}), 400

        headers = {'Authorization': f'Bearer {GITLAB_TOKEN}'}
        response = requests.post(
            f"{GITLAB_URL}/api/v4/projects/{project_id}/issues",
            headers=headers,
            json={'title': title, 'description': description}
        )
        
        if response.status_code == 201:
            return jsonify({"issue": response.json()})
        return jsonify({"error": "Failed to create issue"}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run the app
if __name__ == '__main__':
    mcp_app.run(host='0.0.0.0', port=5001, debug=True) 