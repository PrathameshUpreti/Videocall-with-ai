from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import time
import hashlib
from urllib.parse import quote
from dotenv import load_dotenv
from functools import lru_cache
import logging
from logging.handlers import RotatingFileHandler
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import whisper
import tempfile
import openai
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes with any origin

# Set port number
PORT = 9000

# Get API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SEARXNG_INSTANCE = os.getenv("SEARXNG_INSTANCE", "https://searx.be")  # Default to a public instance

# Initialize OpenAI client
openai.api_key = OPENAI_API_KEY

# Initialize Whisper model
whisper_model = None

# Configure logging
def setup_logging():
    log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    log_file = 'research_api.log'
    
    # Create handlers
    file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(logging.INFO)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    console_handler.setLevel(logging.INFO)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    return root_logger

# Initialize logger
logger = setup_logging()

# Initialize rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("base")
    return whisper_model

def transcribe_audio(audio_file_path):
    """Transcribe audio file using Whisper."""
    try:
        model = get_whisper_model()
        
        # Configure transcription options for better accuracy
        result = model.transcribe(
            audio_file_path,
            language="en",  # Specify English language
            task="transcribe",
            fp16=False,  # Use full precision for better accuracy
            verbose=True,  # Show progress
            temperature=0.0,  # No randomness in transcription
            best_of=5,  # Take the best of 5 samples
            beam_size=5,  # Use beam search for better results
            condition_on_previous_text=True,  # Consider previous text for context
            initial_prompt="This is a meeting transcription. Please transcribe accurately with proper punctuation and speaker identification if possible."
        )
        
        # Process the transcription to improve readability
        transcript = result["text"]
        
        # Add basic speaker diarization if timestamps are available
        if "segments" in result:
            formatted_segments = []
            for segment in result["segments"]:
                start_time = format_timestamp(segment["start"])
                text = segment["text"].strip()
                formatted_segments.append(f"[{start_time}] {text}")
            transcript = "\n".join(formatted_segments)
        
        return transcript
    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}")
        raise

def format_timestamp(seconds):
    """Format seconds into MM:SS format."""
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

def generate_summary(transcript):
    """Generate a structured summary using GPT-3.5-turbo."""
    try:
        prompt = f"""Please analyze the following meeting transcript and provide a structured summary:

{transcript}

Please provide a summary that includes:
1. Overview of the conversation
2. Key points discussed
3. Decisions made
4. Action items (if any)

Format the response in plain text with clear sections. Use markdown-style formatting for better readability.
For action items, use bullet points and assign owners if mentioned in the transcript."""

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional meeting summarizer. Provide clear, concise, and well-structured summaries. Focus on extracting actionable insights and key decisions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error in summary generation: {str(e)}")
        raise

@app.route('/api/summarize-meeting', methods=['POST'])
@limiter.limit("10 per hour")
def summarize_meeting():
    """Endpoint to handle meeting audio summarization."""
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        # Create a temporary file to store the uploaded audio
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            audio_file.save(temp_audio.name)
            temp_audio_path = temp_audio.name
        
        try:
            # Transcribe the audio
            logger.info("Starting audio transcription...")
            transcript = transcribe_audio(temp_audio_path)
            logger.info("Transcription completed successfully")
            
            # Generate summary
            logger.info("Generating meeting summary...")
            summary = generate_summary(transcript)
            logger.info("Summary generation completed successfully")
            
            return jsonify({
                "transcript": transcript,
                "summary": summary
            })
            
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
                logger.info("Temporary audio file cleaned up")
    
    except Exception as e:
        logger.error(f"Error in summarize-meeting endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/research', methods=['POST'])
@limiter.limit("10 per minute")
def research():
    try:
        # Get the search query from the request
        data = request.json
        query = data.get('query', '')
        mode = data.get('mode', 'deep')  # Default to deep research mode
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
            
        # Perform research based on the requested mode
        if mode == 'deep':
            results = perform_deep_research(query)
        else:
            results = perform_search_summary(query)
        
        return jsonify({"results": results})
    
    except Exception as e:
        logger.error(f"Error in research endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/search', methods=['POST'])
@limiter.limit("15 per minute")
def search():
    try:
        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        # Perform normal search
        results = perform_search_summary(query)
        return jsonify({"results": results})
    
    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/deep-research', methods=['POST'])
@limiter.limit("5 per minute")
def deep_research():
    try:
        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        # Perform deep research
        results = perform_deep_research(query)
        return jsonify({"results": results})
    
    except Exception as e:
        logger.error(f"Error in deep research endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/academic-research', methods=['POST'])
@limiter.limit("5 per minute")
def academic_research():
    try:
        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        # Perform academic-focused search
        search_results = search_with_searxng(
            query, 
            result_count=15, 
            time_range='', 
            language='en'
        )
        
        # Filter for academic sources
        academic_results = [r for r in search_results if 
                           '.edu' in r['link'] or 
                           'scholar.google' in r['link'] or
                           'researchgate' in r['link'] or
                           'academia.edu' in r['link'] or
                           'ncbi.nlm.nih.gov' in r['link']]
        
        # Use OpenAI to synthesize with academic focus
        if OPENAI_API_KEY and academic_results:
            results = synthesize_with_openai(query, academic_results, model="gpt-3.5-turbo-16k")
            return jsonify({"results": results})
        
        # Fallback to regular results if no academic sources found
        return jsonify({"results": format_results_as_text(search_results)})
    
    except Exception as e:
        logger.error(f"Error in academic research endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

def perform_search_summary(query):
    """
    Quick search summary that provides a concise overview of results.
    """
    try:
        # Create a hash of the query for caching
        query_hash = hashlib.md5(query.encode()).hexdigest()
        
        # Collect search results from SearXNG using the cached function
        search_results = cached_search(query, 7, '', 'en')
        
        # If we have valid OpenAI API key, use it to create a brief summary
        if OPENAI_API_KEY:
            summary = create_search_summary(query, search_results)
            if summary:
                return summary
        
        # If no OpenAI API key or OpenAI fails, just return formatted search results
        return format_results_as_text(search_results)
    
    except Exception as e:
        logger.error(f"Error in perform_search_summary: {str(e)}")
        return "An error occurred while processing your search. Please try again later."

def perform_deep_research(query):
    """
    Enhanced research function that uses SearXNG for search and OpenAI for synthesis.
    """
    try:
        # First, collect search results from SearXNG
        search_results = search_with_searxng(query, result_count=10, time_range='', language='en')
        
        # If we have valid OpenAI API key, use it to synthesize the results
        if OPENAI_API_KEY:
            openai_result = synthesize_with_openai(query, search_results)
            if openai_result:
                return openai_result
        
        # If no OpenAI API key or OpenAI fails, just return formatted search results
        return format_results_as_text(search_results)
    
    except Exception as e:
        logger.error(f"Error in perform_deep_research: {str(e)}")
        return "An error occurred while processing your research. Please try again later."

@lru_cache(maxsize=100)
def cached_search(query, result_count, time_range, language):
    """
    Cached version of the search function to improve performance
    """
    return search_with_searxng(query, result_count, time_range, language)

def search_with_searxng(query, result_count=7, time_range='', language='en'):
    """
    Perform a search using SearXNG with enhanced parameters
    """
    try:
        # Configure the SearXNG search request
        search_url = f"{SEARXNG_INSTANCE}/search"
        params = {
            'q': query,
            'format': 'json',
            'categories': 'general',
            'language': language,
            'time_range': time_range,
            'safesearch': 1,
            'engines': 'google,bing,duckduckgo,wikipedia',  # Add more engines for better results
            'results': result_count
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Accept': 'application/json'
        }
        
        # Make the search request with timeout
        response = requests.get(search_url, params=params, headers=headers, timeout=10)
        
        if response.status_code != 200:
            logger.error(f"SearXNG error: Status code {response.status_code}")
            return []
        
        results = response.json()
        formatted_results = []
        
        # Process the results
        if 'results' in results:
            for item in results['results'][:result_count]:
                formatted_results.append({
                    'title': item.get('title', ''),
                    'link': item.get('url', ''),
                    'snippet': item.get('content', ''),
                    'engine': item.get('engine', ''),
                    'score': item.get('score', 0)
                })
                
        # Sort results by score if available
        if formatted_results and 'score' in formatted_results[0]:
            formatted_results.sort(key=lambda x: x.get('score', 0), reverse=True)
            
        return formatted_results
    
    except requests.exceptions.Timeout:
        logger.error("Search request timed out")
        return []
    except Exception as e:
        logger.error(f"Error in search_with_searxng: {str(e)}")
        return []

def synthesize_with_openai(query, search_results, model="gpt-3.5-turbo"):
    """
    Use OpenAI to synthesize search results into a comprehensive answer
    """
    try:
        # Check if we have a valid API key
        if not OPENAI_API_KEY:
            logger.warning("No OpenAI API key provided")
            return None
            
        # Prepare context from search results
        context = ""
        for i, result in enumerate(search_results, 1):
            context += f"Source {i}: {result['title']}\n"
            context += f"URL: {result['link']}\n"
            context += f"Content: {result['snippet']}\n\n"
        
        # Create a prompt for OpenAI to synthesize the information
        system_prompt = """You are an expert Research Analyst AI. Your primary function is to produce comprehensive, factual, and meticulously-structured research reports of approximately 1500 words. 
        You must critically analyze and synthesize the provided search results to generate a clear, insightful, and informative response that directly addresses the user's query.
        
        Core Objectives:
        1.  Depth and Accuracy: Go beyond surface-level summarization. Extract key insights, data, and arguments from the sources. Ensure all information presented is factually grounded in the provided context.
        2.  Critical Synthesis: Do not merely list information. Weave together findings from multiple sources to build a coherent and comprehensive understanding of the topic. Identify connections, patterns, and, if present, discrepancies within the search results.
        3.  Structured Presentation: Adhere strictly to the specified formatting guidelines to ensure readability and professionalism.
        4.  Objectivity: Maintain a neutral, academic tone. Present information impartially.
        
        Mandatory Report Structure:
        1.  TITLE: Start with a clear, descriptive title: "IN-DEPTH RESEARCH REPORT: [Query Topic]"
        2.  EXECUTIVE SUMMARY: A concise 6-8 sentence overview. This should encapsulate the main purpose of the report, key findings, and a brief outline of the report's structure.
        3.  MAIN BODY (4-6 SECTIONS): Each section must have:
            -   A DESCRIPTIVE HEADING IN ALL CAPS (e.g., "CRITICAL ANALYSIS OF KEY CONCEPTS", "RECENT ADVANCEMENTS AND THEIR IMPLICATIONS").
            -   Well-organized content with detailed paragraphs. Each paragraph should ideally contain 5-7 sentences, focusing on a specific aspect of the section's topic.
            -   Natural emphasis on important terms or concepts through clear articulation and context, not through markdown or special symbols.
            -   Use of numbered or bulleted lists for clarity when presenting multiple points, examples, or data.
        4.  CONCLUSION: A brief summary of the key insights and findings discussed in the report. This section should reiterate the main takeaways without introducing new information.
        5.  REFERENCES OVERVIEW (Optional but Recommended): Briefly mention the types of sources consulted (e.g., "Information was synthesized from academic papers, industry reports, and news articles provided in the search results."). Do not list individual URLs unless specifically part of the content synthesis.
        
        Formatting and Style Guidelines:
        -   Word Count: Target approximately 1500 words for the entire report.
        -   Readability: Ensure ample spacing between sections and paragraphs.
        -   Language: Use clear, precise, and professional language. Avoid jargon where possible, or explain it if necessary.
        -   No Markdown: Strictly avoid technical formatting symbols like markdown (#, **, >, --, etc.). The output must be plain text suitable for direct reading.
        -   Tone: Maintain a formal, objective, and analytical tone throughout the report."""
        
        user_prompt = f"""User Query: {query}
        
        Provided Search Results for Synthesis:
        {context}
        
        Task: Based *solely* on the provided search results, please generate a comprehensive and well-structured research report addressing the user's query. 
        
        Instructions for Content Generation:
        1.  Analyze and Synthesize: Critically evaluate the information within the provided search results. Synthesize this information to construct a detailed and coherent report. Focus on extracting meaningful insights and connections.
        2.  Section Heading Selection: Organize your report using relevant and descriptive headings. You should aim for 4-6 main body sections. Consider using headings from the following list if they are appropriate for the query and the provided content. Adapt or create new headings as necessary to best structure the information:
            -   "INTRODUCTION TO [Query Topic]"
            -   "KEY CONCEPTS AND DEFINITIONS"
            -   "HISTORICAL CONTEXT AND EVOLUTION"
            -   "CURRENT TRENDS AND RECENT DEVELOPMENTS"
            -   "CORE MECHANISMS AND TECHNOLOGIES"
            -   "KEY APPLICATIONS AND USE CASES"
            -   "OPPORTUNITIES AND POTENTIAL BENEFITS"
            -   "CHALLENGES AND LIMITATIONS"
            -   "CRITICAL ANALYSIS AND PERSPECTIVES"
            -   "COMPARATIVE ANALYSIS (if applicable)"
            -   "ETHICAL CONSIDERATIONS AND SOCIETAL IMPACT"
            -   "INDUSTRY LEADERS AND MARKET LANDSCAPE"
            -   "FUTURE OUTLOOK AND PREDICTIONS"
            -   "CASE STUDIES (if details are available in sources)"
            -   "CONCLUDING REMARKS AND SYNTHESIS"
        3.  Content Focus: Ensure each section provides substantial detail, drawing from the provided snippets. Aim for well-developed paragraphs (5-7 sentences each).
        4.  Adherence to Sources: Base your entire report on the information contained within the 'Search Results'. Do not introduce external knowledge or information not present in the provided context.
        5.  Formatting: Present the report in a clean, plain-text format with clear headings and appropriate spacing as per the system prompt's structural guidelines. Ensure no markdown formatting is used.
        
        Deliverable: A comprehensive research report of approximately 1500 words that is well-organized, insightful, and directly addresses the user's query using only the provided search results."""
        
        # Direct API call using requests instead of OpenAI client
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 4000,
                "temperature": 0.7
            },
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            return None
            
        result = response.json()
        return result['choices'][0]['message']['content']
    
    except requests.exceptions.Timeout:
        logger.error("OpenAI API request timed out")
        return None
    except Exception as e:
        logger.error(f"Error in synthesize_with_openai: {str(e)}")
        return None

def create_search_summary(query, search_results):
    """
    Use OpenAI to create a concise search summary
    """
    try:
        # Prepare context from search results
        context = ""
        for i, result in enumerate(search_results, 1):
            context += f"Source {i}: {result['title']}\n"
            context += f"URL: {result['link']}\n"
            context += f"Content: {result['snippet']}\n\n"
        
        # Create a prompt for OpenAI to synthesize the information
        system_prompt = """You are a research assistant that provides clear, concise summaries.
        Based on the provided search results, synthesize a brief, informative response that addresses the user's query.
        
        Format your response with the following structure:
        1. Start with a clear title: "SEARCH : [Query Topic]"
        2. Follow with a brief 2-3 sentence overview
        3. End with a brief conclusion
        
        Keep the response concise and to the point, focusing on the most important information.
        Use straightforward language and avoid technical formatting symbols."""
        
        user_prompt = f"""Query: {query}
        
        Search Results:
        {context}
        
        Please create a concise search summary about the query, highlighting just the most important points.
        The summary should be brief but informative, focusing on key facts and trends.
        Use clear, simple language accessible to a general audience."""
        
        # Direct API call using requests
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 1000,
                "temperature": 0.5
            },
            timeout=15
        )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            return None
            
        result = response.json()
        return result['choices'][0]['message']['content']
    
    except requests.exceptions.Timeout:
        logger.error("OpenAI API request timed out")
        return None
    except Exception as e:
        logger.error(f"Error in create_search_summary: {str(e)}")
        return None

def format_results_as_text(results):
    """Format the search results as a nicely formatted text block."""
    if not results:
        return "NO RESULTS FOUND\n\nNo search results found for your query. Please try using different keywords or a more specific search term."
    
    text = "RESEARCH RESULTS SUMMARY\n\n"
    text += "The following information was gathered from multiple sources. Review each source for more details.\n\n"
    text += "------------------------------------------------------------\n\n"
    
    for i, result in enumerate(results, 1):
        text += f"SOURCE {i}: {result['title']}\n\n"
        text += f"Summary: {result['snippet']}\n\n"
        text += f"Link: {result['link']}\n\n"
        if i < len(results):
            text += "------------------------------------------------------------\n\n"
    
    return text

if __name__ == '__main__':
    # Run the Flask app
    logger.info(f"Starting server on 0.0.0.0:{PORT}")
    logger.info(f"Access from other devices using: http://<your-ip-address>:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True, threaded=True)
