#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "click",
#   "rich",
#   "pyyaml",
#   "requests",
# ]
# ///
"""
Run chore planning and implementation workflow.

This script runs two slash commands in sequence:
1. /chore - Creates a plan based on the prompt
2. /implement - Implements the plan created by /chore

Usage:
    # Method 1: Direct execution (requires uv)
    ./adws/adw_chore_implement.py "Add error handling to all API endpoints"

    # Method 2: Using uv run
    uv run adws/adw_chore_implement.py "Refactor database connection logic"

Examples:
    # Run with specific model
    ./adws/adw_chore_implement.py "Add logging to agent.py" --model opus

    # Run from a different working directory
    ./adws/adw_chore_implement.py "Update documentation" --working-dir /path/to/project

    # Run with verbose output
    ./adws/adw_chore_implement.py "Add tests" --verbose
"""

import os
import sys
import json
import re
from pathlib import Path
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.rule import Rule

# Add the adws directory to the path so we can import as a package
sys.path.insert(0, os.path.dirname(__file__))

from adw_modules.agent import (
    AgentTemplateRequest,
    AgentPromptResponse,
    execute_template,
    generate_short_id,
)
from adw_modules.event_manager import event_manager

# Output file name constants
OUTPUT_JSONL = "cc_raw_output.jsonl"
OUTPUT_JSON = "cc_raw_output.json"
FINAL_OBJECT_JSON = "cc_final_object.json"
SUMMARY_JSON = "custom_summary_output.json"


def emit_event(event_type: str, data: dict, adw_id: str, issue_number: str = None):
    """Emit event to notification system if issue_number is provided.

    Args:
        event_type: Event type from taxonomy
        data: Event-specific data
        adw_id: ADW workflow ID
        issue_number: GitHub issue number (optional)
    """
    if not issue_number:
        return  # Skip notification if no issue number

    context = {
        "workflow": "adw_chore_implement",
        "adw_id": adw_id,
        "issue_number": issue_number
    }

    try:
        event_manager.emit(event_type, data, context)
    except Exception as e:
        # Don't fail workflow if notification fails
        print(f"Warning: Failed to emit event {event_type}: {e}", file=sys.stderr)


def extract_plan_path(output: str) -> str:
    """Extract the plan file path from the chore command output.

    Looks for patterns like:
    - specs/chore-12345678-update-readme.md
    - Created plan at: specs/chore-...
    - Plan file: specs/chore-...
    """
    # Try multiple patterns to find the plan path
    patterns = [
        r"specs/chore-[a-zA-Z0-9\-]+\.md",
        r"Created plan at:\s*(specs/chore-[a-zA-Z0-9\-]+\.md)",
        r"Plan file:\s*(specs/chore-[a-zA-Z0-9\-]+\.md)",
        r"path.*?:\s*(specs/chore-[a-zA-Z0-9\-]+\.md)",
    ]

    for pattern in patterns:
        match = re.search(pattern, output, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1) if match.groups() else match.group(0)

    # If no match found, raise an error
    raise ValueError("Could not find plan file path in chore output")


@click.command()
@click.argument("prompt", required=True)
@click.option(
    "--model",
    type=click.Choice(["sonnet", "opus"]),
    default="sonnet",
    help="Claude model to use",
)
@click.option(
    "--working-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, resolve_path=True),
    help="Working directory for command execution (default: current directory)",
)
@click.option(
    "--adw-id",
    type=str,
    help="Use existing ADW ID instead of generating a new one",
)
@click.option(
    "--issue-number",
    type=str,
    help="GitHub issue number (for tracking purposes)",
)
def main(
    prompt: str,
    model: str,
    working_dir: str,
    adw_id: str,
    issue_number: str,
):
    """Run chore planning and implementation workflow."""
    # Force UTF-8 encoding for Windows console to handle emoji characters
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    console = Console()

    # Use provided ADW ID or generate a new one
    if not adw_id:
        adw_id = generate_short_id()

    # Use current directory if no working directory specified
    if not working_dir:
        working_dir = os.getcwd()

    # Set default agent names
    planner_name = "planner"
    builder_name = "builder"

    console.print(
        Panel(
            f"[bold blue]ADW Chore & Implement Workflow[/bold blue]\n\n"
            f"[cyan]ADW ID:[/cyan] {adw_id}\n"
            f"[cyan]Model:[/cyan] {model}\n"
            f"[cyan]Working Dir:[/cyan] {working_dir}",
            title="[bold blue]🚀 Workflow Configuration[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    # Emit workflow start event
    emit_event("workflow.started", {
        "workflow_stage": "chore_implement",
        "task_description": f" - {prompt}"
    }, adw_id, issue_number)

    # Phase 1: Run /chore command
    console.print(Rule("[bold yellow]Phase 1: Planning (/chore)[/bold yellow]"))
    console.print()

    # Create the chore request
    chore_request = AgentTemplateRequest(
        agent_name=planner_name,
        slash_command="/chore",
        args=[adw_id, prompt],
        adw_id=adw_id,
        model=model,
        working_dir=working_dir,
    )

    # Display chore execution info
    chore_info_table = Table(show_header=False, box=None, padding=(0, 1))
    chore_info_table.add_column(style="bold cyan")
    chore_info_table.add_column()

    chore_info_table.add_row("ADW ID", adw_id)
    chore_info_table.add_row("ADW Name", "adw_chore_implement (planning)")
    chore_info_table.add_row("Command", "/chore")
    chore_info_table.add_row("Args", f'{adw_id} "{prompt}"')
    chore_info_table.add_row("Model", model)
    chore_info_table.add_row("Agent", planner_name)

    console.print(
        Panel(
            chore_info_table,
            title="[bold blue]🚀 Chore Inputs[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    plan_path = None

    try:
        # Emit planning start event
        emit_event("workflow.started", {
            "workflow_stage": "planning",
            "task_description": f" - {prompt}"
        }, adw_id, issue_number)

        # Execute the chore command
        with console.status("[bold yellow]Creating plan...[/bold yellow]"):
            chore_response = execute_template(chore_request)

        # Display the chore result
        if chore_response.success:
            # Emit planning success event
            emit_event("workflow.completed", {
                "workflow_stage": "planning",
                "task_description": f" - Created plan for: {prompt}"
            }, adw_id, issue_number)

            # Success panel
            console.print(
                Panel(
                    chore_response.output,
                    title="[bold green]✅ Planning Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

            # Extract the plan path from the output
            try:
                plan_path = extract_plan_path(chore_response.output)
                console.print(f"\n[bold cyan]Plan created at:[/bold cyan] {plan_path}")
            except ValueError as e:
                console.print(
                    Panel(
                        f"[bold red]Could not extract plan path: {str(e)}[/bold red]\n\n"
                        "The chore command succeeded but the plan file path could not be found in the output.",
                        title="[bold red]❌ Parse Error[/bold red]",
                        border_style="red",
                    )
                )
                sys.exit(3)

        else:
            # Emit planning failure event
            emit_event("workflow.error", {"error_message": "Planning phase failed"}, adw_id, issue_number)

            # Error panel
            console.print(
                Panel(
                    chore_response.output,
                    title="[bold red]❌ Planning Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )
            console.print(
                "\n[bold red]Workflow aborted: Planning phase failed[/bold red]"
            )
            sys.exit(1)

        # Save chore phase summary
        chore_output_dir = f"./agents/{adw_id}/{planner_name}"
        chore_summary_path = f"{chore_output_dir}/{SUMMARY_JSON}"

        summary_data = {
            "phase": "planning",
            "adw_id": adw_id,
            "slash_command": "/chore",
            "args": [adw_id, prompt],
            "path_to_slash_command_prompt": ".claude/commands/chore.md",
            "model": model,
            "working_dir": working_dir,
            "success": chore_response.success,
            "session_id": chore_response.session_id,
            "retry_code": chore_response.retry_code,
            "output": chore_response.output,
            "plan_path": plan_path,
        }
        if issue_number:
            summary_data["issue_number"] = issue_number

        with open(chore_summary_path, "w") as f:
            json.dump(summary_data, f, indent=2)

        # Show chore output files
        console.print()

        # Files saved panel for chore phase
        chore_files_table = Table(show_header=True, box=None)
        chore_files_table.add_column("File Type", style="bold cyan")
        chore_files_table.add_column("Path", style="dim")
        chore_files_table.add_column("Description", style="italic")

        chore_files_table.add_row(
            "JSONL Stream",
            f"{chore_output_dir}/{OUTPUT_JSONL}",
            "Raw streaming output from Claude Code",
        )
        chore_files_table.add_row(
            "JSON Array",
            f"{chore_output_dir}/{OUTPUT_JSON}",
            "All messages as a JSON array",
        )
        chore_files_table.add_row(
            "Final Object",
            f"{chore_output_dir}/{FINAL_OBJECT_JSON}",
            "Last message entry (final result)",
        )
        chore_files_table.add_row(
            "Summary",
            chore_summary_path,
            "High-level execution summary with metadata",
        )

        console.print(
            Panel(
                chore_files_table,
                title="[bold blue]📄 Planning Output Files[/bold blue]",
                border_style="blue",
            )
        )

        console.print()

        # Phase 2: Run /implement command
        console.print(
            Rule("[bold yellow]Phase 2: Implementation (/implement)[/bold yellow]")
        )
        console.print()

        # Create the implement request
        implement_request = AgentTemplateRequest(
            agent_name=builder_name,
            slash_command="/implement",
            args=[plan_path],
            adw_id=adw_id,
            model=model,
            working_dir=working_dir,
        )

        # Display implement execution info
        implement_info_table = Table(show_header=False, box=None, padding=(0, 1))
        implement_info_table.add_column(style="bold cyan")
        implement_info_table.add_column()

        implement_info_table.add_row("ADW ID", adw_id)
        implement_info_table.add_row("ADW Name", "adw_chore_implement (building)")
        implement_info_table.add_row("Command", "/implement")
        implement_info_table.add_row("Args", plan_path)
        implement_info_table.add_row("Model", model)
        implement_info_table.add_row("Agent", builder_name)

        console.print(
            Panel(
                implement_info_table,
                title="[bold blue]🚀 Implement Inputs[/bold blue]",
                border_style="blue",
            )
        )
        console.print()

        # Emit implementation start event
        emit_event("workflow.started", {
            "workflow_stage": "implementation",
            "task_description": f" - Implementing: {prompt}"
        }, adw_id, issue_number)

        # Execute the implement command
        with console.status("[bold yellow]Implementing plan...[/bold yellow]"):
            implement_response = execute_template(implement_request)

        # Display the implement result
        if implement_response.success:
            # Emit implementation success event
            emit_event("workflow.completed", {
                "workflow_stage": "implementation",
                "task_description": f" - Implemented: {prompt}"
            }, adw_id, issue_number)

            # Success panel
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold green]✅ Implementation Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

            if implement_response.session_id:
                console.print(
                    f"\n[bold cyan]Session ID:[/bold cyan] {implement_response.session_id}"
                )
        else:
            # Emit implementation failure event
            emit_event("workflow.error", {"error_message": "Implementation phase failed"}, adw_id, issue_number)

            # Error panel
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold red]❌ Implementation Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )

        # Save implement phase summary
        implement_output_dir = f"./agents/{adw_id}/{builder_name}"
        implement_summary_path = f"{implement_output_dir}/{SUMMARY_JSON}"

        implement_summary_data = {
            "phase": "implementation",
            "adw_id": adw_id,
            "slash_command": "/implement",
            "args": [plan_path],
            "path_to_slash_command_prompt": ".claude/commands/implement.md",
            "model": model,
            "working_dir": working_dir,
            "success": implement_response.success,
            "session_id": implement_response.session_id,
            "retry_code": implement_response.retry_code,
            "output": implement_response.output,
        }
        if issue_number:
            implement_summary_data["issue_number"] = issue_number

        with open(implement_summary_path, "w") as f:
            json.dump(implement_summary_data, f, indent=2)

        # Show implement output files
        console.print()

        # Files saved panel for implement phase
        implement_files_table = Table(show_header=True, box=None)
        implement_files_table.add_column("File Type", style="bold cyan")
        implement_files_table.add_column("Path", style="dim")
        implement_files_table.add_column("Description", style="italic")

        implement_files_table.add_row(
            "JSONL Stream",
            f"{implement_output_dir}/{OUTPUT_JSONL}",
            "Raw streaming output from Claude Code",
        )
        implement_files_table.add_row(
            "JSON Array",
            f"{implement_output_dir}/{OUTPUT_JSON}",
            "All messages as a JSON array",
        )
        implement_files_table.add_row(
            "Final Object",
            f"{implement_output_dir}/{FINAL_OBJECT_JSON}",
            "Last message entry (final result)",
        )
        implement_files_table.add_row(
            "Summary",
            implement_summary_path,
            "High-level execution summary with metadata",
        )

        console.print(
            Panel(
                implement_files_table,
                title="[bold blue]📄 Implementation Output Files[/bold blue]",
                border_style="blue",
            )
        )

        # Show workflow summary
        console.print()
        console.print(Rule("[bold blue]Workflow Summary[/bold blue]"))
        console.print()

        summary_table = Table(show_header=True, box=None)
        summary_table.add_column("Phase", style="bold cyan")
        summary_table.add_column("Status", style="bold")
        summary_table.add_column("Output Directory", style="dim")

        # Planning phase row
        planning_status = "✅ Success" if chore_response.success else "❌ Failed"
        summary_table.add_row(
            "Planning (/chore)",
            planning_status,
            f"./agents/{adw_id}/{planner_name}/",
        )

        # Implementation phase row
        implement_status = "✅ Success" if implement_response.success else "❌ Failed"
        summary_table.add_row(
            "Implementation (/implement)",
            implement_status,
            f"./agents/{adw_id}/{builder_name}/",
        )

        console.print(summary_table)

        # Create overall workflow summary
        workflow_summary_path = f"./agents/{adw_id}/workflow_summary.json"
        os.makedirs(f"./agents/{adw_id}", exist_ok=True)

        workflow_summary_data = {
            "workflow": "chore_implement",
            "adw_id": adw_id,
            "prompt": prompt,
            "model": model,
            "working_dir": working_dir,
            "plan_path": plan_path,
            "phases": {
                "planning": {
                    "success": chore_response.success,
                    "session_id": chore_response.session_id,
                    "agent": planner_name,
                    "output_dir": f"./agents/{adw_id}/{planner_name}/",
                },
                "implementation": {
                    "success": implement_response.success,
                    "session_id": implement_response.session_id,
                    "agent": builder_name,
                    "output_dir": f"./agents/{adw_id}/{builder_name}/",
                },
            },
            "overall_success": chore_response.success
            and implement_response.success,
        }
        if issue_number:
            workflow_summary_data["issue_number"] = issue_number

        with open(workflow_summary_path, "w") as f:
            json.dump(workflow_summary_data, f, indent=2)

        console.print(
            f"\n[bold cyan]Workflow summary:[/bold cyan] {workflow_summary_path}"
        )
        console.print()

        # Exit with appropriate code
        if chore_response.success and implement_response.success:
            # Emit overall success event
            emit_event("workflow.completed", {
                "workflow_stage": "chore_implement",
                "task_description": f" - Successfully completed: {prompt}"
            }, adw_id, issue_number)

            console.print(
                "[bold green]✅ Workflow completed successfully![/bold green]"
            )
            sys.exit(0)
        else:
            # Emit overall failure event
            emit_event("workflow.error", {"error_message": "Workflow completed with errors"}, adw_id, issue_number)

            console.print(
                "[bold yellow]⚠️  Workflow completed with errors[/bold yellow]"
            )
            sys.exit(1)

    except Exception as e:
        # Emit unexpected error event
        emit_event("workflow.error", {"error_message": f"Unexpected error: {str(e)}"}, adw_id, issue_number)

        console.print(
            Panel(
                f"[bold red]{str(e)}[/bold red]",
                title="[bold red]❌ Unexpected Error[/bold red]",
                border_style="red",
            )
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
