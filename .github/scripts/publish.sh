#!/usr/bin/env bash
# Publishes to the gh-pages branch, which GitHub Pages serves at the site's address.
#
#   publish.sh site <dir>   the website and the app: everything is replaced, except sky/
#   publish.sh sky  <dir>   the hourly renders: sky/ is replaced
#
# The branch is rebuilt each time as ONE commit with no parent. So a file removed from the repository is removed
# from the site (nothing stale stays served), and the branch keeps no history: the hourly images do not pile up in
# it. (A commit pushed away stays on GitHub's side, reachable by its hash, until GitHub clears it.)
#
# Two workflows publish here. Each takes the branch as it is, changes only its own part and pushes with a lease:
# if another one published meanwhile the push is refused, and the work is done again on the new state.
#
# The renders come from a job that installs packages from npm, and they are served from the app's own address: so
# only images and their index are let through, never a page or a script.
#
# Needs GITHUB_TOKEN (contents: write) and GITHUB_REPOSITORY in the environment.
set -euo pipefail

what=${1:?site or sky}
src=$(cd "${2:?the folder to publish}" && pwd)
: "${GITHUB_TOKEN:?}" "${GITHUB_REPOSITORY:?}"
remote=${PUBLISH_REMOTE:-"https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"}   # PUBLISH_REMOTE: another remote, to try the script against a scratch repository
branch=gh-pages

[ -n "$(find "$src" -type f -print -quit)" ] || { echo "nothing to publish in $src" >&2; exit 2; }
odd=""
case "$what" in
  site)
    # sky belongs to the other workflow: the site never brings its own
    odd=$(find "$src" -mindepth 1 -maxdepth 1 -name sky -print) ;;
  sky)
    odd=$(find "$src" -mindepth 1 ! \( -type f \( -name '*.png' -o -name sky.json \) \) -print) ;;
  *) echo "unknown: $what" >&2; exit 2 ;;
esac
[ -z "$odd" ] || { echo "not for publishing as $what:" >&2; echo "$odd" >&2; exit 2; }

work=""
trap '[ -z "$work" ] || rm -rf "$work"' EXIT

for attempt in 1 2 3 4 5; do
  [ -z "$work" ] || rm -rf "$work"
  work=$(mktemp -d)
  tree="$work/tree"; mkdir "$tree"
  git init -q "$work/fetch"
  old=""
  if git -C "$work/fetch" fetch -q --depth 1 "$remote" "$branch" 2>/dev/null; then
    old=$(git -C "$work/fetch" rev-parse FETCH_HEAD)
    git -C "$work/fetch" archive FETCH_HEAD | tar -x -C "$tree"
  fi

  case "$what" in
    site)
      # keep only what the other workflow owns (the folder sky); the rest is exactly this commit
      for e in "$tree"/* "$tree"/.[!.]*; do
        [ -e "$e" ] || [ -L "$e" ] || continue
        b=$(basename "$e")
        if [ -d "$e" ] && [ ! -L "$e" ] && [ "$b" = sky ]; then continue; fi
        rm -rf "$e"
      done
      cp -a "$src"/. "$tree"/
      ;;
    sky)
      rm -rf "$tree/sky"; mkdir "$tree/sky"; cp -a "$src"/. "$tree/sky"/
      ;;
  esac
  touch "$tree/.nojekyll"                                  # served as files, not built by Jekyll

  git init -q -b "$branch" "$tree"
  if [ -n "$old" ]; then                                    # what the branch already holds is not sent again: only what changed travels
    echo "$work/fetch/.git/objects" > "$tree/.git/objects/info/alternates"
    [ ! -f "$work/fetch/.git/shallow" ] || cp "$work/fetch/.git/shallow" "$tree/.git/shallow"
  fi
  git -C "$tree" add -A
  git -C "$tree" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -q -m "publish $what ${GITHUB_SHA:-}"
  if git -C "$tree" push -q --force-with-lease="refs/heads/$branch:$old" "$remote" "HEAD:refs/heads/$branch" 2>/dev/null; then
    echo "published $what as $(git -C "$tree" rev-parse --short HEAD) (try $attempt)"
    exit 0
  fi
  echo "push refused or failed, most often because the branch moved meanwhile (try $attempt)" >&2
  [ "$attempt" = 5 ] || sleep $((attempt * 7))
done
echo "could not publish after 5 tries" >&2
exit 1
