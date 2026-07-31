#!/bin/bash

PACKAGE=adonisjs-adminizer-provider

VERSIONS=$(npm view $PACKAGE time --json | jq -r 'to_entries[] | select(.key | contains("commit")) | "\(.key) \(.value)"')

SORTED_VERSIONS=$(echo "$VERSIONS" | sort -k2 -r)

VERSIONS_TO_UNPUBLISH=$(echo "$SORTED_VERSIONS" | tail -n +8)

echo "Preparing to unpublish versions beyond the latest 7 commits..."

while read -r version date; do
  if [[ -n "$version" && "$version" == *commit* ]]; then
    echo "Unpublishing version: $version published at $date"
    npm unpublish $PACKAGE@"$version" --force
  fi
done <<< "$VERSIONS_TO_UNPUBLISH"
