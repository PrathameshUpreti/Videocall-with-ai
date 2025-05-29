from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import threading
import time
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging

from startup_research import StartupResearchCrew

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/startup-research/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("startup_api")

# Initialize rate limiter with more lenient limits
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per hour", "50 per minute"],
    storage_uri="memory://"
)

# Initialize the research crew
research_crew = StartupResearchCrew(
    model_name=os.getenv("LLM_MODEL", "gpt-3.5-turbo"),
    temperature=float(os.getenv("LLM_TEMPERATURE", "0.5"))
)

# Track ongoing researches
ongoing_researches = {}

@app.route('/api/startup-research/evaluate', methods=['POST'])
@limiter.limit("10 per minute")  # More lenient limit for research requests
def evaluate_startup():
    try:
        data = request.get_json()
        logger.info(f"Received data: {data}")  # Add logging to see the request data
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Check for both possible field names
        startup_idea = data.get('startup_idea') or data.get('idea')
        if not startup_idea:
            return jsonify({"error": "Missing startup_idea or idea in request"}), 400
            
        logger.info(f"Processing research request for: {startup_idea}")
        
        # Start the research process
        result = research_crew.evaluate_startup(startup_idea)
        
        # Ensure we have a research_id
        if not result.get('research_id'):
            return jsonify({"error": "Failed to generate research ID"}), 500
            
        # Return initial response with research_id
        return jsonify({
            "research_id": result['research_id'],
            "status": "in_progress",
            "progress": 0
        })
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/startup-research/status/<research_id>', methods=['GET'])
@limiter.limit("100 per minute")  # More lenient limit for status checks
def get_research_status(research_id):
    try:
        result = research_crew.get_research_by_id(research_id)
        
        if result.get("status") == "not_found":
            return jsonify({"error": "Research not found"}), 404
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting research status: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/startup-research/list', methods=['GET'])
@limiter.limit("30 per minute")  # More lenient limit for listing researches
def list_researches():
    try:
        researches = research_crew.list_researches()
        return jsonify(researches)
    except Exception as e:
        logger.error(f"Error listing researches: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/startup-research/file/<research_id>/<file_name>', methods=['GET'])
def get_research_file(research_id, file_name):
    # Get research details
    result = research_crew.get_research_by_id(research_id)
    
    if result.get("status") == "not_found":
        return jsonify({"error": "Research not found"}), 404
    
    files = result.get("files", {})
    
    # Check if the requested file exists
    if file_name not in files and file_name not in [os.path.basename(f) for f in files.values()]:
        return jsonify({"error": f"File {file_name} not found in research"}), 404
    
    # Get the file path
    file_path = None
    for k, v in files.items():
        if k == file_name or os.path.basename(v) == file_name:
            file_path = v
            break
    
    if not file_path:
        return jsonify({"error": "File not found"}), 404
    
    # Determine the MIME type based on file extension
    mime_types = {
        ".md": "text/markdown",
        ".html": "text/html",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pdf": "application/pdf",
        ".json": "application/json",
        ".txt": "text/plain"
    }
    
    extension = os.path.splitext(file_path)[1]
    mime_type = mime_types.get(extension, "application/octet-stream")
    
    # Send the file
    return send_file(
        file_path, 
        mimetype=mime_type,
        as_attachment=True,
        download_name=os.path.basename(file_path)
    )

if __name__ == "__main__":
    # Set default port
    port = int(os.getenv("PORT_RES", 9001))
    
    # Run the API
    app.run(debug=True, host="0.0.0.0", port=port) 