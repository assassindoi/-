#!/usr/bin/env bash
set -euo pipefail
# Publish only the generated app. Browser audio and practice records are not part of this checkout.
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
npm run build -- --base=/-/
touch dist/.nojekyll
git_dir=$(git rev-parse --absolute-git-dir)
pages_tmp=$(mktemp -d)
trap 'rm -rf "$pages_tmp"' EXIT
export GIT_INDEX_FILE="$pages_tmp/index"
git read-tree --empty
git --git-dir="$git_dir" --work-tree="$repo_root/dist" -C "$repo_root/dist" add --all
pages_tree=$(git write-tree)
if git ls-remote --exit-code origin refs/heads/gh-pages > /dev/null; then
  git fetch origin refs/heads/gh-pages:refs/remotes/origin/gh-pages
  pages_parent=$(git rev-parse refs/remotes/origin/gh-pages)
  pages_commit=$(git commit-tree "$pages_tree" -p "$pages_parent" -m "Publish tone web app")
else
  pages_commit=$(git commit-tree "$pages_tree" -m "Publish tone web app")
fi
git push origin "$pages_commit:refs/heads/gh-pages"
echo 'App files published to gh-pages. Enable GitHub Pages from gh-pages / (root) in repository Settings > Pages.'
echo 'Expected site URL after GitHub completes publication: https://assassindoi.github.io/-/'
