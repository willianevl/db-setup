import { execSync } from 'child_process';

function getCurrentBranch(projectDir) {
  return execSync(`git -C "${projectDir}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim();
}

function hasUncommittedChanges(projectDir) {
  // --untracked-files=normal forces detection of new files regardless of git config
  const out = execSync(`git -C "${projectDir}" status --porcelain --untracked-files=normal`, { encoding: 'utf8' });
  return out.trim().length > 0;
}

export function checkBranchExists(projectDir, branch) {
  try {
    execSync(`git -C "${projectDir}" fetch origin`, { stdio: 'pipe' });
    execSync(`git -C "${projectDir}" rev-parse --verify "refs/remotes/origin/${branch}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function gitPrepare(projectDir, targetBranch) {
  const originalBranch = getCurrentBranch(projectDir);
  const dirty = hasUncommittedChanges(projectDir);

  if (dirty) {
    console.log(`  Stashing uncommitted changes on '${originalBranch}'...`);
    execSync(`git -C "${projectDir}" stash push --include-untracked -m "db-setup auto-stash"`, { stdio: 'inherit' });
  }

  execSync(`git -C "${projectDir}" fetch origin`, { stdio: 'inherit' });

  if (originalBranch !== targetBranch) {
    execSync(`git -C "${projectDir}" checkout "${targetBranch}"`, { stdio: 'inherit' });
  }

  execSync(`git -C "${projectDir}" pull origin "${targetBranch}"`, { stdio: 'inherit' });

  return { originalBranch, dirty, switched: originalBranch !== targetBranch };
}

export function gitRestore(projectDir, { originalBranch, dirty, switched }) {
  if (switched) {
    execSync(`git -C "${projectDir}" checkout "${originalBranch}"`, { stdio: 'inherit' });
  }
  if (dirty) {
    console.log(`  Restoring stashed changes on '${originalBranch}'...`);
    try {
      execSync(`git -C "${projectDir}" stash pop`, { stdio: 'inherit' });
    } catch {
      console.warn(`\n  Warning: stash pop failed — your changes are preserved in the stash.`);
      console.warn(`  Run \`git -C "${projectDir}" stash list\` to recover them.`);
    }
  }
}
