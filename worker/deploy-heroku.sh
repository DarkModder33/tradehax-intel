#!/usr/bin/env bash
# Bundles the worker and deploys it to Heroku through the Platform build API.
# Needs HEROKU_API_KEY in the environment and esbuild resolvable from worker/ (npm i --no-save esbuild).
# Usage: worker/deploy-heroku.sh <app-name>
set -euo pipefail
app="${1:?app name}"
cd "$(dirname "$0")"
node build.mjs
tmp="$(mktemp -d)"
tar -czf "$tmp/src.tgz" Procfile package.json dist
auth=(-H "Accept: application/vnd.heroku+json; version=3" -H "Authorization: Bearer ${HEROKU_API_KEY:?}")
src="$(curl -sf -X POST "${auth[@]}" "https://api.heroku.com/apps/$app/sources")"
put="$(node -e 'console.log(JSON.parse(process.argv[1]).source_blob.put_url)' "$src")"
get="$(node -e 'console.log(JSON.parse(process.argv[1]).source_blob.get_url)' "$src")"
curl -sf -X PUT -H "Content-Type:" --data-binary "@$tmp/src.tgz" "$put"
version="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
curl -sf -X POST "${auth[@]}" -H "Content-Type: application/json" \
  -d "{\"source_blob\":{\"url\":\"$get\",\"version\":\"$version\"}}" \
  "https://api.heroku.com/apps/$app/builds" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const b=JSON.parse(s);console.log(`build ${b.id} ${b.status}`);console.log(b.output_stream_url)})'
rm -rf "$tmp"
