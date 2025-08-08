import os
import logging
import time
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_aws.embeddings import BedrockEmbeddings
from pinecone import Pinecone
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get API keys from environment variables
CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
PINECONE_ENVIRONMENT = os.getenv('PINECONE_ENVIRONMENT')
PINECONE_HOST = os.getenv('PINECONE_HOST')
COHERE_API_KEY = os.getenv('COHERE_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_DEFAULT_REGION = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')

# Initialize AI components
llm = None
embed = None
database1_index = None
database2_index = None

def initialize_ai_components():
    """Initialize AI components with environment variables"""
    global llm, embed, database1_index, database2_index
    
    try:
        # Initialize LLM
        llm = ChatAnthropic(
            model_name="claude-3-5-haiku-20241022",
            temperature=0.2,
            anthropic_api_key=CLAUDE_API_KEY
        )
        logger.info("LLM initialized successfully")
        
        # Initialize embeddings
        embed = BedrockEmbeddings(
            model_id="cohere.embed-english-v3",
            region_name="us-east-1"
        )
        logger.info("Embeddings initialized successfully")
        
        # Initialize Pinecone and check available indexes
        pc = Pinecone(api_key=PINECONE_API_KEY)
        
        # List all available indexes
        try:
            logger.info(f"Connecting to Pinecone with API key: {PINECONE_API_KEY[:10]}...")
            indexes = pc.list_indexes()
            logger.info(f"Available Pinecone indexes: {[idx.name for idx in indexes]}")
            logger.info(f"Total indexes found: {len(indexes)}")
            
            # Try to find existing indexes or create fallback
            available_indexes = [idx.name for idx in indexes]
            
            if "ragas" in available_indexes:
                database1_index = pc.Index("ragas")
                logger.info("Using existing ragas index")
            else:
                logger.warning("ragas index not found, will skip arXiv searches")
                logger.warning(f"Available indexes: {available_indexes}")
                database1_index = None
            
            if "ragas1" in available_indexes:
                database2_index = pc.Index("ragas1")
                logger.info("Using existing ragas1 index")
            else:
                logger.warning("ragas1 index not found, will skip AI Tech searches")
                logger.warning(f"Available indexes: {available_indexes}")
                database2_index = None
            
            # If no databases exist, use the first available one as fallback
            if not database1_index and not database2_index and available_indexes:
                fallback_index = available_indexes[0]
                logger.info(f"Using fallback index: {fallback_index}")
                database1_index = pc.Index(fallback_index)
                database2_index = None
                
        except Exception as e:
            logger.error(f"Error listing Pinecone indexes: {e}")
            database1_index = None
            database2_index = None
        
        logger.info("Pinecone initialization completed")
        
    except Exception as e:
        logger.error(f"Failed to initialize AI components: {e}")
        raise

def select_database_for_query(query: str) -> str:
    """
    Use LLM to intelligently select the most appropriate database for a query.
    
    Args:
        query (str): The user's query
        
    Returns:
        str: Selected database ('database1', 'database2', or 'both')
    """
    try:
        if not llm:
            initialize_ai_components()
            
        selection_prompt = f"""
        Analyze this query and determine which database would be most appropriate:
        
        QUERY: "{query}"
        
        Available databases:
        1. DATABASE1: Academic research papers from arXiv (scientific papers, research methodologies, theoretical concepts, academic studies)
        2. DATABASE2: AI Tech articles (industry news, practical applications, company announcements, product releases, implementation guides)
        
        Consider:
        - Academic vs industry focus
        - Research vs practical applications
        - Theoretical vs implementation content
        - Recent developments vs established research
        
        Return ONLY one of these options:
        - "database1" (for academic/research queries)
        - "database2" (for industry/practical queries)  
        - "both" (for queries that need both academic and industry perspectives)
        
        Your response should be just the database name(s), nothing else.
        """
        
        response = llm.invoke(selection_prompt)
        selected_db = response.content.strip().lower()
        
        # Validate the response
        valid_options = ["database1", "database2", "both"]
        if selected_db not in valid_options:
            logger.warning(f"Invalid database selection: {selected_db}, defaulting to 'both'")
            return "both"
        
        logger.info(f"LLM selected database: {selected_db} for query: {query}")
        return selected_db
        
    except Exception as e:
        logger.error(f"Error in database selection: {e}")
        return "both"  # Default to both databases on error

class ProactiveAgent:
    """Generates follow-up questions and research suggestions."""
    
    def __init__(self, llm):
        self.llm = llm
    
    def generate_follow_up_questions(self, query: str, response: str) -> List[str]:
        """Generate relevant follow-up questions based on the response."""
        prompt = f"""
        Based on this query and response, generate 2-3 relevant follow-up questions:
        
        QUERY: {query}
        RESPONSE: {response}
        
        Generate questions that:
        1. Explore related topics mentioned in the response
        2. Ask for more specific details or examples
        3. Request comparisons or deeper analysis
        
        Return as a simple list, one question per line.
        """
        
        try:
            response_text = self.llm.invoke(prompt).content
            questions = [q.strip() for q in response_text.split('\n') if q.strip() and '?' in q]
            return questions[:3]  # Return top 3 questions
        except Exception as e:
            logger.error(f"Error generating follow-up questions: {e}")
            return []
    
    def suggest_research_directions(self, query: str, response: str) -> List[str]:
        """Suggest potential research directions based on the query and response."""
        prompt = f"""
        Based on this query and response, suggest 2-3 potential research directions:
        
        QUERY: {query}
        RESPONSE: {response}
        
        Suggest directions that:
        1. Build upon the current findings
        2. Explore related areas or applications
        3. Address potential gaps or limitations
        
        Return as a simple list, one direction per line.
        """
        
        try:
            response_text = self.llm.invoke(prompt).content
            directions = [d.strip() for d in response_text.split('\n') if d.strip()]
            return directions[:3]  # Return top 3 directions
        except Exception as e:
            logger.error(f"Error suggesting research directions: {e}")
            return []

def format_sources(sources: list) -> str:
    """
    Format sources into a nice citation format.
    
    Args:
        sources (list): List of source dictionaries
        
    Returns:
        str: Formatted citations
    """
    if not sources:
        return ""
    
    citations = "\n\n## 📚 Sources & References\n\n"
    citations += f"*Based on analysis of {len(sources)} sources:*\n\n"
    
    # Separate papers and articles
    papers = []
    articles = []
    
    for source in sources:
        if "authors" in source:  # arXiv paper
            papers.append(source)
        elif "author" in source:  # AI Tech article
            articles.append(source)
    
    # Format arXiv papers
    if papers:
            citations += "### 📄 Academic Research Papers\n\n"
    for i, source in enumerate(papers, 1):
        citations += f"**{i}.** {source['title']}\n"
        citations += f"   • **Relevance Score:** {source['relevance_score']:.2f}\n"
        citations += f"   • **Excerpt:** {source['excerpt']}\n\n"
    
    # Format AI Tech articles
    if articles:
            citations += "### 🚀 AI Tech Articles\n\n"
    for i, source in enumerate(articles, 1):
        citations += f"**{i}.** {source['title']}\n"
        citations += f"   • **Relevance Score:** {source['relevance_score']:.2f}\n"
        citations += f"   • **Excerpt:** {source['excerpt']}\n\n"
    
    citations += "---\n*These sources were retrieved using semantic search through multiple databases.*"
    return citations

def intelligent_search(query: str) -> dict:
    """
    Intelligently search the most appropriate database(s) based on query analysis.
    
    Args:
        query (str): The search query
        
    Returns:
        dict: Dictionary containing search results from the selected database(s)
    """
    try:
        if not llm or not embed or not database1_index or not database2_index:
            initialize_ai_components()
            
        logger.info(f"Performing intelligent search for: {query}")
        
        # Use LLM to select the most appropriate database
        selected_database = select_database_for_query(query)
        
        combined_content = ""
        combined_sources = []
        
        # Add database selection info to the response
        db_info = f"\n\n*🔍 **Database Selection**: The AI selected '{selected_database}' for this query based on content analysis.*\n\n"
        combined_content += db_info
        
        # Search database1 (arXiv papers) if selected
        if selected_database == "database1" or selected_database == "both":
            try:
                logger.info(f"Searching ragas (arXiv) for: {query}")
                xq = embed.embed_query(query)
                
                out = database1_index.query(
                    vector=xq, 
                    top_k=3,
                    include_metadata=True,
                    include_values=False
                )
                
                if out["matches"]:
                    for match in out["matches"]:
                        score = match.get("score", 0)
                        if "metadata" in match and "text" in match["metadata"]:
                            title = match["metadata"].get("title", "Unknown Title")
                            authors = match["metadata"].get("authors", "Unknown Authors")
                            date = match["metadata"].get("date", "Unknown Date")
                            url = match["metadata"].get("url", "")
                            
                            if score > 0.3:
                                source_info = {
                                    "title": title,
                                    "authors": authors,
                                    "date": date,
                                    "url": url,
                                    "relevance_score": score,
                                    "excerpt": match["metadata"]["text"][:200] + "..." if len(match["metadata"]["text"]) > 200 else match["metadata"]["text"],
                                    "database": "arXiv Papers"
                                }
                                combined_sources.append(source_info)
                                # Add source content to combined_content
                                combined_content += f"**Source {len(combined_sources)}**: {title}\n"
                                combined_content += f"Authors: {authors}\n"
                                combined_content += f"Relevance Score: {score:.2f}\n"
                                combined_content += f"Content: {match['metadata']['text'][:500]}...\n\n"
                                
            except Exception as e:
                logger.error(f"Error searching ragas: {e}")
        
        # Search database2 (AI Tech articles) if selected
        if selected_database == "database2" or selected_database == "both":
            try:
                logger.info(f"Searching ragas1 (AI Tech) for: {query}")
                xq = embed.embed_query(query)
                
                out = database2_index.query(
                    vector=xq, 
                    top_k=3,
                    include_metadata=True,
                    include_values=False
                )
                
                if out["matches"]:
                    for match in out["matches"]:
                        score = match.get("score", 0)
                        if "metadata" in match and "text" in match["metadata"]:
                            title = match["metadata"].get("title", "Unknown Title")
                            author = match["metadata"].get("author", "Unknown Author")
                            date = match["metadata"].get("date", "Unknown Date")
                            url = match["metadata"].get("url", "")
                            source = match["metadata"].get("source", "Unknown Source")
                            
                            if score > 0.3:
                                source_info = {
                                    "title": title,
                                    "author": author,
                                    "date": date,
                                    "url": url,
                                    "source": source,
                                    "relevance_score": score,
                                    "excerpt": match["metadata"]["text"][:200] + "..." if len(match["metadata"]["text"]) > 200 else match["metadata"]["text"],
                                    "database": "AI Tech Articles"
                                }
                                combined_sources.append(source_info)
                                # Add source content to combined_content
                                combined_content += f"**Source {len(combined_sources)}**: {title}\n"
                                combined_content += f"Author: {author} ({source})\n"
                                combined_content += f"Relevance Score: {score:.2f}\n"
                                combined_content += f"Content: {match['metadata']['text'][:500]}...\n\n"
                                
            except Exception as e:
                logger.error(f"Error searching ragas1: {e}")
        
        return {
            "content": combined_content,
            "sources": combined_sources,
            "total_count": len(combined_sources),
            "selected_database": selected_database
        }
        
    except Exception as e:
        logger.error(f"Error in intelligent_search: {e}")
        return {"total_count": 0, "sources": [], "content": ""}

def generate_narrative_response(query: str, search_result: dict) -> str:
    """
    Generate a narrative-style response with paragraphs first, then bullet points.
    
    Args:
        query (str): The user's question
        search_result (dict): Search results from intelligent_search
        
    Returns:
        str: Formatted narrative response
    """
    try:
        if not llm:
            initialize_ai_components()
            
        # Create a prompt for narrative response
        narrative_prompt = f"""
        Based on the following research content, provide a comprehensive response to: {query}
        
        Research Content:
        {search_result["content"]}
        
        Please structure your response as follows:
        
        1. **Narrative Section**: Write 2-3 paragraphs that provide a comprehensive overview of the topic, explaining key concepts, developments, and implications in a flowing narrative style.
        
        2. **Key Points Section**: After the narrative, provide key points in bullet format covering:
           • Current technological advances
           • Key research objectives  
           • Technological challenges
           • Promising demonstrations
           • Future potential
        
        Use proper bullet points (•) and make the text engaging and well-formatted. Each bullet point should be clear and informative. Format the Key Points section like this:
        
        **Key Points:**
        
        **Current Technological Advances:**
        • [First advance with clear description]
        • [Second advance with clear description]
        • [Third advance with clear description]
        
        **Key Research Objectives:**
        • [First objective with clear description]
        • [Second objective with clear description]
        • [Third objective with clear description]
        
        **Technological Challenges:**
        • [First challenge with clear description]
        • [Second challenge with clear description]
        • [Third challenge with clear description]
        
        **Promising Demonstrations:**
        • [First demonstration with clear description]
        • [Second demonstration with clear description]
        • [Third demonstration with clear description]
        
        **Future Potential:**
        • [First potential with clear description]
        • [Second potential with clear description]
        • [Third potential with clear description]
        
        IMPORTANT: Each bullet point (•) must be on its own line with a line break after it. Do NOT put multiple bullet points on the same line.
        """
        
        response = llm.invoke(narrative_prompt)
        narrative_response = str(response.content)
        
        # Add sources section
        sources_section = format_sources(search_result["sources"])
        
        return narrative_response + sources_section
        
    except Exception as e:
        logger.error(f"Error generating narrative response: {e}")
        # Fallback to simple response
        return f"Based on the research content: {search_result['content']}" + format_sources(search_result["sources"])

def _format_bullet_points(text: str) -> str:
    """Ensure bullet points are properly formatted with line breaks."""
    import re
    
    # Fix bullet points that are on the same line
    # Look for patterns like "• point1 • point2 • point3"
    bullet_pattern = r'•\s*([^•]+?)(?=\s*•|\s*$)'
    
    def replace_bullets(match):
        content = match.group(1).strip()
        return f"• {content}\n"
    
    # Apply the fix to the text
    formatted_text = re.sub(bullet_pattern, replace_bullets, text)
    
    # Ensure proper spacing around bullet points
    formatted_text = re.sub(r'\n\s*\n\s*•', '\n\n•', formatted_text)
    
    return formatted_text

def _add_agentic_features(response: str, query: str) -> str:
    """Add agentic features to the response."""
    enhanced_response = response
    
    try:
        if not llm:
            initialize_ai_components()
            
        proactive_agent = ProactiveAgent(llm)
        
        # Add follow-up questions
        follow_up_questions = proactive_agent.generate_follow_up_questions(query, response)
        if follow_up_questions:
            questions_section = "\n\n**🎯 Suggested Follow-up Questions:**\n\n"
            for question in follow_up_questions[:3]:
                questions_section += f"• {question}\n"
            enhanced_response += questions_section
        
        # Add research directions
        research_directions = proactive_agent.suggest_research_directions(query, response)
        if research_directions:
            directions_section = "\n\n**🚀 Suggested Research Directions:**\n\n"
            for direction in research_directions:
                directions_section += f"• {direction}\n"
            enhanced_response += directions_section
        
        # Format bullet points properly
        enhanced_response = _format_bullet_points(enhanced_response)
        
        return enhanced_response
        
    except Exception as e:
        logger.error(f"Error adding agentic features: {e}")
        return response

def chat(message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Main chat function that processes user messages and returns AI responses.
    
    Args:
        message (str): User's message
        session_id (str, optional): Session ID for conversation continuity
        
    Returns:
        dict: Contains 'response' and 'sources' keys
    """
    
    # Check if API keys are configured
    if not CLAUDE_API_KEY:
        return {
            'response': "I'm sorry, but the Claude API key is not configured. Please add your CLAUDE_API_KEY to the .env file to enable full AI functionality.",
            'sources': []
        }
    
    if not PINECONE_API_KEY:
        return {
            'response': "I'm sorry, but the Pinecone API key is not configured. Please add your PINECONE_API_KEY to the .env file to enable research database access.",
            'sources': []
        }
    
    try:
        logger.info(f"Processing real AI query: {message}")
        
        # Add a small delay to prevent rate limiting
        time.sleep(1)
        
        # Get search results from Pinecone databases
        search_result = intelligent_search(message)
        
        if search_result["total_count"] == 0:
            return {
                'response': f"I couldn't find relevant information for your query: {message}",
                'sources': []
            }
        
        # Generate narrative response using Claude
        narrative_response = generate_narrative_response(message, search_result)
        
        # Add agentic features
        enhanced_response = _add_agentic_features(narrative_response, message)
        
        # Extract and format sources
        sources = []
        if "sources" in search_result and search_result["sources"]:
            for source in search_result["sources"]:
                source_info = {
                    "title": source.get("title", "Unknown Title"),
                    "url": source.get("url", ""),
                    "snippet": source.get("excerpt", source.get("snippet", "")),
                    "source_type": "academic" if source.get("database") == "arXiv Papers" else "industry"
                }
                sources.append(source_info)
        
        logger.info(f"Returning response with {len(sources)} sources")
        
        return {
            'response': enhanced_response,
            'sources': sources
        }
        
    except Exception as e:
        logger.error(f"Error in chat function: {e}")
        return {
            'response': f"I apologize, but I encountered an error while processing your query: {str(e)}",
            'sources': []
        }

def get_api_status() -> Dict[str, bool]:
    """
    Check the status of API keys and return which services are available.
    """
    return {
        'claude_available': bool(CLAUDE_API_KEY),
        'pinecone_available': bool(PINECONE_API_KEY),
        'openai_available': bool(OPENAI_API_KEY),
        'aws_available': bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)
    } 