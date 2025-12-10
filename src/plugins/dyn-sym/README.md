# dyn-sym (Dynamic Symlinks Plugin)

Enables OpenCode to discover and search files in external directories by creating symlinks within a managed `.sym` directory in your project root.

## How It Works

1. **On plugin initialization**, creates a `.sym` directory in your project's worktree root
2. **Adds `.sym/` to local git exclude** (`.git/info/exclude`) - keeps `git status` clean
3. **Before ripgrep-based tools run** (`read`, `grep`, `glob`, `list`), creates a temporary `.ignore` file with `!/.sym/` negation pattern
4. **After those tools complete**, removes the `.ignore` file to avoid git artifacts
5. **Symlinks in `.sym/` are followed** by OpenCode's ripgrep (via `--follow` flag)

This allows the AI agent to discover, search, and read files in directories outside your project, such as:
- Shared libraries or SDKs
- Reference implementations
- Documentation repos
- Monorepo sibling packages

## Why the Temporary .ignore File?

OpenCode uses ripgrep for file discovery, which respects `.git/info/exclude`. This creates a conflict:
- We want `.sym` hidden from `git status` (via `.git/info/exclude`)
- We want `.sym` visible to ripgrep

The solution: ripgrep also reads `.ignore` files, and negation patterns (`!pattern`) override exclusions. By temporarily creating `.ignore` with `!/.sym/` during ripgrep tool calls, we get both:
- Clean `git status` (no `.sym` showing as untracked)
- Full visibility to the AI agent

## Usage

### Automatic Initialization

The plugin automatically:
- Creates `.sym/` if it doesn't exist
- Configures git to ignore `.sym/` locally
- Manages `.ignore` file lifecycle during tool calls
- Logs existing symlinks on startup

### Managing Symlinks

Currently, symlinks are managed manually or via external tooling:

```bash
# Add a symlink
ln -s /path/to/external/dir .sym/external-name

# Remove a symlink
rm .sym/external-name

# List symlinks
ls -la .sym/
```

### Programmatic API

The plugin exports functions for managing symlinks programmatically:

```typescript
import { 
  addSymlink, 
  removeSymlink, 
  listSymlinks, 
  clearSymlinks 
} from "./plugins/dyn-sym";

// Add a symlink
const entry = await addSymlink(worktreeRoot, "/path/to/target", "custom-name");

// List all symlinks
const symlinks = await listSymlinks(worktreeRoot);
for (const sym of symlinks) {
  console.log(`${sym.name} -> ${sym.targetPath} (exists: ${sym.targetExists})`);
}

// Remove a symlink
await removeSymlink(worktreeRoot, "custom-name");

// Clear all symlinks
const removed = await clearSymlinks(worktreeRoot);
```

## Git Exclusion

The plugin uses `.git/info/exclude` instead of `.gitignore` because:

1. `.git/info/exclude` is local-only and not tracked
2. Avoids polluting your project's `.gitignore` with plugin-specific entries
3. Works automatically without any user intervention

The exclusion is wrapped in markers for easy identification:

```
# dyn-sym plugin managed entries (DO NOT EDIT)
/.sym/
# end dyn-sym plugin managed entries
```

## Ripgrep Discovery

OpenCode uses ripgrep with the following relevant flags:

- `--follow` - Follows symbolic links
- `--hidden` - Includes hidden directories (like `.sym`)
- `--glob=!.git/*` - Excludes `.git` directory

Ripgrep also respects:
- `.gitignore` - Standard git ignore
- `.git/info/exclude` - Local git exclude (where we hide `.sym`)
- `.ignore` - Ripgrep-specific ignore (where we negate with `!/.sym/`)

## Limitations

- **Target must exist** when adding a symlink
- **Broken symlinks** are detected but not auto-cleaned
- **Git worktrees** are supported (`.git` file instead of directory)
- **Concurrent tool calls** are handled via callID tracking

## Future Enhancements

Potential future features:
- Configuration file for auto-linking paths on init
- OpenCode tool/command for managing symlinks from chat
- Auto-cleanup of broken symlinks
- Relative path support in config
