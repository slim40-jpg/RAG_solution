"""CLI entry point — Click commands for free-code."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from free_code import __version__
from free_code.config import (
    CONFIG_FILE,
    get_config_value,
    load_config,
    save_config,
    set_config_value,
)

console = Console()


def get_project_root() -> Path:
    """Determine the project root directory."""
    from free_code.tools.git_ops import git_root

    cwd = Path.cwd()
    root = git_root(str(cwd))
    if root:
        return Path(root)
    return cwd


@click.group(invoke_without_command=True)
@click.version_option(version=__version__, prog_name="free-code")
@click.pass_context
def main(ctx: click.Context) -> None:
    """Free.ai Coder -- AI coding assistant for your terminal."""
    if ctx.invoked_subcommand is None:
        # Default: interactive chat
        ctx.invoke(chat)


@main.command()
def chat() -> None:
    """Start an interactive coding session."""
    from free_code.agent import Agent
    from free_code.context.repo_map import generate_repo_map
    from free_code.models import get_model
    from free_code.ui.prompt import get_input, setup_history, show_help
    from free_code.ui.terminal import (
        print_error,
        print_info,
        print_markdown,
        print_model_info,
        print_success,
        print_welcome,
    )

    config = load_config()
    project_root = get_project_root()
    agent = Agent(project_root, config)

    print_welcome()
    print_model_info(config.get("provider", "free.ai"), get_model(config))
    console.print(f"  [dim]Project:[/dim] {project_root}")
    console.print()

    setup_history()

    while True:
        try:
            user_input = get_input("you> ")
        except KeyboardInterrupt:
            console.print("\n[dim]Goodbye![/dim]")
            break

        if user_input is None:
            console.print("\n[dim]Goodbye![/dim]")
            break

        if not user_input:
            continue

        # Handle slash commands
        if user_input.startswith("/"):
            cmd = user_input.split()[0].lower()

            if cmd in ("/quit", "/exit", "/q"):
                console.print("[dim]Goodbye![/dim]")
                break
            elif cmd == "/help":
                show_help()
                continue
            elif cmd == "/clear":
                agent.clear_history()
                print_success("Conversation cleared.")
                continue
            elif cmd == "/compact":
                agent.compact_history()
                print_success("Conversation compacted.")
                continue
            elif cmd == "/model":
                parts = user_input.split(maxsplit=1)
                if len(parts) > 1:
                    set_config_value("model", parts[1])
                    config = load_config()
                    agent.client = __import__(
                        "free_code.client", fromlist=["CoderClient"]
                    ).CoderClient(config)
                    print_success(f"Model set to: {parts[1]}")
                else:
                    print_info(f"Current model: {get_model(config)}")
                continue
            elif cmd == "/config":
                _show_config()
                continue
            elif cmd == "/files":
                from free_code.tools.list_files import list_files
                result = list_files(_project_root=str(project_root), max_depth=2)
                console.print(f"[dim]{result}[/dim]")
                continue
            elif cmd == "/repo":
                repo_map = generate_repo_map(project_root)
                console.print(f"[dim]{repo_map}[/dim]")
                continue
            elif cmd == "/diff":
                from free_code.tools.git_ops import git_diff
                result = git_diff(_project_root=str(project_root))
                console.print(f"[dim]{result}[/dim]")
                continue
            elif cmd == "/status":
                from free_code.tools.git_ops import git_status
                result = git_status(_project_root=str(project_root))
                console.print(f"[dim]{result}[/dim]")
                continue
            elif cmd == "/test":
                from free_code.tools.test_runner import run_tests
                parts = user_input.split(maxsplit=1)
                path = parts[1] if len(parts) > 1 else None
                with console.status("Running tests..."):
                    result = run_tests(path=path, _project_root=str(project_root))
                console.print(result)
                continue
            else:
                print_error(f"Unknown command: {cmd}. Type /help for available commands.")
                continue

        # Send to agent
        try:
            asyncio.run(agent.chat(user_input))
        except KeyboardInterrupt:
            console.print("\n[dim]Interrupted.[/dim]")
        except Exception as e:
            print_error(f"Agent error: {e}")


@main.command()
@click.argument("question", nargs=-1, required=True)
def ask(question: tuple) -> None:
    """Ask a one-shot question about your codebase."""
    from free_code.agent import Agent
    from free_code.ui.terminal import print_error

    question_str = " ".join(question)
    config = load_config()
    project_root = get_project_root()
    agent = Agent(project_root, config)

    # In ask mode, disable safe_mode for reads (it's one-shot)
    agent.safe_mode = config.get("safe_mode", True)

    try:
        asyncio.run(agent.chat(question_str))
    except KeyboardInterrupt:
        console.print("\n[dim]Interrupted.[/dim]")
    except Exception as e:
        print_error(str(e))
        sys.exit(1)


@main.command()
@click.argument("task", nargs=-1, required=True)
def run(task: tuple) -> None:
    """Execute a coding task (e.g., 'add unit tests for auth module')."""
    from free_code.agent import Agent
    from free_code.ui.terminal import print_error

    task_str = " ".join(task)
    config = load_config()
    project_root = get_project_root()
    agent = Agent(project_root, config)

    console.print(f"\n[bold]Task:[/bold] {task_str}")
    console.print(f"[dim]Project: {project_root}[/dim]\n")

    try:
        asyncio.run(agent.chat(
            f"Execute this task: {task_str}\n\n"
            "Work through it step by step. Read relevant files first, "
            "make the changes, then verify they work."
        ))
    except KeyboardInterrupt:
        console.print("\n[dim]Interrupted.[/dim]")
    except Exception as e:
        print_error(str(e))
        sys.exit(1)


@main.command()
@click.argument("prompt", nargs=-1, required=True)
@click.option("--repo", "repo_url", default=None, metavar="URL",
              help="Git repository URL to run the task against.")
@click.option("--model", "model",
              type=click.Choice(["qwen-coder-32b", "deepseek-coder"]),
              default="qwen-coder-32b", show_default=True,
              help="Cloud model to run the task with.")
@click.option("--no-watch", is_flag=True,
              help="Submit and exit without polling for the result.")
@click.option("--download", "download_dir", metavar="DIR",
              type=click.Path(file_okay=False), default=None,
              help="Download and unzip the task output into DIR on completion.")
def cloud(prompt: tuple, repo_url: Optional[str], model: str,
          no_watch: bool, download_dir: Optional[str]) -> None:
    """Run a coding task in the Free.ai cloud and stream its progress."""
    import time

    from free_code.cloud import (
        AuthRequired,
        CloudClient,
        CloudError,
        POLL_INTERVAL,
        queue_position_of,
        task_id_of,
    )
    from free_code.ui.terminal import print_error, print_info, print_markdown, print_success

    client = CloudClient()
    prompt_str = " ".join(prompt)

    try:
        task = client.submit(prompt_str, repo_url=repo_url, model=model)
    except AuthRequired as e:
        console.print(str(e))
        sys.exit(1)
    except CloudError as e:
        print_error(str(e))
        sys.exit(1)

    task_id = task_id_of(task)
    if not task_id:
        print_error(f"Unexpected API response: {task}")
        sys.exit(1)

    position = queue_position_of(task)
    if position is not None:
        print_success(f"Task submitted: {task_id} (queue position {position})")
    else:
        print_success(f"Task submitted: {task_id}")

    if no_watch and not download_dir:
        print_info("Check progress with: free-code tasks")
        return
    if no_watch and download_dir:
        print_info("--download requires watching the task; polling anyway.")

    last_printed = None
    try:
        while True:
            try:
                task = client.get(task_id)
            except CloudError as e:
                print_error(str(e))
                sys.exit(1)

            status = str(task.get("status", "")).lower()
            position = queue_position_of(task)
            line = f"queued (position {position})" if status == "queued" and position is not None else status
            if line != last_printed:
                print_info(f"Status: {line}")
                last_printed = line

            if status in ("completed", "failed", "cancelled", "error"):
                break
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        console.print(f"\n[dim]Stopped watching. Task {task_id} keeps running; "
                      f"check it with: free-code tasks[/dim]")
        return

    if status == "completed":
        result_text = task.get("result_text") or task.get("result") or ""
        if result_text:
            console.print()
            print_markdown(str(result_text))
        output_url = task.get("output_url")
        if output_url:
            print_info(f"Output: {output_url}")
            if download_dir:
                try:
                    dest = client.download_output(str(output_url), download_dir)
                    print_success(f"Output downloaded and extracted to {dest}")
                except CloudError as e:
                    print_error(str(e))
                    sys.exit(1)
        elif download_dir:
            print_info("Task completed but has no downloadable output.")
    else:
        error = task.get("error") or task.get("result_text") or "no details"
        print_error(f"Task {status}: {error}")
        sys.exit(1)


@main.command()
def tasks() -> None:
    """List your recent cloud tasks."""
    from free_code.cloud import AuthRequired, CloudClient, CloudError, task_id_of
    from free_code.ui.terminal import print_error

    client = CloudClient()
    try:
        items = client.list()
    except AuthRequired as e:
        console.print(str(e))
        sys.exit(1)
    except CloudError as e:
        print_error(str(e))
        sys.exit(1)

    if not items:
        console.print("[dim]No cloud tasks yet. Start one with: "
                      "free-code cloud \"task description\"[/dim]")
        return

    table = Table(title="Cloud Tasks", show_header=True, header_style="bold")
    table.add_column("ID", style="cyan")
    table.add_column("Status")
    table.add_column("Created")
    table.add_column("Task")

    for item in items:
        task_id = task_id_of(item)
        preview = str(item.get("prompt") or item.get("preview") or "").replace("\n", " ")
        if len(preview) > 60:
            preview = preview[:57] + "..."
        created = str(item.get("created_at") or item.get("created") or "")[:19].replace("T", " ")
        table.add_row(task_id[:8], str(item.get("status", "")), created, preview)

    console.print(table)


@main.command()
def init() -> None:
    """Initialize free-code in the current project."""
    from free_code.context.discovery import discover_files
    from free_code.context.repo_map import generate_repo_map
    from free_code.tools.git_ops import is_git_repo
    from free_code.tools.test_runner import detect_test_framework
    from free_code.ui.terminal import print_info, print_success, print_warning

    project_root = get_project_root()
    console.print(f"\n[bold]Initializing free-code[/bold] in {project_root}\n")

    # Check git
    if is_git_repo(str(project_root)):
        print_success("Git repository detected")
    else:
        print_warning("Not a git repository")

    # Discover files
    with console.status("Scanning files..."):
        files = discover_files(project_root)
    print_info(f"Found {len(files)} code files")

    # Detect test framework
    framework = detect_test_framework(str(project_root))
    if framework:
        print_info(f"Test framework: {framework}")
    else:
        print_info("No test framework detected")

    # Generate repo map
    with console.status("Generating repository map..."):
        repo_map = generate_repo_map(project_root)

    console.print(f"\n[dim]{repo_map}[/dim]")
    console.print(f"\n[success]Initialization complete. Run [bold]free-code[/bold] to start coding.[/success]\n")


@main.group(invoke_without_command=True)
@click.pass_context
def config(ctx: click.Context) -> None:
    """View or edit configuration."""
    if ctx.invoked_subcommand is None:
        _show_config()


@config.command("set")
@click.argument("key")
@click.argument("value")
def config_set(key: str, value: str) -> None:
    """Set a configuration value."""
    from free_code.ui.terminal import print_success

    set_config_value(key, value)
    print_success(f"Set {key} = {value}")


@config.command("get")
@click.argument("key")
def config_get(key: str) -> None:
    """Get a configuration value."""
    value = get_config_value(key)
    if value is not None:
        console.print(f"{key} = {value}")
    else:
        console.print(f"[dim]{key} is not set[/dim]")


@main.command()
def login() -> None:
    """Authenticate with Free.ai or configure a BYOK provider."""
    from free_code.auth import login_flow

    login_flow()


def _show_config() -> None:
    """Display current configuration as a table."""
    cfg = load_config()
    table = Table(title="Configuration", show_header=True, header_style="bold")
    table.add_column("Key", style="cyan")
    table.add_column("Value")

    for key, value in sorted(cfg.items()):
        display = str(value)
        # Mask sensitive values
        if key in ("token", "api_key") and value:
            display = display[:8] + "..." if len(display) > 8 else "***"
        table.add_row(key, display)

    table.add_row("[dim]config file[/dim]", f"[dim]{CONFIG_FILE}[/dim]")
    console.print(table)
