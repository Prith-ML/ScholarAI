-- PostgreSQL initialization script
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE research_assistant'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'research_assistant')\gexec

-- Connect to the database
\c research_assistant;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom functions if needed
-- (Add any custom PostgreSQL functions here)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE research_assistant TO postgres; 