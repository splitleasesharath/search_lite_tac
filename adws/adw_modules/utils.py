"""Utility functions for ADW system."""

import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime
from typing import Any, TypeVar, Type, Union, Dict, Optional

T = TypeVar('T')


class EmojiSafeFormatter(logging.Formatter):
    """Formatter that converts emoji to ASCII for console compatibility.

    This ensures console output works on all Windows systems, even those
    without UTF-8 console support. File logs still get full emoji/Unicode.

    Used as a fallback when console UTF-8 reconfiguration doesn't work.
    """

    # Emoji to ASCII mapping for common ADW emoji
    EMOJI_MAP = {
        '🔍': '[SEARCH]',
        '✅': '[OK]',
        '❌': '[FAIL]',
        '🚧': '[WIP]',
        '📝': '[DOC]',
        '🏗️': '[BUILD]',
        '⚙️': '[CONFIG]',
        '🤖': '[BOT]',
        '📋': '[LIST]',
        '📤': '[UPLOAD]',
        '🏥': '[HEALTH]',
        '📅': '[DATE]',
        '→': '->',
        '⚡': '[FAST]',
        '💾': '[SAVE]',
        '🎯': '[TARGET]',
    }

    def format(self, record):
        """Format the record, replacing emoji with ASCII."""
        result = super().format(record)

        # Replace each emoji with its ASCII equivalent
        for emoji, ascii_text in self.EMOJI_MAP.items():
            result = result.replace(emoji, ascii_text)

        # Catch any remaining emoji with regex
        # Unicode emoji range: \U0001F000-\U0001F9FF and other ranges
        try:
            result = re.sub(r'[\U0001F000-\U0001F9FF\U00002600-\U000027BF]', '[EMOJI]', result)
        except:
            pass  # If regex fails, just return the result as-is

        return result


def make_adw_id() -> str:
    """Generate a short 8-character UUID for ADW tracking."""
    return str(uuid.uuid4())[:8]


def setup_logger(adw_id: str, trigger_type: str = "adw_plan_build") -> logging.Logger:
    """Set up logger that writes to both console and file using adw_id.
    
    Args:
        adw_id: The ADW workflow ID
        trigger_type: Type of trigger (adw_plan_build, trigger_webhook, etc.)
    
    Returns:
        Configured logger instance
    """
    # Create log directory: agents/{adw_id}/adw_plan_build/
    # __file__ is in adws/adw_modules/, so we need to go up 3 levels to get to project root
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_dir = os.path.join(project_root, "agents", adw_id, trigger_type)
    os.makedirs(log_dir, exist_ok=True)
    
    # Log file path: agents/{adw_id}/adw_plan_build/execution.log
    log_file = os.path.join(log_dir, "execution.log")
    
    # Create logger with unique name using adw_id
    logger = logging.getLogger(f"adw_{adw_id}")
    logger.setLevel(logging.DEBUG)
    
    # Clear any existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # File handler - captures everything
    file_handler = logging.FileHandler(log_file, mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    
    # Console handler - INFO and above with UTF-8 encoding for emoji support
    console_handler = logging.StreamHandler(sys.stdout)
    # Reconfigure stream to use UTF-8 encoding (prevents UnicodeEncodeError with emoji)
    try:
        console_handler.stream.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python < 3.7 doesn't have reconfigure, fall back to default
        pass
    console_handler.setLevel(logging.INFO)
    
    # Format with timestamp for file
    file_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Simpler format for console (similar to current print statements)
    console_formatter = logging.Formatter('%(message)s')
    
    file_handler.setFormatter(file_formatter)
    console_handler.setFormatter(console_formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # Log initial setup message
    logger.info(f"ADW Logger initialized - ID: {adw_id}")
    logger.debug(f"Log file: {log_file}")
    
    return logger


def get_logger(adw_id: str) -> logging.Logger:
    """Get existing logger by ADW ID.
    
    Args:
        adw_id: The ADW workflow ID
        
    Returns:
        Logger instance
    """
    return logging.getLogger(f"adw_{adw_id}")


def parse_json(text: str, target_type: Type[T] = None) -> Union[T, Any]:
    """Parse JSON that may be wrapped in markdown code blocks.
    
    Handles various formats:
    - Raw JSON
    - JSON wrapped in ```json ... ```
    - JSON wrapped in ``` ... ```
    - JSON with extra whitespace or newlines
    
    Args:
        text: String containing JSON, possibly wrapped in markdown
        target_type: Optional type to validate/parse the result into (e.g., List[TestResult])
        
    Returns:
        Parsed JSON object, optionally validated as target_type
        
    Raises:
        ValueError: If JSON cannot be parsed from the text
    """
    # Try to extract JSON from markdown code blocks
    # Pattern matches ```json\n...\n``` or ```\n...\n```
    code_block_pattern = r'```(?:json)?\s*\n(.*?)\n```'
    match = re.search(code_block_pattern, text, re.DOTALL)
    
    if match:
        json_str = match.group(1).strip()
    else:
        # No code block found, try to parse the entire text
        json_str = text.strip()
    
    # Try to find JSON array or object boundaries if not already clean
    if not (json_str.startswith('[') or json_str.startswith('{')):
        # Look for JSON array
        array_start = json_str.find('[')
        array_end = json_str.rfind(']')
        
        # Look for JSON object
        obj_start = json_str.find('{')
        obj_end = json_str.rfind('}')
        
        # Determine which comes first and extract accordingly
        if array_start != -1 and (obj_start == -1 or array_start < obj_start):
            if array_end != -1:
                json_str = json_str[array_start:array_end + 1]
        elif obj_start != -1:
            if obj_end != -1:
                json_str = json_str[obj_start:obj_end + 1]
    
    try:
        result = json.loads(json_str)
        
        # If target_type is provided and has from_dict/parse_obj/model_validate methods (Pydantic)
        if target_type and hasattr(target_type, '__origin__'):
            # Handle List[SomeType] case
            if target_type.__origin__ == list:
                item_type = target_type.__args__[0]
                # Try Pydantic v2 first, then v1
                if hasattr(item_type, 'model_validate'):
                    result = [item_type.model_validate(item) for item in result]
                elif hasattr(item_type, 'parse_obj'):
                    result = [item_type.parse_obj(item) for item in result]
        elif target_type:
            # Handle single Pydantic model
            if hasattr(target_type, 'model_validate'):
                result = target_type.model_validate(result)
            elif hasattr(target_type, 'parse_obj'):
                result = target_type.parse_obj(result)
            
        return result
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}. Text was: {json_str[:200]}...")


def check_env_vars(logger: Optional[logging.Logger] = None) -> None:
    """Check that all required environment variables are set.
    
    Args:
        logger: Optional logger instance for error reporting
        
    Raises:
        SystemExit: If required environment variables are missing
    """
    required_vars = [
        "CLAUDE_CODE_PATH",
    ]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        error_msg = "Error: Missing required environment variables:"
        if logger:
            logger.error(error_msg)
            for var in missing_vars:
                logger.error(f"  - {var}")
        else:
            print(error_msg, file=sys.stderr)
            for var in missing_vars:
                print(f"  - {var}", file=sys.stderr)
        sys.exit(1)


def get_safe_subprocess_env() -> Dict[str, str]:
    """Get filtered environment variables safe for subprocess execution.

    Returns only the environment variables needed for ADW workflows based on
    .env.sample configuration. This prevents accidental exposure of sensitive
    credentials to subprocesses.

    Returns:
        Dictionary containing only required environment variables
    """
    # Start with a copy of the parent environment to preserve all system variables
    safe_env_vars = os.environ.copy()

    # Override/ensure specific ADW configuration variables
    github_pat = os.getenv("GITHUB_PAT")
    if github_pat:
        safe_env_vars["GITHUB_PAT"] = github_pat
        safe_env_vars["GH_TOKEN"] = github_pat

    # Claude Code Configuration
    safe_env_vars["CLAUDE_CODE_PATH"] = os.getenv("CLAUDE_CODE_PATH", "claude")
    safe_env_vars["CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR"] = os.getenv(
        "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR", "true"
    )

    # Agent Cloud Sandbox Environment (optional)
    e2b_key = os.getenv("E2B_API_KEY")
    if e2b_key:
        safe_env_vars["E2B_API_KEY"] = e2b_key

    # Cloudflare tunnel token (optional)
    cf_token = os.getenv("CLOUDFLARED_TUNNEL_TOKEN")
    if cf_token:
        safe_env_vars["CLOUDFLARED_TUNNEL_TOKEN"] = cf_token

    # Python-specific variables
    safe_env_vars["PYTHONUNBUFFERED"] = "1"  # Useful for subprocess output

    # Working directory tracking
    safe_env_vars["PWD"] = os.getcwd()

    return safe_env_vars