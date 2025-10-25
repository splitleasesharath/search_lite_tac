import sys
import re

def apply_wrapper(filename):
    """Apply emit_event_safe wrapper to a script."""
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if wrapper already exists
    if 'def emit_event_safe' in content:
        print(f"{filename}: Wrapper already exists, skipping")
        return
    
    # Find the line after "from adw_modules.event_manager import event_manager"
    wrapper_code = '''

def emit_event_safe(event_type: str, data: dict, context: dict, logger):
    """Emit event with error handling to prevent workflow crashes.

    This wrapper ensures that missing or invalid events don't crash the workflow.
    Pattern copied from adw_chore_implement.py for consistency.
    """
    try:
        event_manager.emit(event_type, data, context)
    except Exception as e:
        # Log warning but don't crash workflow
        logger.warning(f"Failed to emit event {event_type}: {e}")

'''
    
    # Insert wrapper after event_manager import
    content = re.sub(
        r'(from adw_modules\.event_manager import event_manager\n)',
        r'\1' + wrapper_code,
        content
    )
    
    # Replace all event_manager.emit calls (except the one in the wrapper)
    lines = content.split('\n')
    output = []
    i = 0
    in_wrapper = False
    
    while i < len(lines):
        line = lines[i]
        
        # Track if we're inside the wrapper function
        if 'def emit_event_safe' in line:
            in_wrapper = True
        elif in_wrapper and line.strip() and not line.startswith(' ') and not line.startswith('\t'):
            in_wrapper = False
        
        # Skip replacement if we're in the wrapper
        if in_wrapper:
            output.append(line)
            i += 1
            continue
        
        # Check if this line contains event_manager.emit
        if 'event_manager.emit(' in line:
            # Replace and add logger parameter
            line = line.replace('event_manager.emit(', 'emit_event_safe(')
            output.append(line)
            
            # Count parens to find the closing
            paren_count = line.count('(') - line.count(')')
            j = i + 1
            
            while j < len(lines) and paren_count > 0:
                next_line = lines[j]
                paren_count += next_line.count('(') - next_line.count(')')
                
                if paren_count == 0:
                    # Add logger before closing paren
                    next_line = next_line.replace(')', ', logger)', 1)
                
                output.append(next_line)
                j += 1
            
            i = j
        else:
            output.append(line)
            i += 1
    
    # Write back
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output))
    
    print(f"{filename}: Successfully applied wrapper")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python apply_emit_wrapper.py <filename>")
        sys.exit(1)
    
    apply_wrapper(sys.argv[1])
