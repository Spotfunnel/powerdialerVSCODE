# Global Project Isolation Directive

## Goal
Ensure the AI agent never interacts with, references, or troubleshoots any project or directory outside the current authorized workspace.

## Rules
1. **Hard Boundary**: The authorized workspace is `c:\Users\leoge\OneDrive\Documents\AI Activity\antigravity\powerdialer`.
2. **Log Filtering**: If terminal output contains foreign paths like `~/voice-os` or `C:\Users\leoge\Voice OS`, the agent must ignore them even if they contain errors.
3. **Restricted Proactivity**: Proactiveness is only permitted within the authorized workspace. Helping with external project setup is strictly forbidden as it violates project isolation.

## Violation Consequence
Any attempt to read or modify external files is a critical failure and must be self-corrected immediately.
