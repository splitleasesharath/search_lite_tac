"""Claude Code agent module for executing prompts programmatically."""

import subprocess
import sys
import os
import json
import re
import logging
import time
import uuid
import io
from typing import Optional, List, Dict, Any, Tuple, Final, Literal
from enum import Enum
from pydantic import BaseModel
from dotenv import load_dotenv


# Retry codes for Claude Code execution errors
class RetryCode(str, Enum):
    """Codes indicating different types of errors that may be retryable."""
    CLAUDE_CODE_ERROR = "claude_code_error"  # General Claude Code CLI error
    TIMEOUT_ERROR = "timeout_error"  # Command timed out
    EXECUTION_ERROR = "execution_error"  # Error during execution
    ERROR_DURING_EXECUTION = "error_during_execution"  # Agent encountered an error
    NONE = "none"  # No retry needed




class AgentPromptRequest(BaseModel):
    """Claude Code agent prompt configuration."""
    prompt: str
    adw_id: str
    agent_name: str = "ops"
    model: Optional[Literal["sonnet", "opus"]] = None  # None = use authenticated Max Plan
    dangerously_skip_permissions: bool = False
    output_file: str
    working_dir: Optional[str] = None


class AgentPromptResponse(BaseModel):
    """Claude Code agent response."""
    output: str
    success: bool
    session_id: Optional[str] = None
    retry_code: RetryCode = RetryCode.NONE


class AgentTemplateRequest(BaseModel):
    """Claude Code agent template execution request."""
    agent_name: str
    slash_command: str
    args: List[str]
    adw_id: str
    model: Optional[Literal["sonnet", "opus"]] = None  # None = use authenticated Max Plan
    working_dir: Optional[str] = None


class ClaudeCodeResultMessage(BaseModel):
    """Claude Code JSONL result message (last line)."""
    type: str
    subtype: str
    is_error: bool
    duration_ms: int
    duration_api_ms: int
    num_turns: int
    result: str
    session_id: str
    total_cost_usd: float


def get_safe_subprocess_env() -> Dict[str, str]:
    """Get environment variables for subprocess execution.

    For Max Plan (authenticated Claude Code), we need to pass ALL environment
    variables so Claude Code can find its authentication credentials.

    This is required for Windows authentication which uses various system paths
    and credentials that aren't predictable.

    Returns:
        Dictionary containing all environment variables
    """
    # Use full environment copy to ensure Claude Code authentication works
    # This matches the approach in test_claude_max.py which works correctly
    env = os.environ.copy()

    # Ensure critical ADW-specific variables are set from .env if available
    if os.getenv("GITHUB_REPO_URL"):
        env["GITHUB_REPO_URL"] = os.getenv("GITHUB_REPO_URL")
    if os.getenv("GITHUB_PAT"):
        env["GITHUB_PAT"] = os.getenv("GITHUB_PAT")
    if os.getenv("CLAUDE_CODE_PATH"):
        env["CLAUDE_CODE_PATH"] = os.getenv("CLAUDE_CODE_PATH")

    # Set Python unbuffered for better subprocess output
    env["PYTHONUNBUFFERED"] = "1"

    return env


# Load environment variables
load_dotenv()

# Get Claude Code CLI path from environment
CLAUDE_PATH = os.getenv("CLAUDE_CODE_PATH", "claude")

# Initialize module-level logger
# Use a simple console logger for the agent module
logger = logging.getLogger("agent")
logger.setLevel(logging.DEBUG)

# Clear any existing handlers
logger.handlers.clear()

# Console handler - INFO and above to stdout
# Use UTF-8 encoding for Windows compatibility with emojis
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
# Set encoding to UTF-8 if possible (Python 3.7+)
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass  # Ignore if reconfigure fails
console_formatter = logging.Formatter("%(message)s")
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# Output file name constants (matching adw_prompt.py and adw_slash_command.py)
OUTPUT_JSONL = "cc_raw_output.jsonl"
OUTPUT_JSON = "cc_raw_output.json"
FINAL_OBJECT_JSON = "cc_final_object.json"
SUMMARY_JSON = "custom_summary_output.json"


def generate_short_id() -> str:
    """Generate a short 8-character UUID for tracking."""
    return str(uuid.uuid4())[:8]




def truncate_output(
    output: str, max_length: int = 500, suffix: str = "... (truncated)"
) -> str:
    """Truncate output to a reasonable length for display.

    Special handling for JSONL data - if the output appears to be JSONL,
    try to extract just the meaningful part.

    Args:
        output: The output string to truncate
        max_length: Maximum length before truncation (default: 500)
        suffix: Suffix to add when truncated (default: "... (truncated)")

    Returns:
        Truncated string if needed, original if shorter than max_length
    """
    # Check if this looks like JSONL data
    if output.startswith('{"type":') and '\n{"type":' in output:
        # This is likely JSONL output - try to extract the last meaningful message
        lines = output.strip().split("\n")
        for line in reversed(lines):
            try:
                data = json.loads(line)
                # Look for result message
                if data.get("type") == "result":
                    result = data.get("result", "")
                    if result:
                        return truncate_output(result, max_length, suffix)
                # Look for assistant message
                elif data.get("type") == "assistant" and data.get("message"):
                    content = data["message"].get("content", [])
                    if isinstance(content, list) and content:
                        text = content[0].get("text", "")
                        if text:
                            return truncate_output(text, max_length, suffix)
            except:
                pass
        # If we couldn't extract anything meaningful, just show that it's JSONL
        return f"[JSONL output with {len(lines)} messages]{suffix}"

    # Regular truncation logic
    if len(output) <= max_length:
        return output

    # Try to find a good break point (newline or space)
    truncate_at = max_length - len(suffix)

    # Look for newline near the truncation point
    newline_pos = output.rfind("\n", truncate_at - 50, truncate_at)
    if newline_pos > 0:
        return output[:newline_pos] + suffix

    # Look for space near the truncation point
    space_pos = output.rfind(" ", truncate_at - 20, truncate_at)
    if space_pos > 0:
        return output[:space_pos] + suffix

    # Just truncate at the limit
    return output[:truncate_at] + suffix


def check_claude_installed() -> Optional[str]:
    """Check if Claude Code CLI is installed. Return error message if not."""
    try:
        result = subprocess.run(
            [CLAUDE_PATH, "--version"], capture_output=True, text=True
        )
        if result.returncode != 0:
            return (
                f"Error: Claude Code CLI is not installed. Expected at: {CLAUDE_PATH}"
            )
    except FileNotFoundError:
        return f"Error: Claude Code CLI is not installed. Expected at: {CLAUDE_PATH}"
    return None


def parse_jsonl_output(
    output_file: str,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Parse JSONL output file and return all messages and the result message.

    Returns:
        Tuple of (all_messages, result_message) where result_message is None if not found
    """
    logger.info(f"[agent.py] Parsing JSONL output: {output_file}")
    try:
        with open(output_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if file is empty
        if not content.strip():
            logger.error(f"[agent.py] ERROR: Output file is empty")
            return [], None

        # Try to parse as JSONL (one JSON object per line)
        messages = []
        lines = content.strip().split('\n')

        for line in lines:
            if not line.strip():
                continue
            try:
                # Try to parse line as JSON
                msg = json.loads(line)
                # Validate that this looks like a Claude Code message (must have "type" field)
                # Otherwise it might be plain JSON from a markdown block
                if isinstance(msg, dict) and "type" in msg:
                    messages.append(msg)
            except json.JSONDecodeError:
                # Line is not valid JSON - might be plain text
                pass

        # If no valid Claude Code messages found, try extracting JSON from markdown code blocks
        if not messages:
            import re
            logger.info(f"[agent.py] No JSONL messages found, trying to extract JSON from markdown")
            json_pattern = r'```json\s*(\{.*?\})\s*```'
            matches = re.findall(json_pattern, content, re.DOTALL)
            if matches:
                try:
                    extracted_json = json.loads(matches[-1])  # Use last match
                    result_msg = {
                        "type": "result",
                        "result": extracted_json,
                        "is_error": False
                    }
                    messages.append(result_msg)
                    logger.info(f"[agent.py] Extracted JSON from markdown code block: {extracted_json}")
                except json.JSONDecodeError as e:
                    logger.error(f"[agent.py] ERROR: Failed to parse extracted JSON: {e}")

        logger.info(f"[agent.py] Found {len(messages)} messages in JSONL output")

        # Find the result message (should be the last one)
        result_message = None
        for message in reversed(messages):
            if message.get("type") == "result":
                result_message = message
                logger.debug(f"[agent.py] Found result message: is_error={result_message.get('is_error')}, subtype={result_message.get('subtype')}")
                break

        if not result_message:
            logger.warning(f"[agent.py] WARNING: No result message found in {len(messages)} messages")

        return messages, result_message
    except Exception as e:
        logger.error(f"[agent.py] ERROR: Failed to parse JSONL output: {e}")
        return [], None


def convert_jsonl_to_json(jsonl_file: str) -> str:
    """Convert JSONL file to JSON array file.

    Creates a cc_raw_output.json file in the same directory as the JSONL file,
    containing all messages as a JSON array.

    Returns:
        Path to the created JSON file
    """
    # Create JSON filename in the same directory
    output_dir = os.path.dirname(jsonl_file)
    json_file = os.path.join(output_dir, OUTPUT_JSON)

    logger.info(f"[agent.py] Converting JSONL to JSON: {json_file}")

    # Parse the JSONL file
    messages, _ = parse_jsonl_output(jsonl_file)

    # Write as JSON array
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)

    logger.info(f"[agent.py] Converted {len(messages)} messages to JSON")

    return json_file


def save_last_entry_as_raw_result(json_file: str) -> Optional[str]:
    """Save the last entry from a JSON array file as cc_final_object.json.

    Args:
        json_file: Path to the JSON array file

    Returns:
        Path to the created cc_final_object.json file, or None if error
    """
    try:
        # Read the JSON array
        with open(json_file, "r", encoding="utf-8") as f:
            messages = json.load(f)

        if not messages:
            logger.warning(f"[agent.py] WARNING: No messages to save as final object")
            return None

        # Get the last entry
        last_entry = messages[-1]

        # Create cc_final_object.json in the same directory
        output_dir = os.path.dirname(json_file)
        final_object_file = os.path.join(output_dir, FINAL_OBJECT_JSON)

        logger.info(f"[agent.py] Saving final object to: {final_object_file}")

        # Write the last entry
        with open(final_object_file, "w", encoding="utf-8") as f:
            json.dump(last_entry, f, indent=2)

        logger.info(f"[agent.py] Saved final object (type: {last_entry.get('type')})")

        return final_object_file
    except Exception as e:
        logger.warning(f"[agent.py] WARNING: Failed to save final object: {e}")
        return None


def get_claude_env() -> Dict[str, str]:
    """Get only the required environment variables for Claude Code execution.

    This is a wrapper around get_safe_subprocess_env() for
    backward compatibility. New code should use get_safe_subprocess_env() directly.

    Returns a dictionary containing only the necessary environment variables
    based on .env.sample configuration.
    """
    # Use the function defined above
    return get_safe_subprocess_env()


def save_prompt(prompt: str, adw_id: str, agent_name: str = "ops") -> None:
    """Save a prompt to the appropriate logging directory."""
    # Extract slash command from prompt
    match = re.match(r"^(/\w+)", prompt)
    if not match:
        return

    slash_command = match.group(1)
    # Remove leading slash for filename
    command_name = slash_command[1:]

    # Create directory structure at project root (parent of adws)
    # __file__ is in adws/adw_modules/, so we need to go up 3 levels to get to project root
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    prompt_dir = os.path.join(project_root, "agents", adw_id, agent_name, "prompts")
    os.makedirs(prompt_dir, exist_ok=True)

    # Save prompt to file
    prompt_file = os.path.join(prompt_dir, f"{command_name}.txt")
    with open(prompt_file, "w") as f:
        f.write(prompt)


def prompt_claude_code_with_retry(
    request: AgentPromptRequest,
    max_retries: int = 3,
    retry_delays: List[int] = None,
) -> AgentPromptResponse:
    """Execute Claude Code with retry logic for certain error types.

    Args:
        request: The prompt request configuration
        max_retries: Maximum number of retry attempts (default: 3)
        retry_delays: List of delays in seconds between retries (default: [1, 3, 5])

    Returns:
        AgentPromptResponse with output and retry code
    """
    if retry_delays is None:
        retry_delays = [1, 3, 5]

    # Ensure we have enough delays for max_retries
    while len(retry_delays) < max_retries:
        retry_delays.append(retry_delays[-1] + 2)  # Add incrementing delays

    last_response = None

    for attempt in range(max_retries + 1):  # +1 for initial attempt
        if attempt > 0:
            # This is a retry
            delay = retry_delays[attempt - 1]
            time.sleep(delay)

        response = prompt_claude_code(request)
        last_response = response

        # Check if we should retry based on the retry code
        if response.success or response.retry_code == RetryCode.NONE:
            # Success or non-retryable error
            return response

        # Check if this is a retryable error
        if response.retry_code in [
            RetryCode.CLAUDE_CODE_ERROR,
            RetryCode.TIMEOUT_ERROR,
            RetryCode.EXECUTION_ERROR,
            RetryCode.ERROR_DURING_EXECUTION,
        ]:
            if attempt < max_retries:
                continue
            else:
                return response

    # Should not reach here, but return last response just in case
    return last_response


def prompt_claude_code(request: AgentPromptRequest) -> AgentPromptResponse:
    """Execute Claude Code with the given prompt configuration."""

    # Check if Claude Code CLI is installed
    error_msg = check_claude_installed()
    if error_msg:
        return AgentPromptResponse(
            output=error_msg,
            success=False,
            session_id=None,
            retry_code=RetryCode.NONE,  # Installation error is not retryable
        )

    # Save prompt before execution
    save_prompt(request.prompt, request.adw_id, request.agent_name)

    # Create output directory if needed
    output_dir = os.path.dirname(request.output_file)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Determine if prompt is too large for command line (Windows limit ~8191 chars)
    # For large prompts, save to file and reference it
    prompt_is_large = len(request.prompt) > 2000 or '\n' in request.prompt[:500]

    if prompt_is_large:
        # Save prompt to file for reference
        prompt_file_path = os.path.join(output_dir, "expanded_prompt.txt")
        with open(prompt_file_path, "w", encoding="utf-8") as pf:
            pf.write(request.prompt)
        logger.info(f"[agent.py] Saved large prompt to file: {prompt_file_path}")

        # Build command without -p flag (will use stdin)
        cmd = [CLAUDE_PATH]
        # Only add --model if specified (None = use authenticated Max Plan)
        if request.model:
            cmd.extend(["--model", request.model])
        cmd.extend(["--output-format", "stream-json"])
        cmd.append("--verbose")
        use_stdin = True
    else:
        # Build command - always use stream-json format and verbose
        cmd = [CLAUDE_PATH, "-p", request.prompt]
        # Only add --model if specified (None = use authenticated Max Plan)
        if request.model:
            cmd.extend(["--model", request.model])
        cmd.extend(["--output-format", "stream-json"])
        cmd.append("--verbose")
        use_stdin = False

    # Check for MCP config in working directory
    if request.working_dir:
        mcp_config_path = os.path.join(request.working_dir, ".mcp.json")
        if os.path.exists(mcp_config_path):
            cmd.extend(["--mcp-config", mcp_config_path])

    # Add dangerous skip permissions flag if enabled
    if request.dangerously_skip_permissions:
        cmd.append("--dangerously-skip-permissions")

    # Set up environment with only required variables
    env = get_claude_env()

    # Log command execution for debugging
    logger.info(f"[agent.py] Executing Claude Code CLI:")
    logger.info(f"[agent.py]   Command: {' '.join(cmd)}")
    logger.info(f"[agent.py]   Prompt length: {len(request.prompt)} chars, via {'stdin' if use_stdin else '-p flag'}")
    logger.info(f"[agent.py]   Working dir: {request.working_dir or os.getcwd()}")
    logger.info(f"[agent.py]   Output file: {request.output_file}")
    logger.info(f"[agent.py]   Model: {request.model}")
    logger.debug(f"[agent.py]   API Key Source: {'env' if env.get('ANTHROPIC_API_KEY') else 'authenticated'}")

    try:
        # Open output file for streaming
        with open(request.output_file, "w") as output_f:
            # Execute Claude Code and stream output to file
            logger.info(f"[agent.py] Starting subprocess...")

            if use_stdin:
                # Pass prompt via stdin for large prompts
                result = subprocess.run(
                    cmd,
                    input=request.prompt,  # Pass prompt via stdin
                    stdout=output_f,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=env,
                    cwd=request.working_dir,
                )
            else:
                # Use -p flag for small prompts
                result = subprocess.run(
                    cmd,
                    stdout=output_f,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=env,
                    cwd=request.working_dir,
                )

            logger.info(f"[agent.py] Subprocess completed with return code: {result.returncode}")

            # Log stderr if present (even on success, for debugging)
            if result.stderr:
                stderr_preview = result.stderr[:500] if len(result.stderr) > 500 else result.stderr
                logger.info(f"[agent.py] Stderr output: {stderr_preview}")

        if result.returncode == 0:
            logger.info(f"[agent.py] Claude Code execution successful")

            # Parse the JSONL file
            logger.info(f"[agent.py] Parsing JSONL output...")
            messages, result_message = parse_jsonl_output(request.output_file)

            # Convert JSONL to JSON array file
            json_file = convert_jsonl_to_json(request.output_file)
            
            # Save the last entry as raw_result.json
            save_last_entry_as_raw_result(json_file)

            if result_message:
                # Extract session_id from result message
                session_id = result_message.get("session_id")

                # Check if there was an error in the result
                is_error = result_message.get("is_error", False)
                subtype = result_message.get("subtype", "")

                logger.info(f"[agent.py] Result message found: is_error={is_error}, subtype={subtype}, session_id={session_id}")

                # Handle error_during_execution case where there's no result field
                if subtype == "error_during_execution":
                    error_msg = "Error during execution: Agent encountered an error and did not return a result"
                    logger.info(f"[agent.py] Error during execution detected")
                    return AgentPromptResponse(
                        output=error_msg,
                        success=False,
                        session_id=session_id,
                        retry_code=RetryCode.ERROR_DURING_EXECUTION,
                    )

                result_value = result_message.get("result", "")

                # Convert result to string if it's a dict/list
                if isinstance(result_value, (dict, list)):
                    result_text = json.dumps(result_value, indent=2)
                elif isinstance(result_value, str):
                    result_text = result_value
                else:
                    result_text = str(result_value)

                # For error cases, truncate the output to prevent JSONL blobs
                if is_error and len(result_text) > 1000:
                    result_text = truncate_output(result_text, max_length=800)

                return AgentPromptResponse(
                    output=result_text,
                    success=not is_error,
                    session_id=session_id,
                    retry_code=RetryCode.NONE,  # No retry needed for successful or non-retryable errors
                )
            else:
                # No result message found, try to extract meaningful error
                logger.info(f"[agent.py] WARNING: No result message found in output")
                error_msg = "No result message found in Claude Code output"

                # Try to get the last few lines of output for context
                try:
                    with open(request.output_file, "r") as f:
                        lines = f.readlines()
                        if lines:
                            # Get last 5 lines or less
                            last_lines = lines[-5:] if len(lines) > 5 else lines
                            # Try to parse each as JSON to find any error messages
                            for line in reversed(last_lines):
                                try:
                                    data = json.loads(line.strip())
                                    if data.get("type") == "assistant" and data.get(
                                        "message"
                                    ):
                                        # Extract text from assistant message
                                        content = data["message"].get("content", [])
                                        if isinstance(content, list) and content:
                                            text = content[0].get("text", "")
                                            if text:
                                                error_msg = f"Claude Code output: {text[:500]}"  # Truncate
                                                break
                                except:
                                    pass
                except:
                    pass

                return AgentPromptResponse(
                    output=truncate_output(error_msg, max_length=800),
                    success=False,
                    session_id=None,
                    retry_code=RetryCode.NONE,
                )
        else:
            # Error occurred - stderr is captured, stdout went to file
            logger.info(f"[agent.py] Claude Code execution failed with return code: {result.returncode}")
            stderr_msg = result.stderr.strip() if result.stderr else ""

            # Try to read the output file to check for errors in stdout
            stdout_msg = ""
            error_from_jsonl = None
            try:
                if os.path.exists(request.output_file):
                    # Parse JSONL to find error message
                    messages, result_message = parse_jsonl_output(request.output_file)

                    if result_message and result_message.get("is_error"):
                        # Found error in result message
                        error_from_jsonl = result_message.get("result", "Unknown error")
                    elif messages:
                        # Look for error in last few messages
                        for msg in reversed(messages[-5:]):
                            if msg.get("type") == "assistant" and msg.get(
                                "message", {}
                            ).get("content"):
                                content = msg["message"]["content"]
                                if isinstance(content, list) and content:
                                    text = content[0].get("text", "")
                                    if text and (
                                        "error" in text.lower()
                                        or "failed" in text.lower()
                                    ):
                                        error_from_jsonl = text[:500]  # Truncate
                                        break

                    # If no structured error found, get last line only
                    if not error_from_jsonl:
                        with open(request.output_file, "r") as f:
                            lines = f.readlines()
                            if lines:
                                # Just get the last line instead of entire file
                                stdout_msg = lines[-1].strip()[
                                    :200
                                ]  # Truncate to 200 chars
            except:
                pass

            if error_from_jsonl:
                error_msg = f"Claude Code error: {error_from_jsonl}"
            elif stdout_msg and not stderr_msg:
                error_msg = f"Claude Code error: {stdout_msg}"
            elif stderr_msg and not stdout_msg:
                error_msg = f"Claude Code error: {stderr_msg}"
            elif stdout_msg and stderr_msg:
                error_msg = f"Claude Code error: {stderr_msg}\nStdout: {stdout_msg}"
            else:
                error_msg = f"Claude Code error: Command failed with exit code {result.returncode}"

            # Always truncate error messages to prevent huge outputs
            return AgentPromptResponse(
                output=truncate_output(error_msg, max_length=800),
                success=False,
                session_id=None,
                retry_code=RetryCode.CLAUDE_CODE_ERROR,
            )

    except subprocess.TimeoutExpired:
        error_msg = "Error: Claude Code command timed out after 5 minutes"
        return AgentPromptResponse(
            output=error_msg,
            success=False,
            session_id=None,
            retry_code=RetryCode.TIMEOUT_ERROR,
        )
    except Exception as e:
        error_msg = f"Error executing Claude Code: {e}"
        return AgentPromptResponse(
            output=error_msg,
            success=False,
            session_id=None,
            retry_code=RetryCode.EXECUTION_ERROR,
        )


def execute_template(request: AgentTemplateRequest) -> AgentPromptResponse:
    """Execute a Claude Code template with slash command and arguments.

    Example:
        request = AgentTemplateRequest(
            agent_name="planner",
            slash_command="/implement",
            args=["plan.md"],
            adw_id="abc12345",
            # model defaults to None (uses authenticated Max Plan)
        )
        response = execute_template(request)
    """

    # Get project root
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

    # Load and expand the template
    # Slash command "/classify_adw" -> ".claude/commands/classify_adw.md"
    command_name = request.slash_command.lstrip('/')
    template_path = os.path.join(project_root, ".claude", "commands", f"{command_name}.md")

    # Check if template exists
    if os.path.exists(template_path):
        logger.info(f"[agent.py] Loading template from: {template_path}")
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # Template argument substitution (see .claude/commands/TEMPLATE_PATTERNS.md)
        # Supported patterns:
        #   $ARGUMENTS - all args joined with spaces (e.g., "arg1 arg2 arg3")
        #   $1, $2, $3, etc. - individual positional arguments
        # Note: $ARGUMENT (singular) is NOT supported

        # Replace $ARGUMENTS with the provided args (all args joined)
        args_text = ' '.join(request.args)
        prompt = template_content.replace('$ARGUMENTS', args_text)

        # Also replace $1, $2, $3, etc. with individual arguments
        for i, arg in enumerate(request.args, start=1):
            prompt = prompt.replace(f'${i}', arg)

        logger.info(f"[agent.py] Expanded template with args: {args_text[:100]}...")
    else:
        # Fallback to old behavior if template not found
        logger.warning(f"[agent.py] Template not found: {template_path}, using fallback")
        prompt = f"{request.slash_command} {' '.join(request.args)}"

    # Create output directory with adw_id at project root
    output_dir = os.path.join(
        project_root, "agents", request.adw_id, request.agent_name
    )
    os.makedirs(output_dir, exist_ok=True)

    # Build output file path
    output_file = os.path.join(output_dir, OUTPUT_JSONL)

    # Create prompt request with specific parameters
    prompt_request = AgentPromptRequest(
        prompt=prompt,
        adw_id=request.adw_id,
        agent_name=request.agent_name,
        model=request.model,
        dangerously_skip_permissions=True,
        output_file=output_file,
        working_dir=request.working_dir,  # Pass through working_dir
    )

    # Execute with retry logic and return response (prompt_claude_code now handles all parsing)
    return prompt_claude_code_with_retry(prompt_request)
